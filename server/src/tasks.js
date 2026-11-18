// 实验任务运行器：白名单脚本 + 队列 + 超时/取消 + 日志落盘。
// 每个任务在独立子进程中运行；应用主进程绝不执行任意代码。
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, stat, cp, rm } from "node:fs/promises";
import { resolve, join, isAbsolute, relative, sep } from "node:path";
import { nowIso, uuid, ensureJson, writeJson, withinRoot } from "./util.js";

const ROOT = resolve(import.meta.dirname, "../..");
export const DATA_DIR = process.env.AI_LEARNING_DATA || resolve(ROOT, "server/data");
const TASKS_DIR = join(DATA_DIR, "tasks");

// 白名单：脚本路径 → 运行时限。任务参数会由下面的 schema 逐项校验。
export const WHITELIST = {
  "experiments/inference.py": { timeoutMs: 600000 },
  "experiments/basics/train_eval.py": { timeoutMs: 300000 },
  "experiments/embodied/collect.py": { timeoutMs: 300000 },
  "experiments/embodied/sim.py": { timeoutMs: 300000 },
  "experiments/embodied/bc_train.py": { timeoutMs: 900000 },
  "experiments/embodied/evaluate.py": { timeoutMs: 600000 },
};

const MAX_CONCURRENT = 1; // 每账户任务共享实验产物目录，串行执行以免文件互相覆盖。
const registry = new Map(); // taskId -> {proc}
const memMeta = new Map(); // taskId -> 内存中的 meta 对象（cancel 与 close 共享同一份）

export async function ensureDirs() {
  await mkdir(TASKS_DIR, { recursive: true });
  for (const sub of ["users", "backups", "rag", "artifacts"]) await mkdir(join(DATA_DIR, sub), { recursive: true });
}

export async function listTasks(ownerId = "local") {
  ownerId = safeOwner(ownerId);
  await ensureDirs();
  const entries = await readdir(TASKS_DIR).catch(() => []);
  const tasks = [];
  for (const id of entries) {
    const meta = await ensureJson(join(TASKS_DIR, id, "meta.json"), null);
    if (meta && safeOwner(meta.ownerId || "local") === ownerId) tasks.push(publicView(meta));
  }
  return tasks.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function publicView(meta) {
  return {
    id: meta.id,
    script: meta.script,
    status: meta.status,
    createdAt: meta.createdAt,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    exitCode: meta.exitCode,
    elapsedMs: meta.elapsedMs,
    label: meta.label,
    logBytes: meta.logBytes || 0,
    artifacts: meta.artifacts || [],
    config: meta.config || {},
    error: meta.error || null,
    restored: !!meta.restored,
  };
}

async function loadMeta(taskId) {
  return memMeta.get(taskId) || ensureJson(join(TASKS_DIR, taskId, "meta.json"), null);
}
async function saveMeta(taskId, meta) {
  memMeta.set(taskId, meta);
  await writeJson(join(TASKS_DIR, taskId, "meta.json"), meta);
}

let running = 0;
const queue = [];

function pump() {
  while (running < MAX_CONCURRENT && queue.length) {
    const job = queue.shift();
    running++;
    startProcess(job)
      .catch(async (error) => {
        // 启动阶段失败（python 不存在、工作目录不可写等）也必须落到唯一终态，
        // 否则任务会一直停在 queued，界面与队列状态都不可信。
        job.meta.status = "failed";
        job.meta.error = `任务未能启动：${error.message}`;
        job.meta.finishedAt = nowIso();
        await saveMeta(job.taskId, job.meta).catch(() => {});
      })
      .finally(() => {
        running--;
        pump();
      });
  }
}

async function startProcess({ taskId, script, args, meta }) {
  // 竞态保护：任务在入队到启动之间被取消，则不执行。
  if (meta.status === "cancelled") return;
  const dir = join(TASKS_DIR, taskId);
  const logPath = join(dir, "run.log");
  const workspaceRoot = join(DATA_DIR, "artifacts", safeOwner(meta.ownerId));
  const artifactRoot = join(dir, "artifacts");
  await mkdir(artifactRoot, { recursive: true });
  await stageTaskInputs(script, args, workspaceRoot, artifactRoot);
  const proc = spawn("python", [resolve(ROOT, script), ...args], {
    cwd: artifactRoot,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", AI_LEARNING_TASK_DIR: dir },
  });
  // 必须紧接着 spawn 挂监听：子进程启动失败的 error 事件在下一个 tick 就发出，
  // 放在任何 await 之后挂都会变成未处理事件并终止整个服务。
  const outcome = new Promise((resolve) => {
    proc.once("close", (code, signal) => resolve({ code, signal }));
    proc.once("error", (error) => resolve({ error }));
  });
  registry.set(taskId, { proc });
  meta.status = "running";
  meta.startedAt = nowIso();
  await saveMeta(taskId, meta);
  if (meta.status === "cancelled") {
    // 启动期间被取消：终止子进程，不继续。
    kill(taskId);
    return;
  }
  let logSize = 0;
  const append = async (buf) => {
    logSize += buf.length;
    await writeFile(logPath, buf, { flag: "a" }).catch(() => {});
    meta.logBytes = logSize;
  };
  proc.stdout?.on("data", append);
  proc.stderr?.on("data", append);
  const timeout = setTimeout(() => {
    meta.status = "timeout";
    kill(taskId);
  }, WHITELIST[script]?.timeoutMs || 600000);
  const { code, signal, error: spawnError } = await outcome;
  clearTimeout(timeout);
  registry.delete(taskId);
  meta.finishedAt = nowIso();
  meta.elapsedMs = meta.startedAt ? Date.now() - new Date(meta.startedAt).getTime() : 0;
  meta.exitCode = code;
  meta.status = spawnError
    ? "failed"
    : meta.status === "timeout"
      ? "timeout"
      : meta.status === "cancelled"
        ? "cancelled"
        : code === 0
          ? "succeeded"
          : "failed";
  if (meta.status === "failed")
    meta.error = spawnError
      ? `任务进程启动失败：${spawnError.message}`
      : signal
        ? `进程被信号 ${signal} 终止；详见 run.log 末尾`
        : `退出码 ${code}；详见 run.log 末尾`;
  try {
    meta.artifacts = await collectArtifacts({ artifactRoot, workspaceRoot, taskId, script, args, publish: meta.status === "succeeded" });
  } catch (error) {
    meta.status = "failed";
    meta.error = `任务结束但产物保存失败：${error.message}`;
  }
  await saveMeta(taskId, meta);
}

async function listArtifacts(dir) {
  const found = [];
  async function walk(current, prefix = "") {
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute, rel);
      else if (entry.isFile()) found.push({ name: rel, bytes: (await stat(absolute)).size });
    }
  }
  await walk(dir);
  return found;
}

function pathArguments(args) {
  const values = {};
  for (let i = 0; i < args.length; i++)
    if (["--data", "--model", "--out", "--json-out"].includes(args[i]) && args[i + 1])
      values[args[i]] = args[++i];
  return values;
}

function artifactPath(root, rel) {
  const parts = rel.split("/");
  const path = resolve(root, ...parts);
  const fromRoot = relative(root, path);
  if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) throw taskValidation("实验路径越界");
  return path;
}

async function stageTaskInputs(script, args, workspaceRoot, artifactRoot) {
  const values = pathArguments(args);
  for (const key of ["--data", "--model"]) {
    const rel = values[key];
    if (!rel) continue;
    const source = artifactPath(workspaceRoot, rel);
    const destination = artifactPath(artifactRoot, rel);
    try {
      await stat(source);
      await mkdir(resolve(destination, ".."), { recursive: true });
      await cp(source, destination, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function collectArtifacts({ artifactRoot, workspaceRoot, taskId, script, args, publish }) {
  const files = await listArtifacts(artifactRoot);
  if (!files.length) return [];
  const historyRoot = join(workspaceRoot, "history", taskId);
  await mkdir(resolve(historyRoot, ".."), { recursive: true });
  await cp(artifactRoot, historyRoot, { recursive: true, force: true });
  if (publish) {
    const values = pathArguments(args);
    for (const key of ["--out", "--json-out"]) {
      const rel = values[key];
      if (!rel) continue;
      const source = artifactPath(artifactRoot, rel);
      const destination = artifactPath(workspaceRoot, rel);
      try {
        await stat(source);
        await mkdir(resolve(destination, ".."), { recursive: true });
        await cp(source, destination, { recursive: true, force: true });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      // collect.py writes a metadata sidecar next to --out.
      const sidecar = `${rel}.meta.json`;
      const sideSource = artifactPath(artifactRoot, sidecar);
      try {
        await stat(sideSource);
        const sideDestination = artifactPath(workspaceRoot, sidecar);
        await mkdir(resolve(sideDestination, ".."), { recursive: true });
        await cp(sideSource, sideDestination, { force: true });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  return files;
}

export async function createTask({ script, args = [], label = "", config = {}, ownerId = "local" }) {
  if (!WHITELIST[script]) {
    const error = new Error(`脚本不在白名单内：${script}`);
    error.code = "E_TASK_SCRIPT";
    throw error;
  }
  validateTaskArgs(script, args);
  ownerId = safeOwner(ownerId);
  if (JSON.stringify(config).length > 10000) throw taskValidation("任务配置超过 10 KB");
  await ensureDirs();
  const taskId = uuid();
  const dir = join(TASKS_DIR, taskId);
  await mkdir(dir, { recursive: true });
  const meta = {
    id: taskId,
    ownerId,
    script,
    args,
    label,
    config,
    status: "queued",
    createdAt: nowIso(),
    cwdNote: "artifacts/（任务在数据目录运行，产物按脚本内相对路径落盘）",
  };
  await saveMeta(taskId, meta);
  queue.push({ taskId, script, args, meta });
  pump();
  return publicView(meta);
}

function taskValidation(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "E_TASK_ARGUMENT";
  return error;
}

function safeOwner(ownerId = "local") {
  const value = String(ownerId || "local");
  if (value !== "local" && !/^[0-9a-f-]{36}$/.test(value))
    throw taskValidation("非法任务所有者");
  return value;
}

function validateTaskArgs(script, args) {
  if (!Array.isArray(args) || args.length > 40 || args.some((a) => typeof a !== "string" || a.length > 2000 || a.includes("\0")))
    throw taskValidation("实验参数格式错误或过长");
  const rules = {
    "experiments/inference.py": { flags: ["--check", "--sample"], values: { "--model": "path", "--max-new-tokens": [1, 2048], "--seed": [-2147483648, 2147483647], "--json-out": "path", "--prompt": "text" } },
    "experiments/basics/train_eval.py": { flags: ["--leaky"], values: { "--width": [2, 2048], "--seed": [-2147483648, 2147483647], "--epochs": [1, 10000], "--json-out": "path" } },
    "experiments/embodied/collect.py": { values: { "--episodes": [1, 500], "--noise": [0, 1], "--seed": [-2147483648, 2147483647], "--out": "path" } },
    "experiments/embodied/sim.py": { flags: ["--demo"], values: { "--fault": "fault", "--seed": [-2147483648, 2147483647], "--noise": [0, 1], "--json-out": "path" } },
    "experiments/embodied/bc_train.py": { values: { "--data": "path", "--out": "path", "--width": [2, 512], "--epochs": [1, 2000], "--lr": [0.00001, 1], "--seed": [-2147483648, 2147483647], "--json-out": "path" } },
    "experiments/embodied/evaluate.py": { values: { "--model": "path", "--episodes": [1, 500], "--target-dist": "target", "--noise": [0, 1], "--seed": [-2147483648, 2147483647], "--tolerance": [0, 10], "--json-out": "path" } },
  }[script];
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    if (seen.has(option)) throw taskValidation(`参数重复：${option}`);
    seen.add(option);
    if (rules.flags?.includes(option)) continue;
    const kind = rules.values?.[option];
    if (!kind || i + 1 >= args.length || args[i + 1].startsWith("--"))
      throw taskValidation(`不支持的实验参数：${option}`);
    const value = args[++i];
    if (kind === "path") {
      const parts = value.replaceAll("\\", "/").split("/");
      if (isAbsolute(value) || value.includes(":") || value.includes("\\") || parts.some((p) => !p || p === "." || p === ".." || !/^[A-Za-z0-9._-]+$/.test(p)) || parts[0] === "history")
        throw taskValidation(`路径必须位于本账户实验产物目录内：${option}`);
      const base = resolve(ROOT, "_artifact-root");
      const rel = relative(base, resolve(base, ...parts));
      if (rel === ".." || rel.startsWith(`..${sep}`)) throw taskValidation("实验路径越界");
    } else if (kind === "text") {
      if (value.length > 1000) throw taskValidation(`${option} 最多 1000 字符`);
    } else if (kind === "fault") {
      if (!["none", "frame", "actionLimit", "drift", "occlusion", "timeSkew", "unit"].includes(value)) throw taskValidation("未知故障类型");
    } else if (kind === "target") {
      if (!["train", "new"].includes(value)) throw taskValidation("未知评测分布");
    } else {
      const n = Number(value);
      if (!Number.isFinite(n) || n < kind[0] || n > kind[1]) throw taskValidation(`${option} 超出允许范围`);
    }
  }
}

function kill(taskId) {
  const entry = registry.get(taskId);
  if (entry) {
    entry.proc.kill("SIGTERM");
    setTimeout(() => {
      try {
        entry.proc.kill("SIGKILL");
      } catch {}
    }, 3000);
  }
}

export async function cancelTask(taskId, ownerId = "local") {
  ownerId = safeOwner(ownerId);
  // 与 close 回调共享同一 meta 对象，保证取消状态不被覆盖。
  const meta = memMeta.get(taskId) || (await loadMeta(taskId));
  if (!meta) {
    const error = new Error("任务不存在");
    error.code = "E_TASK_UNKNOWN";
    throw error;
  }
  if (safeOwner(meta.ownerId || "local") !== ownerId) {
    const error = new Error("任务不存在");
    error.code = "E_TASK_UNKNOWN";
    error.statusCode = 404;
    throw error;
  }
  if (meta.status === "queued") {
    meta.status = "cancelled";
    meta.finishedAt = nowIso();
    await saveMeta(taskId, meta);
    const qi = queue.findIndex((j) => j.taskId === taskId);
    if (qi >= 0) queue.splice(qi, 1);
    return publicView(meta);
  }
  if (meta.status === "running") {
    meta.status = "cancelled";
    kill(taskId);
    return publicView(meta);
  }
  return publicView(meta);
}

export async function taskDetail(taskId, ownerId = "local") {
  ownerId = safeOwner(ownerId);
  const meta = await loadMeta(taskId);
  if (!meta) {
    const error = new Error("任务不存在");
    error.code = "E_TASK_UNKNOWN";
    throw error;
  }
  if (safeOwner(meta.ownerId || "local") !== ownerId) {
    const error = new Error("任务不存在");
    error.code = "E_TASK_UNKNOWN";
    error.statusCode = 404;
    throw error;
  }
  const log = await readFile(join(TASKS_DIR, taskId, "run.log"), "utf8").catch(() => "");
  return { ...publicView(meta), log: log.slice(-200000) };
}

// 进程重启后恢复：running→failed（无法恢复执行），queued→重新排队。
export async function restoreTasks() {
  await ensureDirs();
  const entries = await readdir(TASKS_DIR).catch(() => []);
  for (const id of entries) {
    const meta = await loadMeta(id);
    if (!meta) continue;
    if (meta.status === "running") {
      meta.status = "failed";
      meta.error = "服务进程重启，任务中断；可重新运行";
      meta.restored = true;
      meta.finishedAt = nowIso();
      await saveMeta(id, meta);
    } else if (meta.status === "queued") {
      queue.push({ taskId: id, script: meta.script, args: meta.args, meta });
    }
  }
  pump();
}

export function taskRoot(taskId) {
  return withinRoot(TASKS_DIR, taskId);
}
