import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  migrate,
  parseImport,
  normalize,
  load,
  persist,
  exported,
  KEY,
  LEGACY_KEY,
} from "../src/store.js";
import {
  retrieve,
  promptDemo,
  newAgent,
  agentStep,
  motion,
} from "../src/labs.js";
import { courses } from "../src/content.js";
test("损坏数据可恢复时先留副本，无法留副本时进入只读", () => {
  const map = new Map([[KEY, "broken"]]);
  const storage = {
    getItem: (k) => map.get(k),
    setItem: (k, v) => map.set(k, v),
  };
  const result = load(storage);
  assert.equal(result.readOnly, false);
  assert.equal(map.get(`${KEY}-recovery`), "broken");
  assert.equal(
    load({
      getItem: (k) => map.get(k),
      setItem() {
        throw Error("Quota");
      },
    }).readOnly,
    true,
  );
});
test("旧笔记和实验记录完整保留，不把打卡作为能力", () => {
  const old = {
    progress: { ch01: { practice: true } },
    notes: { ch06: { title: "旧内容", body: "多模态编辑记录" } },
    practiceLogs: { ch09: "CSV 实验" },
    favorites: ["chapter-ch05"],
  };
  const s = migrate(old);
  assert.equal(s.notes.ch06.body, "多模态编辑记录");
  assert.equal(s.notes["legacy-log-ch09"].body, "CSV 实验");
  assert.deepEqual(s.legacy, old);
  assert.deepEqual(s.progress, {});
  assert.deepEqual(parseImport(exported(s)), s);
});
test("导入损坏或无关数据时拒绝替换", () => {
  for (const input of [
    "null",
    "[]",
    '{"hello":1}',
    "broken",
    '{"state":{"version":3}}',
  ])
    assert.throws(() => parseImport(input));
});
test("新数据规范化，排除危险视频协议", () => {
  const s = normalize({
    ...fresh(),
    videos: [
      { title: "bad", url: "javascript:alert(1)" },
      { title: "ok", url: "https://example.org" },
    ],
  });
  assert.equal(s.videos.length, 1);
});
test("优先加载 v2，损坏原始数据不被覆盖", () => {
  const map = new Map([
    [KEY, "broken"],
    [LEGACY_KEY, JSON.stringify({ notes: {} })],
  ]);
  const storage = { getItem: (k) => map.get(k) };
  const result = load(storage);
  assert.match(result.message, /读取失败/);
  assert.equal(map.get(KEY), "broken");
});
test("存储空间耗尽返回失败，导出不受影响", () => {
  const s = fresh();
  assert.equal(
    persist(
      {
        setItem() {
          throw Error("Quota");
        },
      },
      s,
    ),
    false,
  );
  assert.equal(parseImport(exported(s)).version, 2);
});
test("RAG 版本过滤与缺失资料不能被 Top-K 修复", () => {
  const q = "选课课程退选截止时间";
  const all = retrieve(q);
  assert.ok(all.some((d) => !d.current));
  const current = retrieve(q, { currentOnly: true });
  assert.ok(current.some((d) => d.id === "current"));
  assert.ok(current.every((d) => d.current));
  assert.ok(
    !retrieve(q, { missing: true, topK: 4 }).some((d) => d.id === "current"),
  );
  assert.deepEqual(retrieve("zzzz-no-match"), []);
});
test("Prompt 证据与格式是独立变量", () => {
  assert.equal(promptDemo({ format: true }).diagnosis, "evidence");
  assert.equal(promptDemo({ evidence: true }).diagnosis, "ready");
  assert.equal(
    promptDemo({ evidence: true, conflict: true }).diagnosis,
    "conflict",
  );
});
test("写入超时原样重试会重复，核验后恢复保持一次写入", () => {
  const interrupted = agentStep(newAgent(), "start");
  const bad = agentStep(interrupted, "retry");
  assert.equal(bad.writes, 2);
  assert.equal(bad.passed, false);
  const good = agentStep(agentStep(interrupted, "verify"), "finish");
  assert.equal(good.writes, 1);
  assert.equal(good.passed, true);
  assert.deepEqual(agentStep(good, "retry"), good);
  assert.equal(agentStep(newAgent(), "finish").done, false);
});
test("不同朝向和目标的坐标转换回到世界目标", () => {
  for (const angle of [0, 15, 45, 90, 135, 180, -90, 360])
    for (const target of [
      { x: 3, y: 2 },
      { x: -1, y: 4 },
    ])
      assert.ok(motion(angle, true, target).error < 1e-9);
  assert.ok(motion(90, false).error > 1);
});
test("课程先修有效且无环，教材与真实主题一致", () => {
  const ids = new Set(courses.map((c) => c.id));
  assert.equal(ids.size, courses.length);
  function visit(id, path = []) {
    assert.ok(!path.includes(id), "先修循环");
    const c = courses.find((c) => c.id === id);
    assert.ok(c);
    c.prerequisites.forEach((p) => visit(p, [...path, id]));
  }
  courses.forEach((c) => visit(c.id));
  for (const [id, chapter] of [
    ["ch05", 8],
    ["ch08", 5],
    ["ch10", 9],
    ["ch11", 11],
  ])
    assert.ok(
      courses
        .find((c) => c.id === id)
        .resources[0].url.includes(`chapter${chapter}/`),
    );
});
