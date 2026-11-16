// RAG 服务：真实 embedding 检索（持久 Python 进程）+ 词项基线 +
// 引用核验的生成。词项基线在前端也可独立运行；此处统一服务端实现。
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { nowIso, uuid } from "./util.js";
import { chat } from "./llm.js";
import { DATA_DIR } from "./tasks.js";

const ROOT = resolve(import.meta.dirname, "../..");
const RAG_DIR = join(DATA_DIR, "rag");

// 与前端 src/labs/term.js 相同的内置语料 + 版本冲突演示资料。
const BUILTIN_CORPUS = [
  { id: "archive", title: "旧版选课说明", date: "2024-09-01", version: "2024", current: false, text: "选课课程退选截止时间为开课后第二周周日。旧版规定，仅供历史查询。" },
  { id: "current", title: "当前学期选课指南", date: "2026-09-01", version: "2026", current: true, text: "选课课程退选截止时间为开课后第一周周五 17:00。适用于当前学期。" },
  { id: "library", title: "图书馆开放安排", date: "2026-09-01", version: "2026", current: true, text: "图书馆工作日开放至 22:00，节假日安排以公告为准。" },
  { id: "lab", title: "实验室预约说明", date: "2026-09-01", version: "2026", current: true, text: "实验室预约需提前一天，预约失败后可查询可用时间段。" },
  { id: "clinic", title: "校医院就诊须知", date: "2026-09-01", version: "2026", current: true, text: "校医院工作日 8:00-17:00 接诊，急诊请前往市医院。" },
  { id: "scholarship", title: "奖学金评定细则", date: "2026-09-01", version: "2026", current: true, text: "奖学金评定每年九月启动，综合绩点与实践分各占百分之五十。" },
];

const GOLD = {
  "选课课程退选截止时间": ["current#c1"],
  "图书馆几点关门": ["library#c1"],
  "实验室预约要提前多久": ["lab#c1"],
};

function chunkDocs(docs, size, overlap) {
  const chunks = [];
  for (const doc of docs) {
    const step = Math.max(1, size - overlap);
    let i = 1, n = 0;
    for (; i <= doc.text.length; i += step) {
      const piece = doc.text.slice(i - 1, i - 1 + size);
      if (!piece) break;
      n++;
      chunks.push({
        id: `${doc.id}#c${n}`, docId: doc.id, title: doc.title,
        version: doc.version, current: doc.current, date: doc.date, text: piece,
      });
    }
  }
  return chunks;
}

// 持久 embedding 进程管理：懒启动，崩溃自动重启一次。
let embProc = null;
let embReady = false;
let embIndexKey = "";

async function ensureEmbedder(indexKey, indexDir) {
  if (embProc && embIndexKey === indexKey && embReady) return;
  if (embProc) {
    embProc.kill();
    embProc = null;
    embReady = false;
  }
  await mkdir(indexDir, { recursive: true });
  const vectorsPath = join(indexDir, "vectors.json");
  let meta = null;
  try {
    meta = JSON.parse(await readFile(join(indexDir, "meta.json"), "utf8"));
  } catch {
    const corpusPath = join(RAG_DIR, "corpus.jsonl");
    const docs = BUILTIN_CORPUS;
    await writeFile(corpusPath, docs.map((d) => JSON.stringify(d)).join("\n"));
    await new Promise((done, fail) => {
      const proc = spawn("python", [
        resolve(ROOT, "experiments/rag_embed.py"), "index",
        "--input", corpusPath, "--out", indexDir,
      ], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
      let tail = "";
      proc.stderr.on("data", (d) => (tail += d));
      proc.on("close", (code) => (code === 0 ? done() : fail(new Error(`索引构建失败(${code})：${tail.slice(-500)}`))));
    });
    meta = JSON.parse(await readFile(join(indexDir, "meta.json"), "utf8"));
    meta.buildLog = { builtAt: meta.builtAt, elapsedS: meta.elapsedS, model: meta.model };
  }
  embProc = spawn("python", [
    resolve(ROOT, "experiments/rag_embed.py"), "serve", "--index", indexDir,
  ], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  embProc.stderr.resume();
  await new Promise((done, fail) => {
    const rl = createInterface(embProc.stdout);
    const timer = setTimeout(() => fail(new Error("embedding 进程启动超时")), 120000);
    rl.once("line", (line) => {
      clearTimeout(timer);
      const msg = JSON.parse(line);
      if (msg.ready) done();
    });
    embProc.once("exit", () => { clearTimeout(timer); fail(new Error("embedding 进程退出")); });
  });
  embReady = true;
  embIndexKey = indexKey;
  embProc.on("exit", () => { embProc = null; embReady = false; });
}

function askEmbedder(payload) {
  return new Promise((done, fail) => {
    if (!embProc || !embReady) return fail(new Error("embedding 进程未就绪"));
    const timer = setTimeout(() => fail(new Error("embedding 查询超时")), 30000);
    const rl = createInterface(embProc.stdout);
    rl.once("line", (line) => {
      clearTimeout(timer);
      rl.close();
      try { done(JSON.parse(line)); } catch (error) { fail(error); }
    });
    embProc.stdin.write(JSON.stringify(payload) + "\n");
  });
}

const termTokens = (text) => {
  const s = text.toLowerCase();
  return [
    ...new Set([
      ...(s.match(/[a-z0-9]+/g) || []),
      ...Array.from(s.matchAll(/[\u4e00-\u9fff]{2}/gu), (m) => m[0]),
      ...Array.from(s.matchAll(/(?=([\u4e00-\u9fff]{2}))/gu), (m) => m[1]),
    ]),
  ];
};

function termRetrieve(query, chunks, { topK, currentOnly, missing }) {
  const q = termTokens(query);
  return chunks
    .filter((d) => (!currentOnly || d.current) && (!missing || d.docId !== "current"))
    .map((d) => ({ ...d, score: q.reduce((n, t) => n + (`${d.title} ${d.text}`).toLowerCase().includes(t), 0) }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, topK);
}

export async function ragQuery({
  query,
  topK = 3,
  chunkSize = 200,
  overlap = 40,
  mode = "embedding", // embedding | term | both
  currentOnly = false,
  missing = false,
  truncation = false,
  generate = false,
  goldEvidence = null, // 人工指定正确证据（诊断用）
}) {
  const indexKey = `builtin-${chunkSize}-${overlap}`;
  const indexDir = join(RAG_DIR, "index-" + indexKey);
  const chunks = chunkDocs(BUILTIN_CORPUS, chunkSize, overlap);
  const retrievedEmbedding = [];
  let indexMeta = null;

  if (mode === "embedding" || mode === "both") {
    if (missing) {
      // 故障注入在请求层做：排除正确文档的 embedding 召回
      await ensureEmbedder(indexKey, indexDir);
      const res = await askEmbedder({
        query, topK: topK + 1, currentOnly, filterIds: missing ? ["current"] : null,
      });
      if (!res.ok) throw new Error(res.error);
      retrievedEmbedding.push(...res.results.slice(0, topK));
      indexMeta = { faultInjected: "missing", note: "已从召回中移除 current 文档" };
    } else {
      await ensureEmbedder(indexKey, indexDir);
      const res = await askEmbedder({ query, topK, currentOnly });
      if (!res.ok) throw new Error(res.error);
      retrievedEmbedding.push(...res.results);
    }
  }
  const termResults = mode === "term" || mode === "both"
    ? termRetrieve(query, chunks, { topK, currentOnly, missing })
    : [];

  const gold = GOLD[query] || [];
  const hit = (results) => (gold.length ? (results.some((r) => gold.includes(r.id)) ? 1 : 0) : null);

  let context = goldEvidence?.length
    ? goldEvidence
    : (mode === "term" ? termResults : retrievedEmbedding);
  if (truncation && context.length > 1)
    context = context.slice(0, Math.max(1, context.length - 1));

  let generation = null;
  if (generate) {
    const contextText = context.length
      ? context.map((c) => `[${c.id}] (${c.title}, ${c.date}) ${c.text}`).join("\n\n")
      : "（无检索结果）";
    const prompt = [
      "你是课程资料助手。只使用下面 <context> 中标注了 [id] 的资料回答问题；",
      "资料未覆盖时明确回答“资料未覆盖该问题”，不得编造。",
      "每个来自资料的信息后标注其 [id]。",
      "",
      `<context>\n${contextText}\n</context>`,
      "",
      `问题：${query}`,
    ].join("\n");
    const llm = await chat({
      messages: [{ role: "user", content: prompt }],
      sampling: { temperature: 0, maxTokens: 300 },
    });
    const cited = [...new Set((llm.text.match(/\[([\w-]+#c\d+)\]/g) || []).map((s) => s.slice(1, -1)))];
    const validCitations = cited.filter((c) => context.some((k) => k.id === c));
    generation = {
      ...llm,
      citations: cited,
      validCitations,
      citationOk: cited.length > 0 && cited.every((c) => validCitations.includes(c)),
      grounded: /\[.*#c\d+\]/.test(llm.text) || /资料未覆盖/.test(llm.text),
      refusal: /资料未覆盖|无法确定|没有找到/.test(llm.text),
      contextUsed: context.map((c) => c.id),
    };
  }

  return {
    query,
    mode,
    params: { topK, chunkSize, overlap, currentOnly, missing, truncation, goldEvidence: !!goldEvidence },
    results: { embedding: retrievedEmbedding, term: termResults },
    context: context.map((c) => ({ id: c.id, title: c.title, text: c.text, version: c.version, date: c.date })),
    metrics: {
      retrievalHitEmbedding: hit(retrievedEmbedding),
      retrievalHitTerm: hit(termResults),
      gold,
    },
    generation,
    time: nowIso(),
  };
}
