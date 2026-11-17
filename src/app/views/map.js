// 学习地图：先修关系 + 当前位置 + 已学 + 待补 + 能力证据；等价文字列表。
import * as S from "../state.js";
import { esc, icon, sectionHead } from "../ui.js";
import { go } from "../router.js";
import { courses, tracks, getCourse } from "../../content/index.js";

const TRACK_ORDER = ["common", "llm", "embodied", "research"];

export function render() {
  const s = S.getState();
  const selected = s.goal;
  const rank = (c) => (selected === "research" && c.track === "llm" ? 1 : c.track === "common" ? 0 : c.track === selected ? 1 : c.track === "llm" && selected === "embodied" ? 1 : 2);
  const ordered = [...courses].sort((a, b) => rank(a) - rank(b) || a.prerequisites.length - b.prerequisites.length);

  const nodes = ordered
    .map((c) => {
      const p = s.progress[c.id] || {};
      const status = p.reviewed ? "reviewed" : p.experimentPassed ? "experiment" : p.exercisePassed ? "exercise" : p.read ? "read" : "todo";
      const nextUses = courses.filter((x) => x.prerequisites.includes(c.id)).map((x) => x.title);
      return `<div class="map-node status-${status}" data-course="${c.id}" role="button" tabindex="0" aria-label="${esc(c.title)}，${statusLabel(status)}">
        <div class="map-node-head"><strong>${esc(c.title)}</strong><span class="map-status">${statusLabel(status)}</span></div>
        <div class="map-node-meta"><span class="pill">${esc(tracks[c.track])}</span>${p.read ? "" : `<span class="muted">约 ${c.minutes?.value ?? 40} 分钟</span>`}</div>
        <div class="map-node-links">
          ${c.prerequisites.length ? `<small>先修：${c.prerequisites.map((id) => `<button class="text-button" data-course="${esc(id)}">${esc(getCourse(id)?.title || id)}</button>`).join("、")}</small>` : "<small>无需先修</small>"}
          ${nextUses.length ? `<small>后续：${esc(nextUses.slice(0, 3).join("、"))}${nextUses.length > 3 ? " 等" : ""}</small>` : ""}
          ${(p.evidence || []).length ? `<small>证据：${p.evidence.length} 条实验记录</small>` : ""}
        </div>
      </div>`;
    })
    .join("");

  const todo = ordered.filter((c) => !s.progress[c.id]?.read && rank(c) < 2);
  const learned = ordered.filter((c) => s.progress[c.id]?.read);

  return `${sectionHead(
    "LEARNING MAP",
    "看得见起点，也看得见远方。",
    "绿=已读 · 蓝=实验通过 · 金=已复核。点击节点进入课程；先修与后续用途随节点展示。",
  )}
<div class="map-legend" role="list">
  <span role="listitem"><i class="dot todo"></i>未开始</span>
  <span role="listitem"><i class="dot read"></i>已读</span>
  <span role="listitem"><i class="dot experiment"></i>实验通过</span>
  <span role="listitem"><i class="dot reviewed"></i>已复核</span>
</div>
<div class="map-grid">${nodes}</div>
<div class="lower-grid">
  <section class="panel"><h3>已学（${learned.length}）</h3>${learned.length ? `<ul class="text-list">${learned.map((c) => `<li><button class="text-button" data-course="${c.id}">${esc(c.title)}</button></li>`).join("")}</ul>` : '<p class="muted">还没有已读课程。首页的“下一步”是最省力的入口。</p>'}</section>
  <section class="panel"><h3>待补（${todo.length}）</h3>${todo.length ? `<ul class="text-list">${todo.map((c) => `<li><button class="text-button" data-course="${c.id}">${esc(c.title)}</button><small class="muted">${esc(tracks[c.track])}</small></li>`).join("")}</ul>` : '<p class="muted">推荐路径全部完成，试试研究专题或项目空间。</p>'}</section>
</div>
<p class="caption">课程顺序只是推荐：任何课程都可以直接打开，不设强制解锁。实验通过的判定标准见每门课的“独立验证”。</p>`;
}

function statusLabel(status) {
  return { todo: "未开始", read: "已读", exercise: "练习通过", experiment: "实验通过", reviewed: "已复核" }[status] || status;
}

export function bind(root) {
  root.querySelectorAll("[data-course]").forEach((el) => {
    const open = () => go("course", el.dataset.course, "0");
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}
