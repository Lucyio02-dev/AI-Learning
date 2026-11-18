// 实验室索引 + 活跃/归档运行历史：统一检索、筛选与渐进加载。
import * as S from "../state.js";
import { esc, icon, pill, sectionHead, fmtTime } from "../ui.js";
import { labInfo } from "../../content/index.js";
import { historyPage, HISTORY_PAGE_SIZE } from "../history.js";

const historyFilter = { query: "", lab: "all", scope: "all", limit: HISTORY_PAGE_SIZE };

export function render() {
  const s = S.getState();
  return `${sectionHead("LEARN BY DOING", "让每一次尝试，都有反馈。", "先预测，后观察。保留失败，找到证据。")}
<div class="lab-grid">${Object.entries(labInfo).map(([id, l], i) => labCard(id, l, i)).join("")}</div>
<section class="panel history">
  <h2>实验记录 <span class="muted">${s.runs.length} 条活跃 + ${s.archive.length} 条归档</span></h2>
  <div class="history-controls">
    <label class="search-field">${icon("search")}<input id="history-search" value="${esc(historyFilter.query)}" placeholder="搜索 ID、摘要、实验或证据文本"></label>
    <label>实验<select id="history-lab">
      <option value="all">全部实验</option>
      ${Object.entries(labInfo).map(([id, lab]) => `<option value="${esc(id)}" ${historyFilter.lab === id ? "selected" : ""}>${esc(lab.title)}</option>`).join("")}
    </select></label>
    <label>范围<select id="history-scope">
      <option value="all" ${historyFilter.scope === "all" ? "selected" : ""}>活跃 + 归档</option>
      <option value="active" ${historyFilter.scope === "active" ? "selected" : ""}>仅活跃</option>
      <option value="archive" ${historyFilter.scope === "archive" ? "selected" : ""}>仅归档</option>
    </select></label>
  </div>
  <div id="history-results">${historyResults(s)}</div>
</section>`;
}

function historyResults(s) {
  const page = historyPage(s.runs, s.archive, historyFilter);
  const rows = page.items.length
    ? page.items.map((run) => runRow(run)).join("")
    : '<div class="empty"><p>没有匹配的运行记录。清空搜索或切换范围后再试。</p></div>';
  return `<p class="history-count" id="history-count">显示 ${page.items.length} / ${page.total} 条；共 ${page.counts.active} 条活跃、${page.counts.archive} 条归档。</p>
    ${rows}
    ${page.hasMore ? `<button class="secondary" type="button" data-history-more>再显示 ${Math.min(HISTORY_PAGE_SIZE, page.total - page.items.length)} 条</button>` : ""}`;
}

function runRow(r) {
  const verdict = r.passed === true ? "验证通过" : r.passed === false ? "探索记录" : "运行记录";
  return `<details class="history-row" data-run-id="${esc(r.id)}"><summary><span class="pill ${r.passed === true ? "success" : ""}">${verdict}</span> ${esc(labInfo[r.lab]?.title || r.lab || "")} <span class="muted">${fmtTime(r.time)}</span>${r.mode ? pill(modeLabel(r.mode), "dark") : ""}</summary>
  <p>${esc(r.summary || "")}</p>
  ${r.config ? `<strong>配置</strong><pre>${esc(JSON.stringify(r.config, null, 2))}</pre>` : ""}
  ${r.metrics ? `<strong>指标</strong><pre>${esc(JSON.stringify(r.metrics, null, 2))}</pre>` : ""}
  ${(r.artifacts || []).length ? `<strong>产物</strong><ul>${r.artifacts.map((a) => `<li>${esc(a.name || a.path || JSON.stringify(a))}${a.url ? ` · <a href="${esc(a.url)}" target="_blank" rel="noreferrer">打开 ↗</a>` : ""}</li>`).join("")}</ul>` : ""}
  <pre>${esc(typeof r.evidence === "string" ? r.evidence : JSON.stringify(r.evidence, null, 2))}</pre>
  <button class="text-button" data-lab="${esc(r.lab)}">再次探索 →</button></details>`;
}

const modeLabel = (m) =>
  ({ rule: "规则", "local-compute": "本地计算", model: "真实模型", sim: "仿真", train: "训练" }[m] || m);

function labCard(id, l, i) {
  return `<button class="lab-card" data-lab="${id}"><div class="lab-card-top"><span class="lab-symbol tone-${i}">${icon(["sun", "search", "project", "map"][i])}</span><span class="lab-number">LAB / 0${i + 1}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.subtitle)}</p><div class="lab-card-bottom"><span>${esc(l.kind)}</span>${icon("arrow")}</div></button>`;
}

export function bind(root) {
  // data-lab 由应用级事件委托处理，动态加载的历史行也可直接再次探索。
  const results = root.querySelector("#history-results");
  const paint = () => {
    if (!results) return;
    results.innerHTML = historyResults(S.getState());
  };
  root.querySelector("#history-search")?.addEventListener("input", (e) => {
    historyFilter.query = e.target.value;
    historyFilter.limit = HISTORY_PAGE_SIZE;
    paint();
  });
  root.querySelector("#history-lab")?.addEventListener("change", (e) => {
    historyFilter.lab = e.target.value;
    historyFilter.limit = HISTORY_PAGE_SIZE;
    paint();
  });
  root.querySelector("#history-scope")?.addEventListener("change", (e) => {
    historyFilter.scope = e.target.value;
    historyFilter.limit = HISTORY_PAGE_SIZE;
    paint();
  });
  results?.addEventListener("click", (e) => {
    if (!e.target.closest("[data-history-more]")) return;
    historyFilter.limit += HISTORY_PAGE_SIZE;
    paint();
  });
}
