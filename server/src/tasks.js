// 实验任务运行器：白名单脚本 + 队列 + 超时/取消 + 日志落盘。
// 每个任务在独立子进程中运行；应用主进程绝不执行任意代码。
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { nowIso, uuid, ensureJson, writeJson, withinRoot } from "./util.js";

const ROOT = resolve(import.meta.dirname, "../..");
export const DATA_DIR = process.env.AI_LEARNING_DATA || resolve(ROOT, "server/data");
const TASKS_DIR = join(DATA_DIR, "tasks");

// 白名单：脚本路径 → 运行参数约束。实验产物写到任务目录，不写仓库源码区。
export const WHITELIST = {
  "experiments/inference.py": { timeoutMs: 600000, args: /^--?[a-z-]+(\s+\S+)?$/ },
  "experiments/rag_embed.py": { timeoutMs: 900000 },
  "experiments/basics/train_eval.py": { timeoutMs: 300000 },
  "experiments/embodied/collect.py": { timeoutMs: 300000 },
  "experiments/embodied/sim.py": { timeoutMs: 300000 },
  "experiments/embodied/bc_train.py": { timeoutMs: 900000 },
  "experiments/embodied/evaluate.py": { timeoutMs: 600000 },
};

const MAX_CONCURRENT = Number(process.env.AI_LEARNING_MAX_TASKS || 1);
const registry = new Map(); // taskId -> {proc, ...}

export async function ensureDirs() {
  await mkdir(TASKS_DIR, { recursive: true });
  for (const sub of ["users", "backups", "rag", "artifacts"]) await mkdir(join(DATA_DIR, sub), { recursive: true });
}

export async function listTasks() {
  await ensureDirs();
  const entries = await readdir(TASKS_DIR).catch(() => []);
  const tasks = [];
  for (const id of entries) {
    const meta = await ensureJson(join(TASKS_DIR, id, "meta.json"), null);
    if (meta) tasks.push(publicView(meta));
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
  return ensureJson(join(TASKS_DIR, taskId, "meta.json"), null);
}
async function saveMeta(taskId, meta) {
  await writeJson(join(TASKS_DIR, taskId, "meta.json"), meta);
}

let running = 0;
const queue = [];

function pump() {
  while (running < MAX_CONCURRENT && queue.length) {
    const job = queue.shift();
    running++;
    startProcess(job).finally(() => {
      running--;
      pump();
    });
  }
}

async function startProcess({ taskId, script, args, meta }) {
  const dir = join(TASKS_DIR, taskId);
  const metaPath = join(dir, "meta.json");
  const logPath = join(dir, "run.log");
  const proc = spawn("python", [resolve(ROOT, script), ...args], {
    cwd: join(DATA_DIR, "artifacts"),
    env: { ...process.env, PYTHONIOENCODING: "utf-8", AI_LEARNING_TASK_DIR: dir },
  });
  registry.set(taskId, { proc });
  meta.status = "running";
  meta.startedAt = nowIso();
  await saveMeta(taskId, meta);
  let logSize = 0;
  const append = async (buf) => {
    logSize += buf.length;
    await writeFile(logPath, buf, { flag: "a" }).catch(() => {});
    meta.logBytes = logSize;
  };
  proc.stdout.on("data", append);
  proc.stderr.on("data", append);
  const timeout = setTimeout(() => {
    meta.status = "timeout";
    kill(taskId);
  }, WHITELIST[script]?.timeoutMs || 600000);
  await new Promise((done) => {
    proc.on("close", async (code, signal) => {
      clearTimeout(timeout);
      registry.delete(taskId);
      meta.finishedAt = nowIso();
      meta.elapsedMs = meta.startedAt ? Date.now() - new Date(meta.startedAt).getTime() : 0;
      meta.exitCode = code;
      meta.status =
        meta.status === "timeout"
          ? "timeout"
          : meta.status === "cancelled"
            ? "cancelled"
            : code === 0
              ? "succeeded"
              : "failed";
      if (meta.status === "failed")
        meta.error = `退出码 ${code}；详见 run.log 末尾`;
      meta.artifacts = await listArtifacts(dir);
      await saveMeta(taskId, meta);
      done();
    });
  });
}

async function listArtifacts(dir) {
  const files = await readdir(dir).catch(() => []);
  return files.filter((f) => f !== "meta.json" && f !== "run.log").map((f) => ({ name: f }));
}

export async function createTask({ script, args = [], label = "", config = {} }) {
  if (!WHITELIST[script]) {
    const error = new Error(`脚本不在白名单内：${script}`);
    error.code = "E_TASK_SCRIPT";
    throw error;
  }
  await ensureDirs();
  const taskId = uuid();
  const dir = join(TASKS_DIR, taskId);
  await mkdir(dir, { recursive: true });
  const meta = {
    id: taskId,
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

export async function cancelTask(taskId) {
  const meta = await loadMeta(taskId);
  if (!meta) {
    const error = new Error("任务不存在");
    error.code = "E_TASK_UNKNOWN";
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

export async function taskDetail(taskId) {
  const meta = await loadMeta(taskId);
  if (!meta) {
    const error = new Error("任务不存在");
    error.code = "E_TASK_UNKNOWN";
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
