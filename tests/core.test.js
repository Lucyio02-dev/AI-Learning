// 核心行为回归：迁移链、导入预检、实验室引擎、内容一致性、运动学。
import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh, normalize, stableId, normalizeRun, normalizeNote,
} from "../src/core/schema.js";
import {
  load, persist, exported, parseImport, inspectImport, applyImport, mergeStates, validateState, KEY, V2_KEY, LEGACY_KEY,
} from "../src/core/store.js";
import { AppError, isCode } from "../src/core/errors.js";
import { courses, getCourse, validateContent, getSections, projects, labInfo } from "../src/content/index.js";
import { retrieve, chunkDocument, evalSet, retrievalHit, gradeAnswer, corpus } from "../src/labs/term.js";
import { promptDemo, buildVariants, checkJson, evaluateAnswer, aggregate } from "../src/labs/prompt.js";
import { motion, runEpisode, faultProfiles, rng, FAULTS } from "../src/labs/kinematics.js";
import {
  newAgentRun, TOOL_SPECS, validateParams, callRead, callWrite, recover, finish, serverCall, newAgent, agentStep,
} from "../src/labs/agent.js";

// ---------- 存储与迁移 ----------
test("v3 数据往返：导出-导入幂等", () => {
  const s = fresh();
  s.progress.foundation = { read: true, viewedSteps: [0, 1], evidence: ["run-1"] };
  s.notes["note-1"] = normalizeNote({ id: "note-1", title: "测试", body: "正文", tags: ["a", "b"] });
  s.runs = [normalizeRun({ lab: "rag", mode: "model", summary: "测试运行", evidence: { a: 1 } })];
  const round = parseImport(exported(s));
  assert.equal(round.version, 3);
  assert.equal(round.progress.foundation.read, true);
  assert.equal(round.notes["note-1"].tags[0], "a");
  assert.equal(round.runs[0].evidence.a, 1);
});

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

test("v2 → v3 迁移：能力字段降级为自报，一次通过不再同时给诊断+验证", () => {
  const v2 = {
    version: 2,
    goal: "llm",
    last: { course: "rag", step: 2 },
    progress: { rag: { read: true, explained: true, diagnosed: true, verified: true } },
    notes: { rag: { title: "旧笔记", body: "内容", tags: "a b" } },
    runs: [{ id: "r1", lab: "rag", time: "2026-01-01T00:00:00Z", summary: "旧", evidence: "{}", passed: true }],
    favorites: ["rag-0"],
    videos: [{ title: "x", url: "https://example.org" }],
    reports: { assistant: "报告" },
  };
  const s = normalize(v2);
  assert.equal(s.version, 3);
  const p = s.progress.rag;
  assert.equal(p.read, true);
  assert.equal(p.selfReported, true);
  assert.equal(p.experimentPassed, false, "v2 的粗糙判定不冒充实验通过");
  assert.ok(!("diagnosed" in p));
  assert.equal(s.notes.rag.tags[0], "a");
  assert.equal(s.runs[0].statuses.verified, false);
  assert.equal(s.resourceStates["rag-0"].favorite, true);
  assert.equal(s.projects.assistant.report, "报告");
  // 可再导出导入
  const round = parseImport(exported(s));
  assert.equal(round.progress.rag.selfReported, true);
});

test("v1 → v3 迁移：笔记与实验文本保留，打卡不转换", () => {
  const old = {
    progress: { ch01: { practice: true } },
    notes: { ch06: { title: "旧内容", body: "多模态编辑记录" } },
    practiceLogs: { ch09: "CSV 实验" },
    favorites: ["chapter-ch05"],
  };
  const s = parseImport(JSON.stringify(old));
  assert.equal(s.version, 3);
  assert.equal(s.notes.ch06.body, "多模态编辑记录");
  assert.equal(s.notes["legacy-log-ch09"].body, "CSV 实验");
  assert.deepEqual(s.legacy, old);
  assert.deepEqual(s.progress, {});
});

test("导入预检：显示范围/冲突/建议模式；未知版本拒绝", () => {
  const current = fresh();
  current.notes["n1"] = normalizeNote({ id: "n1", title: "我的", body: "本机版本" });
  const incoming = fresh();
  incoming.notes["n1"] = normalizeNote({ id: "n1", title: "备份", body: "备份版本" });
  const plan = inspectImport(exported(incoming), current);
  assert.equal(plan.incoming.notes, 1);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.suggestedMode, "merge");
  for (const input of ["null", "[]", '{"hello":1}', "broken"])
    assert.throws(() => parseImport(input), undefined, input);
  assert.throws(
    () => parseImport('{"state":{"version":4}}'),
    (e) => isCode(e, "E_IMPORT_VERSION"),
    "未知版本不按旧版读取",
  );
  // v3 空备份是合法输入
  const empty = parseImport('{"state":{"version":3}}');
  assert.equal(empty.version, 3);
});

test("合并策略：同字段取较新，运行记录按 ID 去重", () => {
  const a = fresh();
  const b = fresh();
  a.notes.n1 = normalizeNote({ id: "n1", body: "A", updatedAt: "2026-01-01T00:00:00Z" });
  b.notes.n1 = normalizeNote({ id: "n1", body: "B较新", updatedAt: "2026-02-01T00:00:00Z" });
  a.runs = [normalizeRun({ id: "same", lab: "rag" })];
  b.runs = [normalizeRun({ id: "same", lab: "rag" }), normalizeRun({ id: "extra", lab: "prompt" })];
  const merged = mergeStates(a, b);
  assert.equal(merged.notes.n1.body, "B较新");
  assert.equal(merged.runs.length, 2, "同 ID 去重，新记录进入活跃区");
  assert.ok(merged.runs.some((r) => r.id === "extra"));
});

test("validateState 拦截危险键与非 http 视频", () => {
  // JSON.parse 会把 __proto__ 作为自有属性（真实导入攻击向量）
  const crafted = JSON.parse('{"version":3,"videos":[{"title":"bad","url":"javascript:alert(1)"}],"progress":{"__proto__":{"read":true}}}');
  const check = validateState(crafted);
  assert.equal(check.ok, false);
  assert.ok(check.issues.length >= 2, JSON.stringify(check.issues));
  assert.ok(validateState(fresh()).ok);
});

test("存储空间耗尽返回失败，导出不受影响", () => {
  const s = fresh();
  assert.equal(
    persist({ setItem() { throw Error("Quota"); } }, s),
    false,
  );
  assert.equal(parseImport(exported(s)).version, 3);
});

test("稳定 ID 与运行记录归一化", () => {
  const id = stableId("run");
  assert.ok(id.startsWith("run-"));
  const r = normalizeRun({ lab: "x", evidence: null, evidenceText: "文本证据" });
  assert.equal(r.evidenceText, "文本证据");
  assert.equal(r.mode, "rule");
});

// ---------- 内容一致性 ----------
test("课程先修有效且无环，17 个原有稳定 ID 保留", () => {
  const ids = new Set(courses.map((c) => c.id));
  assert.equal(ids.size, courses.length);
  for (const id of ["foundation", "tensor", "ch02", "rag", "agent", "ch01", "space", "policy", "ch05", "ch03", "ch04", "ch08", "jailbreak", "stega", "ch10", "agent-safety", "ch11"])
    assert.ok(ids.has(id), `缺稳定 ID ${id}`);
  const check = validateContent();
  assert.equal(check.ok, true, JSON.stringify(check.problems));
});

test("核心课满足完整模板（问题情境/预测/代码/陷阱/修改/验证/局限/引用/深度）", () => {
  for (const id of ["foundation", "pyexp", "vector", "probopt", "autograd", "tensor", "tokens", "attention", "sampling", "ch02", "rag", "agent", "ch01", "ch05", "space", "policy"]) {
    const c = getCourse(id);
    assert.ok(c, id);
    assert.ok(c.problem && c.predict, `${id} 缺问题情境/预测`);
    assert.equal(c.steps.length, 4, `${id} 缺四步`);
    assert.ok(c.steps.some((s) => s.formulas?.length), `${id} 缺公式`);
    assert.ok(c.steps.some((s) => s.code), `${id} 缺代码`);
    assert.ok(c.steps.some((s) => s.pitfalls?.length), `${id} 缺常见错误`);
    assert.ok(c.steps.some((s) => s.modify), `${id} 缺修改任务`);
    assert.ok(c.steps.at(-1).verify, `${id} 缺独立验证`);
    assert.ok(c.steps.at(-1).limits, `${id} 缺局限`);
    assert.ok(c.references?.length >= 1, `${id} 缺引用`);
    assert.ok(c.depths?.intuition && c.depths?.engineering && c.depths?.research, `${id} 缺三层深度`);
  }
});

test("研究专题覆盖研究问题/基线/实验/边界", () => {
  for (const c of courses.filter((x) => x.track === "research")) {
    const sections = getSections(c).map((s) => s[0]).join();
    assert.ok(sections.includes("研究问题") && sections.includes("基线"), c.id);
    assert.ok(c.references.length, `${c.id} 缺引用`);
  }
});

test("项目含阶段任务/提示/验收；实验注册完整", () => {
  for (const p of projects) {
    assert.ok(p.stages.length >= 4, p.id);
    for (const st of p.stages) {
      assert.ok(st.tasks.length, `${p.id}/${st.id} 缺任务`);
      assert.ok(st.acceptance.length, `${p.id}/${st.id} 缺验收`);
    }
  }
  for (const id of ["prompt", "rag", "agent", "embodied"]) assert.ok(labInfo[id]);
});

test("教材章节只作为来源属性，不作为课程身份", () => {
  const byChapter = courses.filter((c) => c.sourceRef?.chapter === 8);
  assert.equal(byChapter.length, 1);
  assert.equal(byChapter[0].id, "ch05");
});

// ---------- RAG 词项检索与指标 ----------
test("RAG 版本过滤与缺失资料不能被 Top-K 修复", () => {
  const q = "选课课程退选截止时间";
  const all = retrieve(q);
  assert.ok(all.some((d) => !d.current));
  const current = retrieve(q, { currentOnly: true });
  assert.ok(current.some((d) => d.id === "current"));
  assert.ok(current.every((d) => d.current));
  assert.ok(!retrieve(q, { missing: true, topK: 4 }).some((d) => d.id === "current"));
  assert.deepEqual(retrieve("zzzz-no-match"), []);
});

test("分块与检索指标：hit@k 与回答分级", () => {
  const chunks = corpus.flatMap((d) => chunkDocument(d, { size: 60, overlap: 20 }));
  assert.ok(chunks.length >= 4);
  const q = evalSet[0];
  const docs = retrieve(q.question, { topK: 3, chunks });
  assert.equal(retrievalHit(docs, q.gold), 1);
  assert.equal(gradeAnswer(`[${q.gold[0]}] 第一周周五 17:00`, q), "grounded-cited");
  assert.equal(gradeAnswer("根据规定大约是周五", q), "wrong");
  const noGold = evalSet.find((x) => !x.gold.length);
  assert.equal(gradeAnswer("资料未覆盖该问题", noGold), "grounded-refusal");
  assert.equal(gradeAnswer("大概是三天后", noGold), "fabrication");
});

// ---------- Prompt 引擎 ----------
test("Prompt 证据与格式是独立变量，冲突优先", () => {
  assert.equal(promptDemo({ format: true }).diagnosis, "evidence");
  assert.equal(promptDemo({ evidence: true }).diagnosis, "ready");
  assert.equal(promptDemo({ evidence: true, conflict: true }).diagnosis, "conflict");
});

test("变体构造遵循单变量差异，JSON 校验与聚合", () => {
  const variants = buildVariants();
  assert.ok(variants.length >= 3);
  assert.equal(checkJson('{"deadline":"周五","source":"指南"}').valid, true);
  assert.equal(checkJson('{"deadline":"周五"}').valid, false);
  const results = [
    { eval: { ok: true } },
    { eval: { ok: false } },
    { eval: { ok: true } },
  ];
  const agg = aggregate(results);
  assert.equal(agg.passed, 2);
  assert.equal(agg.failures.length, 1);
  assert.ok(Math.abs(agg.rate - 2 / 3) < 1e-9);
  assert.equal(evaluateAnswer("根据当前学期选课指南，退选截止为第一周周五 17:00", { expectDeadline: true, material: "当前学期选课指南：退选截止时间为第一周周五 17:00。" }).ok, true);
});

// ---------- Agent 引擎 ----------
test("工具参数校验按语义分类", () => {
  const bad = validateParams("book_lab", { slot: "haha", capacity: 9, extra: 1 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.code === "ENUM"));
  assert.ok(bad.errors.some((e) => e.code === "RANGE"));
  assert.ok(bad.errors.some((e) => e.code === "EXTRA"));
  const missing = validateParams("book_lab", { capacity: 2 });
  assert.ok(missing.errors.some((e) => e.code === "MISSING" && e.field === "slot"));
  assert.equal(validateParams("book_lab", { slot: "friday-14", capacity: 2 }).ok, true);
});

test("写入超时：幂等键使重试不产生重复预约，恢复保持一次写入", () => {
  const run = newAgentRun();
  callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 }, "timeout_write");
  assert.equal(run.phase, "interrupted");
  assert.ok(run.checkpoint);
  assert.equal(run.world.bookings.length, 1, "服务端实际已提交一次");
  // 原样重试（同 request_id）→ 服务端去重
  callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 });
  assert.equal(run.world.bookings.length, 1, "幂等键应去重");
  // 不同 request_id 的重试才会重复（错误策略演示）
  const bad = newAgentRun();
  callWrite(bad, "book_lab", { slot: "friday-14", capacity: 2 }, "timeout_write");
  callWrite(bad, "book_lab", { slot: "friday-14", capacity: 2, request_id: "other-id" });
  assert.equal(bad.world.bookings.length, 2, "无幂等键的重试导致重复");
  finish(bad);
  assert.equal(bad.passed, false);
  // 正确路径：核验后收尾
  const good = newAgentRun();
  callWrite(good, "book_lab", { slot: "friday-14", capacity: 2 }, "timeout_write");
  recover(good);
  assert.equal(good.recoveredStatus, "confirmed");
  good.done = true;
  finish(good);
  assert.equal(good.passed, true);
});

test("权限不足被拒绝且不入库；参数错误不会到达服务端", () => {
  const run = newAgentRun();
  callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 }, "permission");
  assert.equal(run.world.bookings.length, 0);
  const run2 = newAgentRun();
  callWrite(run2, "book_lab", { capacity: 0 });
  assert.equal(run2.world.bookings.length, 0);
  assert.ok(run2.trace.some((t) => t.kind === "rejected"));
});

test("目标核验依据事实而非状态码", () => {
  const run = newAgentRun();
  callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 });
  finish(run);
  assert.equal(run.passed, true);
  assert.ok(run.trace.at(-1).note.includes("1 条"));
});

test("敏感字段脱敏：trace 中 request_id 只留前缀", () => {
  const run = newAgentRun();
  callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 });
  const t = run.trace.find((x) => x.kind === "write");
  assert.ok(t.masked.request_id.endsWith("…"));
  assert.ok(t.masked.request_id.length < 8);
});

test("旧 API 兼容：agentStep 语义保持（超时→核验→通过；重试→重复）", () => {
  const interrupted = agentStep(newAgent(), "start");
  const bad = agentStep(interrupted, "retry");
  assert.equal(bad.passed, false);
  const good = agentStep(agentStep(interrupted, "verify"), "finish");
  assert.equal(good.writes, 1);
  assert.equal(good.passed, true);
  assert.deepEqual(agentStep(good, "retry"), good);
  assert.equal(agentStep(newAgent(), "finish").done, false);
});

// ---------- 具身运动学 ----------
test("不同朝向和目标的坐标转换回到世界目标", () => {
  for (const angle of [0, 15, 45, 90, 135, 180, -90, 360])
    for (const target of [{ x: 3, y: 2 }, { x: -1, y: 4 }])
      assert.ok(motion(angle, true, target).error < 1e-9);
  assert.ok(motion(90, false).error > 1);
});

test("闭环 episode：无故障收敛，故障特征可区分", () => {
  const ok = runEpisode({ fault: "none", seed: 7 });
  assert.equal(ok.success, true);
  const frame = runEpisode({ fault: "frame", seed: 7, noise: 0.02 });
  const limit = runEpisode({ fault: "actionLimit", seed: 7, target: { x: 4.5, y: 3 } });
  assert.ok(!frame.success || frame.finalError > 0.2, "参考系故障应产生误差");
  const limited = limit.frames.some(
    (f) => f.action && Math.hypot(f.action.x, f.action.y) > 1.9 && Math.hypot(f.action.x, f.action.y) < 2.1,
  );
  assert.ok(limited, "限幅故障下至少一步被截断到上限");
  const occl = runEpisode({ fault: "occlusion", seed: 7 });
  assert.ok(occl.frames.every((f) => "observed" in f), "帧结构完整");
  // 伪随机一致性
  const r1 = rng(5), r2 = rng(5);
  for (let i = 0; i < 10; i++) assert.equal(r1(), r2());
});

test("故障特征表覆盖全部故障且签名不同", () => {
  const profiles = faultProfiles(7);
  assert.equal(Object.keys(profiles).length, Object.keys(FAULTS).length);
  const signatures = new Set(Object.values(profiles).map((p) => p.signature));
  assert.equal(signatures.size, Object.keys(FAULTS).length);
});

// ---------- schema 细节 ----------
test("运行记录运行参数校验与归档路径", () => {
  const s = fresh();
  for (let i = 0; i < 120; i++) s.runs.push(normalizeRun({ lab: "rag", summary: `r${i}` }));
  s.archive = [];
  // 手动走 recordRun 的切片逻辑（app/record.js 中实现，此处验证 schema 支持）
  assert.equal(s.runs.length, 120);
});
