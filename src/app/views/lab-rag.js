// RAG 诊断实验室：词项基线 vs 真实 embedding 并列、生成与引用核验、
// 故障注入（版本冲突/缺失/截断/gold-evidence）、检索与回答指标分开。
import * as S from "../state.js";
import { esc, icon, button, details, table, loading, errorBox, pill } from "../ui.js";
import { hasBackend, ragQuery } from "../api.js";
import { chunkDocument, corpus, retrieve, evalSet, retrievalHit, gradeAnswer } from "../../labs/term.js";
import { recordRun } from "../record.js";
import { go } from "../router.js";

export function render() {
  const ready = hasBackend();
  return `
<button class="text-button back" data-page="labs">← 返回实验室</button>
<div class="page-heading"><div><span class="eyebrow">EXPERIMENT WORKBENCH</span><h1>RAG 诊断实验室</h1><p>检索有结果，答案就对了吗？沿证据链定位失败环节。</p></div></div>
<div class="experiment-info">
  <span class="pill">${ready ? "词项基线 + 真实 embedding（bge-small-zh）+ 可选生成" : "词项基线（浏览器本地）"}</span>
  <span>embedding 由本地后端 CPU 计算；生成需模型密钥，费用在记录中估算</span>
  <button class="text-button" data-course="rag">补学相关原理 ↗</button>
</div>
<div class="experiment-layout">
  <section class="panel experiment-controls">
    <span class="eyebrow">01 / RETRIEVE</span>
    <h2>检索有结果，答案就对了吗？</h2>
    <label for="r-query">查询问题</label>
    <input id="r-query" value="选课课程退选截止时间">
    <label for="r-k">取回条数 Top-K</label>
    <select id="r-k"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>6</option></select>
    <label for="r-chunk">分块大小 / 重叠（重建索引）</label>
    <div class="control-pair">
      <select id="r-chunk"><option>80</option><option selected>200</option><option>400</option></select>
      <select id="r-overlap"><option>0</option><option selected>40</option><option>100</option></select>
    </div>
    <label for="r-mode">检索方式</label>
    <select id="r-mode">
      <option value="both" ${ready ? "selected" : "disabled"}>词项基线 + embedding 对照（推荐）</option>
      <option value="term" ${ready ? "" : "selected"}>仅词项基线（纯浏览器）</option>
      <option value="embedding" ${ready ? "" : "disabled"}>仅 embedding</option>
    </select>
    <div class="control-pair">
      <label class="check-row"><input id="r-current" type="checkbox">只检索当前版本</label>
      <label class="check-row"><input id="r-missing" type="checkbox">注入故障：移除正确资料</label>
    </div>
    <div class="control-pair">
      <label class="check-row"><input id="r-trunc" type="checkbox">注入故障：上下文截断</label>
      <label class="check-row"><input id="r-gen" type="checkbox" ${ready ? "" : "disabled"}>调用模型生成回答（检查引用 ID）</label>
    </div>
    <label for="r-diagnosis">诊断：这个配置最大的风险是什么？</label>
    <select id="r-diagnosis">
      <option value="version">旧版与当前规定混合</option>
      <option value="missing">正确证据缺失，应补充资料</option>
      <option value="grounding">已筛选版本，仍需核验引用与答案</option>
    </select>
    <label class="check-row"><input id="r-gold" type="checkbox">人工指定正确证据（区分检索失败 vs 生成失败）</label>
    <div class="control-pair">
      <div><label for="r-gold-doc">指定证据文档</label><select id="r-gold-doc"><option value="current">当前学期选课指南</option><option value="archive">旧版选课说明</option><option value="library">图书馆</option><option value="lab">实验室预约</option></select></div>
    </div>
    <details class="fold"><summary>自选资料导入（受控，仅本机）</summary><div class="fold-body">
      <label for="r-custom">粘贴你的资料（每段一条，用空行分隔；仅保存在本机，不发送到模型服务——生成引用时只会发送检索命中的片段）</label>
      <textarea id="r-custom" rows="4" placeholder="我的课程规定：退选截止时间为……">${esc(customCorpusText())}</textarea>
      <label class="check-row"><input id="r-use-custom" type="checkbox" ${customCorpusText() ? "checked" : ""}>把自选资料并入检索范围</label>
      <small class="muted">自选资料会参与所选检索方式；首次向量检索或资料/分块参数变化时会在本机后端重建索引。</small>
    </div></details>
    <div class="stack">
      ${button("检索并查看证据", "run-rag", "primary full")}
      ${button("运行标注评测集（8 题）", "run-rag-eval", "secondary full")}
    </div>
    <p class="caption">词项检索实际运行于本页；embedding 由本地模型计算。演示语料为 6 份校园材料，其中新旧两版选课规定用于版本冲突教学。</p>
  </section>
  <section class="panel experiment-output">
    <div class="section-title"><h2>观察与证据</h2><span class="live-label">检索 · 上下文 · 引用可全部查看</span></div>
    <div id="output" aria-live="polite"><div class="output-empty">${icon("lab")}<h3>先做预测，再运行检索。</h3><p>两条检索轨道的结果会并列展示，方便对照差异。</p></div></div>
  </section>
</div>
<div class="panel history" id="rag-runs">${runsHistory()}</div>`;
}

function runsHistory() {
  const runs = S.getState().runs.filter((r) => r.lab === "rag").slice(-8).reverse();
  if (!runs.length) return "<h2>本实验的运行记录</h2><p class='muted'>还没有记录。</p>";
  return `<h2>本实验的运行记录</h2>${runs.map((r) => details(
    `<span class="pill ${r.passed ? "success" : ""}">${r.passed === true ? "通过" : r.passed === false ? "保留" : "记录"}</span> ${esc(r.summary || "")}`,
    `<pre>${esc(typeof r.evidence === "string" ? r.evidence : JSON.stringify(r.evidence, null, 2))}</pre>`,
  )).join("")}`;
}

function chunked(size, overlap) {
  const useCustom = document.querySelector("#r-use-custom")?.checked;
  const base = corpus.flatMap((d) => chunkDocument(d, { size: Number(size), overlap: Number(overlap) }));
  if (!useCustom) return base;
  const custom = parseCustomCorpus();
  return [...base, ...custom.flatMap((d) => chunkDocument(d, { size: Number(size), overlap: Number(overlap) }))];
}

// 自选资料（受控导入）：localStorage 持久化，仅本机。
const CUSTOM_KEY = "ai-learning-rag-custom-corpus";
export function parseCustomCorpus() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((d) => d && d.id && d.text) : [];
  } catch {
    return [];
  }
}
export function customCorpusText() {
  return parseCustomCorpus().map((d) => d.text).join("\n\n");
}
export function saveCustomCorpus(text) {
  const docs = String(text || "")
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((t, i) => ({
      id: `custom-${i + 1}`,
      title: `自选资料 ${i + 1}`,
      date: new Date().toISOString().slice(0, 10),
      version: "user",
      current: true,
      text: t.slice(0, 2000),
    }));
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(docs));
  } catch {}
  return docs.length;
}

export async function run(root) {
  const out = root.querySelector("#output");
  const query = root.querySelector("#r-query").value.trim() || "选课课程退选截止时间";
  const topK = Number(root.querySelector("#r-k").value);
  const chunkSize = Number(root.querySelector("#r-chunk").value);
  const overlap = Math.min(Number(root.querySelector("#r-overlap").value), Math.floor(chunkSize / 2));
  const mode = root.querySelector("#r-mode").value;
  const currentOnly = root.querySelector("#r-current").checked;
  const missing = root.querySelector("#r-missing").checked;
  const truncation = root.querySelector("#r-trunc").checked;
  const generate = root.querySelector("#r-gen").checked && hasBackend();
  const diagnosis = root.querySelector("#r-diagnosis").value;
  // 自选资料先落盘（受控导入：仅本机）
  const customText = root.querySelector("#r-custom")?.value ?? "";
  const customCount = saveCustomCorpus(customText);
  const customCorpus = root.querySelector("#r-use-custom")?.checked ? parseCustomCorpus() : [];
  const goldOn = root.querySelector("#r-gold")?.checked;
  const goldDoc = root.querySelector("#r-gold-doc")?.value || "current";
  const goldEvidence = goldOn
    ? chunked(chunkSize, overlap).filter((c) => c.docId === goldDoc).slice(0, 1)
    : null;
  out.innerHTML = loading("检索中" + (generate ? "（含生成与引用 ID 检查）" : "") + "…");

  try {
    if (mode === "term" && !goldEvidence && !generate) {
      // 纯浏览器词项检索
      const chunks = chunked(chunkSize, overlap);
      const docs = retrieve(query, { topK, currentOnly, missing, chunks });
      renderTermResult(root, { query, topK, chunkSize, overlap, currentOnly, missing, truncation }, docs, diagnosis);
      return;
    }
    if (mode === "term" && goldEvidence && !generate) {
      // gold-evidence 对照（词项基线轨道）：跳过检索直接用人工证据
      const res = { results: { embedding: [], term: goldEvidence }, context: truncateContext(goldEvidence, truncation), metrics: { gold: [], retrievalHitEmbedding: null, retrievalHitTerm: null }, params: { goldEvidence: true }, generation: null };
      renderServerResult(root, res, diagnosis, { topK, chunkSize, overlap, mode, currentOnly, missing, truncation, generate, gold: true });
      return;
    }
    const res = await ragQuery({ query, topK, chunkSize, overlap, mode, currentOnly, missing, truncation, generate, goldEvidence, customCorpus });
    renderServerResult(root, res, diagnosis, { topK, chunkSize, overlap, mode, currentOnly, missing, truncation, generate, gold: !!goldEvidence });
  } catch (error) {
    out.innerHTML = errorBox(error.message, error.code);
    if (error.code !== "E_MODEL_NO_BACKEND")
      recordRun({ lab: "rag", mode: "local-compute", summary: `检索失败：${error.message}`, passed: false, evidence: { error: error.message, code: error.code } });
    refreshHistory(root);
  }
}

function renderTermResult(root, params, docs, diagnosis) {
  const out = root.querySelector("#output");
  const goldIds = ["current#c1"];
  const passed = docs.some((d) => goldIds.includes(d.id)) && diagnosisMatches(diagnosis, params);
  const context = truncateContext(docs, params.truncation);
  out.innerHTML = `
    ${params.truncation ? `<div class="feedback"><strong>故障已注入：实际上下文截断</strong><p>检索结果保留在上方；下面展示交给后续生成环节的上下文。</p></div>` : ""}
    ${docs.length
      ? docs.map((d) => `<article class="evidence-card"><div class="card-meta"><span class="pill ${d.current ? "success" : ""}">${d.current ? "当前资料" : "历史资料"}</span><span>匹配分 ${d.score}</span></div><h3>${esc(d.title)}</h3><small>${esc(d.date)} · ${esc(d.id)} · 版本 ${esc(d.version)}</small><p>${esc(d.text)}</p></article>`).join("")
      : '<div class="empty"><h3>没有召回证据</h3><p>检查查询、索引与资料覆盖，不能据此编造答案。</p></div>'}
    ${details("实际上下文（本地模拟）", `<pre>${esc(context.map((c) => `[${c.id}] ${c.title} (${c.date})\n${c.text}`).join("\n\n") || "（无检索结果）")}</pre>`)}
    <div class="feedback ${passed ? "pass" : ""}"><strong>${passed ? "诊断通过" : "继续检查证据"}</strong><p>${feedbackText(params)}</p>${!docs.length ? "<p>当前查询无证据，未计为验证通过。</p>" : ""}</div>`;
  recordRun({
    lab: "rag", mode: "rule", summary: passed ? "依据检索证据完成诊断" : "完成检索，继续诊断", passed,
    evidence: { ...params, diagnosis, documents: docs }, config: params,
    statuses: { diagnosed: passed, verified: false },
  });
  refreshHistory(root);
}

function truncateContext(context, enabled) {
  if (!enabled || !context.length) return context;
  return context.length > 1
    ? context.slice(0, -1)
    : [{ ...context[0], text: context[0].text.slice(0, Math.floor(context[0].text.length / 2)) }];
}

function diagnosisMatches(diagnosis, params) {
  return diagnosis === (params.missing ? "missing" : params.currentOnly ? "grounding" : "version");
}

function feedbackText(params) {
  if (params.missing)
    return "正确资料已被移除——调大 Top-K 也找不回不存在的资料，应补充来源。这就是“数据缺失”类失败。";
  if (params.currentOnly)
    return "已按版本过滤，检索成功后仍要核验引用与回答——“上下文/生成”类失败与检索无关。";
  return "资料同时包含新旧版本，必须先确认适用学期，不能简单采用第一条——这是“版本冲突”类失败。";
}

function renderServerResult(root, res, diagnosis, params) {
  const out = root.querySelector("#output");
  const emb = res.results.embedding || [];
  const term = res.results.term || [];
  const both = params.mode === "both" && !params.gold;
  const passed = params.gold
    ? null
    : diagnosisMatches(diagnosis, params) && (emb.length ? res.metrics.retrievalHitEmbedding === 1 : res.metrics.retrievalHitTerm === 1);
  const goldBanner = params.gold
    ? `<div class="callout"><strong>gold-evidence 对照：人工正确证据已直接提供给生成环节</strong><p>若回答恢复正常 → 原失败在检索环节；若仍错误 → 检查上下文构造、指令与模型能力。这是定位失败环节的标准方法。</p></div>`
    : "";
  const chunkCard = (d, tag) => `<article class="evidence-card"><div class="card-meta"><span class="pill ${d.current ? "success" : ""}">${d.current ? "当前" : "历史"}${tag}</span><span>${d.score != null ? `分数 ${d.score}` : ""}</span></div><h3>${esc(d.title)}</h3><small>${esc(d.date || "")} · ${esc(d.id)}</small><p>${esc(d.text)}</p></article>`;

  let generationHtml = "";
  if (res.generation) {
    const g = res.generation;
    generationHtml = `
      <h3>生成回答与引用 ID 检查</h3>
      <div class="answer-card">
        <p>${esc(g.text)}</p>
        <div class="citation-strip">
          ${g.citations.length
            ? g.citations.map((c) => pill(g.validCitations.includes(c) ? `${c} ✓ 有效` : `${c} ✗ 上下文中不存在`, g.validCitations.includes(c) ? "success" : "")).join(" ")
            : pill("无引用标注", "")}
        </div>
        <small class="muted">此处只检查引用 ID 是否出现在模型上下文；事实是否被该片段支持，需要你阅读下方原文后判断。</small>
        <small class="muted">${esc(g.model)} · ${g.elapsedMs}ms · ${g.usage?.total_tokens ?? "?"} tokens · 费用估算 ${g.costEstimate ? `${g.costEstimate.amount} ${g.costEstimate.currency}` : "—"}（${g.costEstimate?.basis || "estimate"}）</small>
        ${g.citationOk || g.refusal ? "" : `<div class="feedback"><strong>注意：回答没有有效引用 ID，也没有拒答</strong><p>引用检查只确认 ID 在上下文中存在；是否支持对应事实仍需阅读下方上下文逐条核对。</p></div>`}
      </div>
      ${details("查看实际请求 Prompt", `<pre>${esc(g.request || "见后端日志")}</pre>`)}`;
  }

  out.innerHTML = `
    ${goldBanner}
    <h3>检索对照</h3>
    ${res.metrics.gold.length ? `<div class="metric-strip"><div><span>检索命中（embedding / 词项）</span><strong>${res.metrics.retrievalHitEmbedding ?? "—"} / ${res.metrics.retrievalHitTerm ?? "—"}</strong></div><div><span>正确块</span><strong>${esc(res.metrics.gold.join(" "))}</strong></div></div>` : ""}
    ${both ? `<div class="control-pair"><div>${details("词项基线结果", term.length ? term.map((d) => chunkCard(d, "·词项")).join("") : "<p class='muted'>无召回</p>")}</div><div>${details("embedding 结果", emb.length ? emb.map((d) => chunkCard(d, "·向量")).join("") : "<p class='muted'>无召回</p>")}</div></div>`
      : (emb.length ? emb : term).map((d) => chunkCard(d, "")).join("") || '<div class="empty"><h3>没有召回证据</h3><p>检查查询、索引与资料覆盖。</p></div>'}
    ${details(params.generate ? "发给模型的实际上下文" : "实际上下文（本地模拟）", `<pre>${esc((res.context || []).map((c) => `[${c.id}] ${c.title} (${c.date})\n${c.text}`).join("\n\n") || "（无检索结果）")}</pre>`)}
    ${params.truncation ? `<div class="feedback"><strong>故障已注入：上下文截断</strong><p>正确证据可能被挤掉——对照上面检索结果与实际上下文的差异。</p></div>` : ""}
    ${generationHtml}
    <div class="feedback ${passed ? "pass" : ""}"><strong>${passed ? "诊断通过" : "继续检查证据"}</strong><p>${feedbackText(params)}</p></div>`;
  recordRun({
    lab: "rag", mode: params.generate ? "model" : "local-compute",
    summary: `${params.mode} 检索${params.generate ? " + 生成" : ""}${params.missing ? "（缺失注入）" : params.currentOnly ? "（版本过滤）" : ""}`,
    passed,
    evidence: { params: res.params, metrics: res.metrics, embedding: emb.map(({ id, score }) => ({ id, score })), term: term.map(({ id, score }) => ({ id, score })), generation: res.generation ? { text: res.generation.text, citations: res.generation.citations, valid: res.generation.validCitations } : null },
    config: { ...res.params, indexModel: "bge-small-zh-v1.5", dim: 512 },
    metrics: res.metrics,
    statuses: { diagnosed: passed, verified: false },
  });
  refreshHistory(root);
}

// ---------- 标注评测集 ----------
export async function runEval(root) {
  const out = root.querySelector("#output");
  if (!hasBackend()) {
    // 纯浏览器：词项基线跑评测
    const rows = evalSet.map((item) => {
      const chunks = chunked(200, 40);
      const docs = retrieve(item.question, { topK: 3, chunks });
      const hit = retrievalHit(docs, item.gold);
      const answer = docs.length ? `[${docs[0].id}] ${docs[0].text}` : "";
      return { ...item, hit, answer, grade: gradeAnswer(answer, item) };
    });
    renderEval(root, rows, "词项基线");
    return;
  }
  out.innerHTML = loading("运行 embedding 检索评测（8 题）…");
  try {
    const rows = [];
    for (const item of evalSet) {
      const res = await ragQuery({ query: item.question, topK: 3, mode: "embedding" });
      const hit = res.metrics.gold.length ? res.metrics.retrievalHitEmbedding : null;
      rows.push({ ...item, hit, answer: res.results.embedding[0]?.text || "", grade: hit === null ? "no-gold" : hit === 1 ? "hit" : "miss" });
    }
    renderEval(root, rows, "embedding");
  } catch (error) {
    out.innerHTML = errorBox(error.message, error.code);
  }
}

function renderEval(root, rows, kind) {
  const out = root.querySelector("#output");
  const hits = rows.filter((r) => r.hit !== null);
  const hitRate = hits.length ? Math.round((hits.filter((r) => r.hit === 1).length / hits.length) * 100) : 0;
  const noGold = rows.filter((r) => r.hit === null);
  out.innerHTML = `
    <h3>检索评测（${kind}）</h3>
    ${table(["问题", "正确块", "检索", "Top-1 内容"], rows.map((r) => `<tr><td>${esc(r.question)}</td><td>${esc(r.gold.join(", ") || "应拒答")}</td><td>${r.hit === null ? pill("无正确块", "dark") : r.hit === 1 ? pill("命中", "success") : pill("未命中")}</td><td class="pre-cell">${esc(String(r.answer).slice(0, 80))}</td></tr>`))}
    <div class="metric-strip"><div><span>命中率</span><strong>${hitRate}%</strong></div><div><span>应拒答题</span><strong>${noGold.length}</strong></div></div>
    <div class="callout"><strong>指标分开的意义</strong><p>这里评的是“检索”指标（正确证据是否出现在 Top-K）。回答指标（有据/编造）需要在生成开启后另行评分，两者不可互相替代。</p></div>
    <p class="caption">u* 开头编号为未见样例，调试时不要使用。</p>`;
  recordRun({
    lab: "rag", mode: hasBackend() ? "local-compute" : "rule",
    summary: `检索评测（${kind}）：命中 ${hitRate}%`,
    passed: hitRate >= 75,
    evidence: { rows: rows.map(({ id, question, gold, hit }) => ({ id, question, gold, hit })) },
    metrics: { hitRate, questions: rows.length, unseen: rows.filter((r) => r.unseen).length },
    statuses: { diagnosed: hitRate >= 75, verified: false },
  });
  refreshHistory(root);
}

function setOutput(root, html) { root.querySelector("#output").innerHTML = html; }
function refreshHistory(root) {
  const el = root.querySelector("#rag-runs");
  if (el) el.innerHTML = runsHistory();
}

export function bind(root) {
  root.querySelector('[data-action="run-rag"]')?.addEventListener("click", () => run(root));
  root.querySelector('[data-action="run-rag-eval"]')?.addEventListener("click", () => runEval(root));
  root.querySelector('[data-course="rag"]')?.addEventListener("click", () => go("course", "rag", "0"));
}
