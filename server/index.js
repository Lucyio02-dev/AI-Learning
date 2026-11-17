// 本地后端：静态站点 + API（模型代理 / 实验任务 / RAG / 账户同步）。
// 纯 Node 标准库，无第三方依赖。启动：npm run server
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep, join, relative } from "node:path";
import { send, readJson } from "./src/util.js";
import { providerStatus, chat } from "./src/llm.js";
import { createTask, listTasks, taskDetail, cancelTask, restoreTasks, ensureDirs, DATA_DIR } from "./src/tasks.js";
import { register, login, authUser, logout, pull, push } from "./src/accounts.js";
import { ragQuery } from "./src/rag.js";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_ROOT_FILES = new Set([
  "index.html", "app.js", "styles.css", "service-worker.js", "site.webmanifest",
]);
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.AI_LEARNING_HOST || "127.0.0.1"; // 局域网第二设备同步时设为 0.0.0.0
const startedAt = new Date().toISOString();
const taskAuthRequired = !["127.0.0.1", "::1", "localhost"].includes(HOST);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".md": "text/plain; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
  ".jsonl": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function httpError(status, code, message, payload) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  e.payload = payload;
  return e;
}

function requireNetworkAccount(req, purpose = "服务") {
  const user = authUser(req);
  if (taskAuthRequired && !user)
    throw httpError(401, "E_NETWORK_AUTH", `局域网${purpose}需要先登录账户`);
  return user;
}

function taskOwner(req) {
  return requireNetworkAccount(req, "任务")?.userId || "local";
}

function publicFile(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  const rel = decoded.replace(/^\/+/, "") || "index.html";
  const normalized = resolve(ROOT, rel);
  const fromRoot = relative(ROOT, normalized);
  if (fromRoot.startsWith("..") || fromRoot.includes(`..${sep}`)) return null;
  if (!PUBLIC_ROOT_FILES.has(fromRoot) && !fromRoot.startsWith(`src${sep}`)) return null;
  return normalized;
}

const routes = {
  "GET /api/health": async () => ({
    ok: true,
    version: "3.0.0",
    startedAt,
    providers: providerStatus(),
    dataDir: DATA_DIR,
  }),
  "GET /api/model/providers": async () => ({ providers: providerStatus() }),
  "POST /api/model/chat": async (req) => {
    requireNetworkAccount(req, "模型调用");
    const body = await readJson(req);
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 40) : null;
    if (!messages || messages.some((m) => !m || typeof m.content !== "string"))
      throw httpError(400, "E_VALIDATION", "messages 必须为 {role, content} 数组");
    const result = await chat({
      messages: messages.map((m) => ({ role: String(m.role), content: m.content.slice(0, 8000) })),
      sampling: body.sampling || {},
      provider: body.provider === "glm" ? "glm" : "deepseek",
      seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : null,
    });
    return result;
  },
  "GET /api/tasks": async (req) => ({ tasks: await listTasks(taskOwner(req)) }),
  "POST /api/tasks": async (req) => {
    const body = await readJson(req);
    if (!body.script || !Array.isArray(body.args))
      throw httpError(400, "E_VALIDATION", "需要 script 与 args");
    if (body.args.some((arg) => typeof arg !== "string"))
      throw httpError(400, "E_VALIDATION", "实验参数必须是字符串数组");
    return createTask({
      script: String(body.script),
      args: body.args,
      label: String(body.label || "").slice(0, 100),
      config: body.config && typeof body.config === "object" ? body.config : {},
      ownerId: taskOwner(req),
    });
  },
  "POST /api/rag/query": async (req) => {
    requireNetworkAccount(req, "RAG 查询");
    const body = await readJson(req);
    const chunkSize = Number.isFinite(Number(body.chunkSize))
      ? Math.min(600, Math.max(40, Number(body.chunkSize)))
      : 200;
    const overlap = Number.isFinite(Number(body.overlap))
      ? Math.min(200, Math.floor(chunkSize / 2), Math.max(0, Number(body.overlap)))
      : Math.min(40, Math.floor(chunkSize / 2));
    const customCorpus = Array.isArray(body.customCorpus)
      ? body.customCorpus.slice(0, 20).map((doc, i) => ({
          id: `custom-${i + 1}`,
          title: String(doc?.title || `自选资料 ${i + 1}`).slice(0, 200),
          date: String(doc?.date || "").slice(0, 40),
          version: "user",
          current: true,
          text: String(doc?.text || "").slice(0, 2000),
        })).filter((doc) => doc.text)
      : [];
    return ragQuery({
      query: String(body.query || "").slice(0, 500),
      topK: Math.min(6, Math.max(1, Number(body.topK) || 3)),
      chunkSize,
      overlap,
      mode: ["term", "embedding", "both"].includes(body.mode) ? body.mode : "embedding",
      currentOnly: !!body.currentOnly,
      missing: !!body.missing,
      truncation: !!body.truncation,
      generate: !!body.generate,
      goldEvidence: Array.isArray(body.goldEvidence)
        ? body.goldEvidence.filter((c) => c && typeof c.id === "string").slice(0, 6).map((c) => ({ id: c.id.slice(0, 120) }))
        : null,
      customCorpus,
    });
  },
  "POST /api/accounts/register": async (req) => register(await readJson(req)),
  "POST /api/accounts/login": async (req) => login(await readJson(req)),
  "POST /api/accounts/logout": async (req) => {
    logout(req);
    return { ok: true };
  },
  "GET /api/sync/pull": async (req) => {
    const user = authUser(req);
    if (!user) throw httpError(401, "E_SYNC_HTTP", "需要登录");
    return pull(user.userId);
  },
  "POST /api/sync/push": async (req) => {
    const user = authUser(req);
    if (!user) throw httpError(401, "E_SYNC_HTTP", "需要登录");
    const body = await readJson(req, 8 * 1024 * 1024);
    if (!body.state || typeof body.state !== "object")
      throw httpError(400, "E_VALIDATION", "state 缺失");
    return push(user.userId, {
      state: body.state,
      baseRevision: Number(body.baseRevision ?? -1),
      strategy: body.strategy === "force" ? "force" : "reject",
    });
  },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const handler = routes[`${req.method} ${url.pathname}`];
  try {
    if (handler) {
      send(res, 200, await handler(req, res));
      return;
    }
    // 任务详情/取消带参数，走前缀匹配
    const taskMatch = url.pathname.match(/^\/api\/tasks\/([\w-]+)(\/cancel)?$/);
    if (taskMatch) {
      const [_, taskId, cancel] = taskMatch;
      const ownerId = taskOwner(req);
      if (req.method === "GET" && !cancel) send(res, 200, await taskDetail(taskId, ownerId));
      else if (req.method === "POST" && cancel) send(res, 200, await cancelTask(taskId, ownerId));
      else throw httpError(405, "E_VALIDATION", "不支持的方法");
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      send(res, 404, { error: "未知 API", path: url.pathname });
      return;
    }
    // 静态文件
    const requested = publicFile(url.pathname);
    if (!requested) {
      send(res, 404, { error: "not_found" });
      return;
    }
    let target = requested;
    try {
      if ((await stat(requested)).isDirectory()) {
        target = resolve(requested, "index.html");
        const fromRoot = relative(ROOT, target);
        if (!fromRoot.startsWith(`src${sep}`)) {
          send(res, 404, { error: "not_found" });
          return;
        }
      }
      const content = await readFile(target);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(content);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        send(res, 404, { error: "not_found" });
        return;
      }
      throw error;
    }
  } catch (error) {
    const status = error.statusCode || (error.code === "E_MODEL_NO_KEY" ? 503 : 500);
    send(res, status, {
      error: error.message,
      code: error.code || "E_SERVER",
      ...(error.payload || {}),
    });
  }
});

await ensureDirs();
await restoreTasks();
server.listen(PORT, HOST, () => {
  console.log(`AI Learning 后端已启动: http://${HOST === "0.0.0.0" ? "本机IP" : HOST}:${PORT}`);
  console.log(`数据目录: ${DATA_DIR}`);
  console.log(
    "模型密钥状态:",
    providerStatus().map((p) => `${p.label}:${p.configured ? "已配置" : "未配置"}`).join(" / "),
  );
});
