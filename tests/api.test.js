// 后端 API 集成测试：启动真实服务器进程，覆盖健康/模型代理（无密钥时 503）/任务
// 白名单/生命周期/账户隔离/同步冲突。RAG 查询在 embedding 就绪时抽样验证。
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 8790;
const BASE = `http://127.0.0.1:${PORT}`;

let server;
let dataDir;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return res.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("服务器未在预期时间内启动");
}

test.before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "ai-learning-test-"));
  server = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), AI_LEARNING_DATA: dataDir, DEEPSEEK_API_KEY: "", GLM_API_KEY: "" },
  });
  await waitForServer();
});

test.after(() => {
  server?.kill();
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {}
});

test("健康检查：无密钥时明确报告 providers 未配置", async () => {
  const data = await waitForServer();
  assert.equal(data.ok, true);
  const deepseek = data.providers.find((p) => p.id === "deepseek");
  assert.equal(deepseek.configured, false);
});

test("静态服务只开放前端资源，后端数据与仓库元数据不可读", async () => {
  const index = await fetch(`${BASE}/`);
  assert.equal(index.ok, true);
  const ok = await fetch(`${BASE}/app.js`);
  assert.equal(ok.status, 200);
  const module = await fetch(`${BASE}/src/app/state.js`);
  assert.equal(module.status, 200);
  for (const path of ["/.git/config", "/package.json", "/.env", "/server/data/users/index.json", "/server/src/accounts.js"]) {
    const hidden = await fetch(`${BASE}${path}`);
    assert.equal(hidden.status, 404, `${path} 不应被静态服务读取`);
  }
  const traversal = await fetch(`${BASE}/..%2f..%2fpackage.json`);
  assert.equal(traversal.status, 404, `穿越被拒绝：${traversal.status}`);
});

test("模型代理：未配置密钥时返回 503 与明确错误码", async () => {
  const res = await fetch(`${BASE}/api/model/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.code, "E_MODEL_NO_KEY");
});

test("局域网绑定时模型与 RAG 要求登录，登录后可访问", async () => {
  const dataDirNetwork = mkdtempSync(join(tmpdir(), "ai-learning-network-test-"));
  const portServer = createNetServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const networkServer = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), AI_LEARNING_HOST: "0.0.0.0", AI_LEARNING_DATA: dataDirNetwork, DEEPSEEK_API_KEY: "", GLM_API_KEY: "" },
  });
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        const response = await fetch(`${base}/api/health`);
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "局域网测试服务器应启动");

    for (const [path, body] of [
      ["/api/model/chat", { messages: [{ role: "user", content: "test" }] }],
      ["/api/rag/query", { query: "测试", mode: "term" }],
    ]) {
      const response = await fetch(`${base}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      assert.equal(response.status, 401, `${path} 应要求登录`);
      assert.equal((await response.json()).code, "E_NETWORK_AUTH");
    }

    const registration = await fetch(`${base}/api/accounts/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "network-user", password: "test-pass-123" }),
    });
    assert.equal(registration.status, 200);
    const { token } = await registration.json();
    const rag = await fetch(`${base}/api/rag/query`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: "图书馆几点关门", mode: "term" }),
    });
    assert.equal(rag.status, 200);
    const model = await fetch(`${base}/api/model/chat`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
    });
    assert.equal(model.status, 503, "登录后应通过认证并因无模型密钥得到明确 503");
  } finally {
    networkServer.kill();
    if (networkServer.exitCode === null && networkServer.signalCode === null)
      await new Promise((resolve) => networkServer.once("exit", resolve));
    try { rmSync(dataDirNetwork, { recursive: true, force: true }); } catch {}
  }
});

test("任务 API：白名单外脚本拒绝；参数校验", async () => {
  const bad = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script: "server/index.js", args: [] }),
  });
  assert.equal(bad.status, 500);
  const bad2 = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script: "experiments/inference.py" }),
  });
  assert.equal(bad2.status, 400);
  const badPath = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script: "experiments/embodied/collect.py", args: ["--out", "../users/index.json"] }),
  });
  assert.equal(badPath.status, 400);
  assert.equal((await badPath.json()).code, "E_TASK_ARGUMENT");
});

test("任务生命周期：启动轻量仿真 → 运行 → 成功 → 日志可读", async () => {
  const create = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script: "experiments/embodied/sim.py",
      args: ["--demo"],
      label: "api-test-check",
    }),
  });
  assert.equal(create.status, 200);
  const { id } = await create.json();
  let task;
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${BASE}/api/tasks/${id}`);
    task = await res.json();
    if (["succeeded", "failed", "cancelled", "timeout"].includes(task.status)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(task.status, "succeeded");
  assert.match(task.log, /finalError=/);
  assert.ok(task.elapsedMs >= 0);
  const list = await fetch(`${BASE}/api/tasks`);
  const { tasks } = await list.json();
  assert.ok(tasks.some((t) => t.id === id));
});

test("python 不可用时任务进入失败终态，不会永远停在 running 或 queued", async () => {
  const portServer = createNetServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const isolatedDir = mkdtempSync(join(tmpdir(), "ai-learning-nopython-"));
  const emptyPath = mkdtempSync(join(tmpdir(), "ai-learning-empty-path-"));
  // PATH 指向空目录：子进程无法启动，覆盖 spawn 失败路径（之前没有 error 监听）。
  const brokenServer = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), AI_LEARNING_DATA: isolatedDir, PATH: emptyPath, DEEPSEEK_API_KEY: "", GLM_API_KEY: "" },
  });
  const waitTerminal = async (id) => {
    let task;
    for (let i = 0; i < 50; i++) {
      task = await (await fetch(`${base}/api/tasks/${id}`)).json();
      if (["succeeded", "failed", "cancelled", "timeout"].includes(task.status)) return task;
      await new Promise((r) => setTimeout(r, 200));
    }
    return task;
  };
  const submit = async (label) => {
    const response = await fetch(`${base}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "experiments/embodied/sim.py", args: ["--demo"], label }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).id;
  };
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(ready, true, "无 python 的测试服务器应启动");

    const first = await waitTerminal(await submit("no-python-first"));
    assert.equal(first.status, "failed", "启动失败的任务必须落到 failed，而不是停在 running");
    assert.match(first.error || "", /启动失败|退出码/);

    // 队列必须被释放：第二个任务的结局同样是终态，而不是永久 queued。
    const second = await waitTerminal(await submit("no-python-second"));
    assert.equal(second.status, "failed");
  } finally {
    brokenServer.kill();
    for (const dir of [isolatedDir, emptyPath]) {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  }
});

test("任务取消：排队任务稳定取消并释放并发", async () => {
  const createTask = async (args, label) => {
    const response = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "experiments/embodied/collect.py", args, label }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).id;
  };
  const blockerId = await createTask(["--episodes", "500", "--out", "cancel-blocker.jsonl"], "cancel-blocker");
  // 等阻塞任务真正运行时，下一个任务必然进入排队态，避免“任务恰好已完成”的竞态。
  let blocker;
  for (let i = 0; i < 40; i++) {
    blocker = await (await fetch(`${BASE}/api/tasks/${blockerId}`)).json();
    if (blocker.status === "running") break;
    if (["succeeded", "failed", "cancelled", "timeout"].includes(blocker.status)) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.equal(blocker.status, "running", `阻塞任务未进入运行态：${blocker.status}`);

  const targetId = await createTask(["--episodes", "500", "--out", "cancel-target.jsonl"], "cancel-target");
  const cancel = await fetch(`${BASE}/api/tasks/${targetId}/cancel`, { method: "POST" });
  assert.equal(cancel.status, 200);
  const cancelled = await cancel.json();
  assert.equal(cancelled.status, "cancelled");

  // 清理阻塞任务，随后确认队列已释放。
  assert.equal((await fetch(`${BASE}/api/tasks/${blockerId}/cancel`, { method: "POST" })).status, 200);
  let task;
  for (let i = 0; i < 60; i++) {
    task = await (await fetch(`${BASE}/api/tasks/${targetId}`)).json();
    if (["cancelled", "succeeded", "failed", "timeout"].includes(task.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(task.status, "cancelled", `期望取消，实际 ${task.status}`);

  const next = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script: "experiments/embodied/sim.py",
      args: ["--demo"],
      label: "after-cancel",
    }),
  });
  assert.equal(next.status, 200);
  const { id: nextId } = await next.json();
  let nextTask;
  for (let i = 0; i < 80; i++) {
    nextTask = await (await fetch(`${BASE}/api/tasks/${nextId}`)).json();
    if (["succeeded", "failed", "cancelled", "timeout"].includes(nextTask.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(nextTask.status, "succeeded");
});

test("未知 API 返回 404 JSON", async () => {
  const res = await fetch(`${BASE}/api/nonexistent`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error, "未知 API");
});

// ---------- 账户隔离与同步冲突 ----------
async function register(username, password) {
  const res = await fetch(`${BASE}/api/accounts/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `register ${username}`);
  return (await res.json()).token;
}
async function push(token, state, baseRevision, strategy) {
  return fetch(`${BASE}/api/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ state, baseRevision, strategy }),
  });
}

test("账户：注册/登录/隔离；未认证访问同步被拒绝", async () => {
  const token = await register("alice", "password123");
  const noAuth = await fetch(`${BASE}/api/sync/pull`);
  assert.equal(noAuth.status, 401);
  const badLogin = await fetch(`${BASE}/api/accounts/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alice", password: "wrong-pass" }),
  });
  assert.equal(badLogin.status, 401);
  const weak = await fetch(`${BASE}/api/accounts/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "bob", password: "123" }),
  });
  assert.equal(weak.status, 400);
  return token;
});

test("第二个用户与第二个账户的数据隔离", async () => {
  const alice = await register("alice-iso", "password123");
  const bob = await register("bob-iso", "password456");
  await push(alice, { notes: { a: { title: "Alice 的笔记" } } }, 0);
  const bobPull = await (await fetch(`${BASE}/api/sync/pull`, {
    headers: { Authorization: `Bearer ${bob}` },
  })).json();
  assert.equal(bobPull.state, null, "bob 看不到 alice 的数据");
  const alicePull = await (await fetch(`${BASE}/api/sync/pull`, {
    headers: { Authorization: `Bearer ${alice}` },
  })).json();
  assert.ok(alicePull.state?.notes?.a);
});

test("同步：baseRevision 过期返回 409 冲突；force 覆盖可成功", async () => {
  const token = await register("carol", "password789");
  const first = await push(token, { v: 1 }, 0);
  assert.equal(first.status, 200);
  // 用旧版本号再推 → 冲突
  const conflict = await push(token, { v: 2 }, 0);
  assert.equal(conflict.status, 409);
  const payload = await conflict.json();
  assert.equal(payload.code, "E_SYNC_CONFLICT");
  assert.ok(payload.serverState);
  // force 覆盖
  const forced = await push(token, { v: 3 }, payload.serverRevision, "force");
  assert.equal(forced.status, 200);
  const { revision } = await forced.json();
  const pulled = await (await fetch(`${BASE}/api/sync/pull`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  assert.equal(pulled.revision, revision);
  assert.equal(pulled.state.v, 3);
  const historyDir = join(dataDir, "users", "history");
  const history = readdirSync(historyDir).filter((name) => name.endsWith(".json"));
  assert.ok(history.length, "显式 force 即使版本刚好匹配也留下覆盖前快照");
  assert.equal(JSON.parse(readFileSync(join(historyDir, history[0]), "utf8")).state.v, 1);
});

test("同步并发写入串行检查版本，同一 baseRevision 只允许一次成功", async () => {
  const token = await register("parallel", "password123");
  const initial = await push(token, { v: 1 }, 0);
  assert.equal(initial.status, 200);
  const [a, b] = await Promise.all([
    push(token, { v: 2 }, 1),
    push(token, { v: 3 }, 1),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const state = await (await fetch(`${BASE}/api/sync/pull`, { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(state.revision, 2);
  assert.ok([2, 3].includes(state.state.v));
});

test("任务记录按账户隔离，参数运行在账户工作目录", async () => {
  const alice = await register("task-alice", "password123");
  const bob = await register("task-bob", "password456");
  const created = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${alice}` },
    body: JSON.stringify({ script: "experiments/embodied/sim.py", args: ["--fault", "occlusion", "--json-out", "reports/occlusion.json"], label: "owner-test" }),
  });
  assert.equal(created.status, 200);
  const { id } = await created.json();
  const hidden = await fetch(`${BASE}/api/tasks/${id}`, { headers: { Authorization: `Bearer ${bob}` } });
  assert.equal(hidden.status, 404);
  const ownList = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${alice}` } })).json();
  assert.ok(ownList.tasks.some((task) => task.id === id));
  const otherList = await (await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${bob}` } })).json();
  assert.ok(!otherList.tasks.some((task) => task.id === id));
  let task;
  for (let i = 0; i < 120; i++) {
    task = await (await fetch(`${BASE}/api/tasks/${id}`, { headers: { Authorization: `Bearer ${alice}` } })).json();
    if (["succeeded", "failed", "cancelled", "timeout"].includes(task.status)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(task.status, "succeeded");
  assert.ok(task.artifacts.some((artifact) => artifact.name === "reports/occlusion.json"));
  const meta = JSON.parse(readFileSync(join(dataDir, "tasks", id, "meta.json"), "utf8"));
  const published = JSON.parse(readFileSync(join(dataDir, "artifacts", meta.ownerId, "reports", "occlusion.json"), "utf8"));
  assert.equal(published.fault, "occlusion");
});

test("RAG API：词项模式在纯 Node 环境可用（不依赖 embedding）", async () => {
  const res = await fetch(`${BASE}/api/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "选课课程退选截止时间", mode: "term", topK: 2 }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.results.term.length, "词项检索有结果");
  assert.ok(data.results.term.some((d) => d.docId === "current" || d.docId === "archive"));
});

test("RAG 保留 overlap=0，且自选语料参与词项检索", async () => {
  const res = await fetch(`${BASE}/api/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "时间一致性",
      mode: "term",
      chunkSize: 40,
      overlap: 0,
      customCorpus: [{ title: "我的遥感笔记", text: "时间一致性是评价多时相遥感数据融合的重要指标。" }],
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.params.chunkSize, 40);
  assert.equal(data.params.overlap, 0);
  assert.ok(data.results.term.some((d) => d.docId === "custom-1"));
});
