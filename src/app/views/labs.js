// 实验室索引 + 全部运行历史（含归档，不再静默截断为 100 条）。
import * as S from "../state.js";
import { esc, icon, details, pill, sectionHead, fmtTime } from "../ui.js";
import { labInfo } from "../../content/index.js";
import { go } from "../router.js";

export function render() {
  const s = S.getState();
  return `${sectionHead("LEARN BY DOING", "让每一次尝试，都有反馈。", "先预测，后观察。保留失败，找到证据。")}
<div class="lab-grid">${Object.entries(labInfo).map(([id, l], i) => labCard(id, l, i)).join("")}</div>
<section class="panel history">
  <h2>实验记录 <span class="muted">${s.runs.length} 条活跃 + ${s.archive.length} 条归档（超出上限自动归档，可导出）</span></h2>
  ${s.runs.length
    ? [...s.runs].reverse().map((r) => runRow(r)).join("")
    : '<div class="empty"><p>从上方选择一个实验，留下第一条记录。</p></div>'}
  ${s.archive.length ? `<details class="fold"><summary>查看归档记录（${s.archive.length} 条）</summary><div class="fold-body">${[...s.archive].reverse().slice(0, 50).map((r) => runRow(r)).join("")}</div></details>` : ""}
</section>`;
}

function runRow(r) {
  return `<details><summary><span class="pill ${r.passed === true ? "success" : r.passed === false ? "" : ""}">${r.passed === true ? "验证通过" : r.passed === false ? "探索记录" : "运行记录"}</span> ${esc(labInfo[r.lab]?.title || r.lab || "")} <span class="muted">${fmtTime(r.time)}</span>${r.mode ? pill(modeLabel(r.mode), "dark") : ""}</summary>
  <p>${esc(r.summary || "")}</p>
  <pre>${esc(typeof r.evidence === "string" ? r.evidence : JSON.stringify(r.evidence, null, 2))}</pre>
  <button class="text-button" data-lab="${esc(r.lab)}">再次探索 →</button></details>`;
}

const modeLabel = (m) =>
  ({ rule: "规则", "local-compute": "本地计算", model: "真实模型", sim: "仿真", train: "训练" }[m] || m);

function labCard(id, l, i) {
  return `<button class="lab-card" data-lab="${id}"><div class="lab-card-top"><span class="lab-symbol tone-${i}">${icon(["sun", "search", "project", "map"][i])}</span><span class="lab-number">LAB / 0${i + 1}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.subtitle)}</p><div class="lab-card-bottom"><span>${esc(l.kind)}</span>${icon("arrow")}</div></button>`;
}

export function bind(root) {
  root.querySelectorAll("[data-lab]").forEach((btn) =>
    btn.addEventListener("click", () => go("lab", btn.dataset.lab)),
  );
}
