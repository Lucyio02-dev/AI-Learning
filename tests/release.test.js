// 发布回归：旧缓存升级与完整模块图，覆盖“源码更新了、浏览器仍打开旧版”。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import vm from "node:vm";
import { originLearningBackup } from "../src/core/transfer.js";
import { fresh, normalizeNote } from "../src/core/schema.js";
import { parseImport, KEY, LEGACY_KEY } from "../src/core/store.js";

const root = resolve(import.meta.dirname, "..");

test("旧域名备份可被正式站点导入，保留原始学习键且不读取登录令牌", () => {
  const state = fresh();
  state.notes.saved = normalizeNote({ id: "saved", title: "原地址笔记", body: "升级前的内容" });
  state.progress.foundation = { read: true };
  const data = new Map([
    [KEY, JSON.stringify(state)],
    [LEGACY_KEY, '{"notes":{"ch01":"旧笔记"}}'],
    ["ai-learning-auth-token", "secret-do-not-export"],
  ]);
  const storage = {
    getItem(key) {
      assert.notEqual(key, "ai-learning-auth-token");
      return data.get(key) ?? null;
    },
    setItem() { assert.fail("导出不应写入或清空原存储"); },
    removeItem() { assert.fail("导出不应删除学习记录"); },
  };
  const backup = originLearningBackup(storage, "https://old.example.test");
  const imported = parseImport(JSON.stringify(backup));
  assert.equal(imported.notes.saved.body, "升级前的内容");
  assert.equal(imported.progress.foundation.read, true);
  assert.equal(backup.recoveryRaw[LEGACY_KEY], data.get(LEGACY_KEY));
  assert.equal(JSON.stringify(backup).includes("secret-do-not-export"), false);
  assert.equal(data.get(KEY), JSON.stringify(state));
});

test("空存储不制造迁移数据，损坏存储停止普通导出", () => {
  assert.equal(originLearningBackup({ getItem: () => null }), null);
  assert.throws(() => originLearningBackup({ getItem: (key) => key === KEY ? "{broken" : null }), SyntaxError);
});

test("旧缓存升级只刷新本应用，保留课程地址与其他应用缓存", async () => {
  const handlers = new Map();
  const entries = new Map([["ai-learning-platform-v1", "old shell"], ["other-app", "keep"]]);
  const navigated = [];
  let claimed = false, unregistered = false, skipped = false, activation;
  const client = (url) => ({ url, navigate: async (target) => { navigated.push(target); } });
  const context = {
    URL,
    caches: { delete: async (key) => entries.delete(key) },
    self: {
      addEventListener: (name, fn) => handlers.set(name, fn),
      skipWaiting: () => { skipped = true; },
      registration: {
        scope: "https://example.test/AI-Learning/",
        unregister: async () => { unregistered = true; },
      },
      clients: {
        claim: async () => { claimed = true; },
        matchAll: async () => [
          client("https://example.test/AI-Learning/?lang=zh#course/rag/2"),
          client("https://example.test/Other/"),
          client("https://elsewhere.test/AI-Learning/"),
        ],
      },
    },
  };
  vm.runInNewContext(await readFile(resolve(root, "service-worker.js"), "utf8"), context);
  handlers.get("install")();
  handlers.get("activate")({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.ok(skipped && claimed && unregistered);
  assert.equal(entries.has("ai-learning-platform-v1"), false);
  assert.equal(entries.get("other-app"), "keep");
  assert.equal(navigated.length, 1);
  const target = new URL(navigated[0]);
  assert.equal(target.pathname, "/AI-Learning/");
  assert.equal(target.hash, "#course/rag/2");
  assert.equal(target.searchParams.get("lang"), "zh");
  assert.ok(target.searchParams.has("app-upgrade"));
  assert.equal(handlers.has("fetch"), false, "退役脚本不能继续截获网络请求");
});

test("静态发布包含缓存退役脚本，全部视图与动态 import 使用同一资源版本", async () => {
  const result = spawnSync(process.execPath, ["scripts/build-static-site.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const dist = resolve(root, "dist");
  const info = JSON.parse(await readFile(resolve(dist, "release.json"), "utf8"));
  const index = await readFile(resolve(dist, "index.html"), "utf8");
  const script = index.match(/<script[^>]+src="([^"]+)"/)?.[1];
  const style = index.match(/href="([^"]+\/styles\.css)"/)?.[1];
  assert.ok(script?.startsWith(`./${info.assetDirectory}/`));
  assert.ok(style?.startsWith(`./${info.assetDirectory}/`));
  assert.ok(await readFile(resolve(dist, "service-worker.js"), "utf8"));
  const published = await readdir(dist);
  for (const forbidden of ["server", "experiments", ".git", ".env", "node_modules", "docs"]) {
    assert.equal(published.includes(forbidden), false, `${forbidden} 不应成为静态发布内容`);
  }

  const assetRoot = resolve(dist, info.assetDirectory);
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    assert.ok(file.startsWith(`${assetRoot}${sep}`), `模块不能跨版本导入：${file}`);
    visited.add(file);
    const code = await readFile(file, "utf8");
    for (const match of code.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+\.js)["']/g)) {
      await visit(fileURLToPath(new URL(match[1], pathToFileURL(file))));
    }
  }
  await visit(resolve(assetRoot, "app.js"));
  for (const name of ["home", "course", "map", "routes", "labs", "lab-prompt", "lab-rag", "lab-agent", "lab-embodied", "projects", "library", "quiz", "tutor", "settings"]) {
    assert.ok(visited.has(resolve(assetRoot, `src/app/views/${name}.js`)), `保留 3.0 视图：${name}`);
  }
  assert.ok(visited.has(resolve(assetRoot, "src/content/open-source-cases.js")), "新增内容也必须进入发布图");
  assert.ok(visited.has(resolve(assetRoot, "src/core/store.js")), "继续使用 v3 学习数据与迁移逻辑");
});
