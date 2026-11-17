// 首页：一个准确的下一步任务 + 方向 + 最近证据。任务优先，减少装饰。
import * as S from "../state.js";
import { go } from "../router.js";
import { esc, icon, pill, sectionHead, fmtTime } from "../ui.js";
import { labInfo, getCourse } from "../../content/index.js";

export function render() {
  const s = S.getState();
  const next = S.nextTask();
  const learned = Object.values(s.progress).filter((p) => p.read).length;
  const evidenceCount = S.totalEvidence();
  const lastRun = s.runs.at(-1);
  const goalLabels = { llm: "大模型应用", embodied: "具身智能", research: "研究与复现" };
  const prereqMissing = next.course.prerequisites.filter((id) => !s.progress[id]?.read);

  return `${sectionHead(
    "KEEP EXPLORING",
    "把好奇心，变成真正的能力。",
    "从一个问题开始，带着证据继续向前。",
  )}
<div class="workspace-shortcuts" aria-label="学习工作台常用入口">
  <button class="text-button" data-page="map">完整学习地图 ${icon("arrow")}</button>
  <button class="text-button" data-page="library">资料与笔记 ${icon("arrow")}</button>
  <button class="text-button" data-page="tutor">课程 AI 助教 ${icon("arrow")}</button>
  <button class="text-button" data-page="settings">导入已有学习记录 ${icon("arrow")}</button>
</div>
<div class="home-grid">
  <section class="hero">
    <div class="hero-top"><span class="pill dark">你的下一步</span><span>${esc(next.reason)}</span></div>
    <div class="hero-layout">
      <div>
        <div class="hero-course">${esc(goalLabels[s.goal])} / 第 ${next.step + 1} 步</div>
        <h2>${esc(next.course.title)}</h2>
        <p>${esc(next.course.outcome)}</p>
        <div class="hero-details">
          <span>约 ${next.course.minutes?.value ?? 40} 分钟（${next.course.minutes?.basis === "verified" ? "实测" : "估计"}）</span>
          <span>${esc(next.course.cost || "免费")}</span>
        </div>
        ${prereqMissing.length ? `<div class="prereq-hint">先修：${prereqMissing.map((id) => `<button class="text-button" data-course="${esc(id)}">${esc(getCourseTitle(id))} ↗</button>`).join("")}</div>` : ""}
        <button class="primary light" data-course="${next.course.id}" data-step="${next.step}">继续学习 ${icon("arrow")}</button>
        ${!s.diagnostic.completed ? `<button class="text-button" data-page="diagnostic">还没做基础诊断 · 2 分钟找准起点 →</button>` : `<button class="text-button" data-page="diagnostic">重新诊断基础（可跳过）</button>`}
      </div>
      <div class="orbit" aria-hidden="true"><div class="orbit-line"></div><div class="orbit-line second"></div><div class="orbit-core">AI<small>LEARN BY DOING</small></div><span class="orb one"></span><span class="orb two"></span><span class="orb three"></span></div>
    </div>
    <div class="hero-bottom"><span>01 理解现象</span><span>02 动手修改</span><span>03 验证结论</span></div>
  </section>
  <aside class="panel focus-panel">
    <span class="eyebrow">YOUR DIRECTION</span>
    <h2>这次，想走向哪里？</h2>
    <label for="goal">当前学习目标</label>
    <select id="goal">
      ${[["llm", "构建大模型应用"], ["embodied", "探索具身智能"], ["research", "开展研究与复现"]]
        .map(([v, t]) => `<option value="${v}" ${s.goal === v ? "selected" : ""}>${t}</option>`)
        .join("")}
    </select>
    <p>公共基础与方向课程共享。随时调整，已有积累都会保留。</p>
    <button class="text-button" data-page="map">查看学习地图 ${icon("arrow")}</button>
    <div class="mini-stats">
      <div><strong>${learned}</strong><span>已读课程</span></div>
      <div><strong>${evidenceCount}</strong><span>能力证据</span></div>
      <div><strong>${s.runs.length}</strong><span>实验记录</span></div>
    </div>
  </aside>
</div>
<div class="section-title"><h2>在动手中，理解它。</h2><button class="text-button" data-page="labs">全部实验 ${icon("arrow")}</button></div>
<div class="lab-grid">${Object.entries(labInfo).map(([id, l], i) => labCard(id, l, i)).join("")}</div>
<div class="lower-grid">
  <section class="panel">
    <div class="section-title"><h2>你的能力，用证据说话</h2><span class="muted">阅读、自报、练习、实验、复核分开记录</span></div>
    <div class="ability-row">
      ${[["解释", "说明为什么", "explained"], ["实现", "改变一个变量", "implemented"], ["诊断", "找到失败环节", "diagnosed"], ["验证", "用对照支持结论", "verified"]]
        .map(([a, b, cap], i) => `<div><span class="ability-number">0${i + 1}</span><strong>${a}</strong><p>${b}</p><small>${capabilityCount(s, cap)} 门课有证据</small></div>`)
        .join("")}
    </div>
    <button class="text-button" data-page="quiz">进入能力评价 ${icon("arrow")}</button>
  </section>
  <section class="panel">
    <span class="eyebrow">RECENT ACTIVITY</span>
    <h2>最近一次实验</h2>
    ${lastRun
      ? `<p>${esc(lastRun.summary || "")}</p><span class="pill ${lastRun.passed ? "success" : ""}">${lastRun.passed ? "验证通过" : "保留失败，继续探索"}</span><small class="muted">${fmtTime(lastRun.time)} · ${esc(modeLabel(lastRun.mode))}</small><button class="text-button" data-lab="${esc(lastRun.lab || "rag")}">再次探索 →</button>`
      : `<p>还没有实验记录。试着定位一次错误回答，留下第一份证据。</p><button class="text-button" data-lab="rag">进入 RAG 诊断 ${icon("arrow")}</button>`}
  </section>
</div>`;
}

const getCourseTitle = (id) => getCourse(id)?.title || id;

function capabilityCount(s, cap) {
  return Object.values(s.progress).filter((p) => p[cap]).length;
}
function modeLabel(mode) {
  return { rule: "规则演示", "local-compute": "本地真实计算", model: "真实模型调用", sim: "仿真", train: "训练" }[mode] || mode;
}

function labCard(id, l, i) {
  return `<button class="lab-card" data-lab="${id}"><div class="lab-card-top"><span class="lab-symbol tone-${i}">${icon(["sun", "search", "project", "map"][i])}</span><span class="lab-number">LAB / 0${i + 1}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.subtitle)}</p><div class="lab-card-bottom"><span>${esc(l.kind)}</span>${icon("arrow")}</div></button>`;
}
