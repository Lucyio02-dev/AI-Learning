// 本地后端：静态站点 + API（模型代理 / 实验任务 / RAG / 账户同步）。
// 纯 Node 标准库，无第三方依赖。启动：npm run server
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep, join } from "node:path";
import { send, readJson, withinRoot } from "./src/util.js";
import { providerStatus, chat } from "./src/llm.js";
import { createTask, listTasks, taskDetail, cancelTask, restoreTasks, ensureDirs, DATA_DIR } from "./src/tasks.js";
import { register, login, authUser, logout, pull, push } from "./src/accounts.js";
import { ragQuery } from "./src/rag.js";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const startedAt = new Date().toISOString();

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
  "GET /api/tasks": async () => ({ tasks: await listTasks() }),
  "POST /api/tasks": async (req) => {
    const body = await readJson(req);
    if (!body.script || !Array.isArray(body.args))
      throw httpError(400, "E_VALIDATION", "需要 script 与 args");
    return createTask({
      script: String(body.script),
      args: body.args.map(String),
      label: String(body.label || "").slice(0, 100),
      config: body.config && typeof body.config === "object" ? body.config : {},
    });
  },
  "POST /api/rag/query": async (req) => {
    const body = await readJson(req);
    return ragQuery({
      query: String(body.query || "").slice(0, 500),
      topK: Math.min(6, Math.max(1, Number(body.topK) || 3)),
      chunkSize: Math.min(600, Math.max(40, Number(body.chunkSize) || 200)),
      overlap: Math.min(200, Math.max(0, Number(body.overlap) || 40)),
      mode: ["term", "embedding", "both"].includes(body.mode) ? body.mode : "embedding",
      currentOnly: !!body.currentOnly,
      missing: !!body.missing,
      truncation: !!body.truncation,
      generate: !!body.generate,
      goldEvidence: Array.isArray(body.goldEvidence)
        ? body.goldEvidence.filter((c) => c && typeof c === "object" && typeof c.id === "string").slice(0, 6)
        : null,
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
      if (req.method === "GET") send(res, 200, await taskDetail(taskId));
      else if (cancel) send(res, 200, await cancelTask(taskId));
      else throw httpError(405, "E_VALIDATION", "不支持的方法");
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      send(res, 404, { error: "未知 API", path: url.pathname });
      return;
    }
    // 静态文件
    const requested = withinRoot(ROOT, "." + decodeURIComponent(url.pathname));
    if (!requested) {
      send(res, 403, { error: "forbidden" });
      return;
    }
    const target = (await stat(requested)).isDirectory()
      ? resolve(requested, "index.html")
      : requested;
    const content = await readFile(target);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
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
server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI Learning 后端已启动: http://127.0.0.1:${PORT}`);
  console.log(`数据目录: ${DATA_DIR}`);
  console.log(
    "模型密钥状态:",
    providerStatus().map((p) => `${p.label}:${p.configured ? "已配置" : "未配置"}`).join(" / "),
  );
});
