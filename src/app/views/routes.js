// 课程目录：方向筛选 + 全文搜索（课程/知识点/步骤/资源）+ 无结果引导。
import * as S from "../state.js";
import { esc, icon, sectionHead, button, emptyState } from "../ui.js";
import { courses, tracks, courseSearchEntries } from "../../content/index.js";
import { go } from "../router.js";

export const filters = { track: "all", query: "" };

export function render() {
  const selected = filters.track === "all" ? null : filters.track;
  return `${sectionHead(
    "LEARNING PATHS",
    "找到起点，也看见远方。",
    "公共基础 → 方向实践 → 独立项目 → 研究探索。课程始终开放，按需补学。",
  )}
<div class="route-banner"><div><span class="pill">推荐方向 · ${esc(tracks[S.getState().goal])}</span><h2>先理解，再带着问题动手。</h2><p>打开课程查看先修。实验通过的课程会显示证据状态。</p></div>${icon("map")}</div>
<div class="toolbar">
  <div class="tabs" role="group" aria-label="课程方向">
    ${Object.entries(tracks).map(([id, t]) => `<button data-filter="${id}" class="tab ${filters.track === id ? "selected" : ""}" aria-pressed="${filters.track === id}">${esc(t)}</button>`).join("")}
  </div>
  <label class="search-field">${icon("search")}<input id="course-search" value="${esc(filters.query)}" aria-label="搜索课程" placeholder="搜索 RAG、坐标、微调、知识编辑…"></label>
</div>
<div id="course-results">${courseResults()}</div>`;
}

export function courseResults() {
  const q = filters.query.toLowerCase().trim();
  let items;
  if (q) {
    // 全文搜索：标题/标签/成果/正文/资源
    const entries = courseSearchEntries();
    const matched = new Map();
    for (const e of entries) {
      const hay = `${e.title} ${e.text}`.toLowerCase();
      if (hay.includes(q)) {
        const score = (e.type === "course" ? 3 : e.type === "topic" ? 2 : 1) + (e.title.toLowerCase().includes(q) ? 2 : 0);
        matched.set(e.id, { e, score });
      }
    }
    const sorted = [...matched.values()].sort((a, b) => b.score - a.score);
    if (!sorted.length)
      return emptyState(
        `暂时没有找到“${esc(filters.query)}”`,
        "试试“推理”“Agent”“坐标”“水印”，或清空筛选浏览全部课程。",
        button("清空筛选", "clear-search"),
      );
    return `<div class="search-meta muted">找到 ${sorted.length} 条相关内容</div><div class="course-grid">${sorted.slice(0, 24).map(({ e }) => searchCard(e)).join("")}</div>`;
  }
  items = courses.filter((c) => filters.track === "all" || c.track === filters.track);
  return `<div class="course-grid">${items.map(courseCard).join("")}</div>`;
}

function courseCard(c) {
  const p = S.progressFor(c.id);
  const status = p.reviewed ? "已复核" : p.experimentPassed ? "实验通过" : p.read ? "✓ 已读" : `约 ${c.minutes?.value ?? 40} 分钟`;
  return `<article class="course-card">
    <div class="card-meta"><span class="pill">${esc(tracks[c.track])}</span><span class="${p.read ? "success-text" : "muted"}">${status}</span></div>
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.outcome)}</p>
    <div class="tags">${(c.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}</div>
    <div class="card-foot"><span>${c.lab ? "含互动实验" : c.track === "research" ? "研究专题指南" : "外部实践对照"}</span><button class="text-button" data-course="${c.id}">进入课程 ${icon("arrow")}</button></div>
  </article>`;
}

function searchCard(e) {
  const typeLabel = { course: "课程", topic: "知识点", resource: "资料", step: "课程章节", project: "项目" }[e.type] || e.type;
  const [page, id, extra] = e.route.split("/");
  return `<article class="course-card">
    <div class="card-meta"><span class="pill">${typeLabel}</span></div>
    <h3>${esc(e.title)}</h3>
    <p>${esc(String(e.text).slice(0, 120))}</p>
    <div class="card-foot"><span class="muted">返回路径：${esc(page)}${id ? ` / ${esc(id)}` : ""}</span><button class="text-button" data-route="${esc(e.route)}">打开 ${icon("arrow")}</button></div>
  </article>`;
}

export function bind(root, rerenderResults) {
  root.querySelectorAll("[data-filter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      filters.track = btn.dataset.filter;
      rerenderResults();
    }),
  );
  root.querySelectorAll("[data-course]").forEach((btn) =>
    btn.addEventListener("click", () => go("course", btn.dataset.course, "0")),
  );
  root.querySelectorAll("[data-route]").forEach((btn) =>
    btn.addEventListener("click", () => go(...btn.dataset.route.split("/"))),
  );
  const search = root.querySelector("#course-search");
  search?.addEventListener("input", () => {
    filters.query = search.value;
    rerenderResults();
  });
  root.querySelector('[data-action="clear-search"]')?.addEventListener("click", () => {
    filters.query = "";
    filters.track = "all";
    rerenderResults();
  });
}
