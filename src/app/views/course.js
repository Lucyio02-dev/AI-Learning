// 课程页：四步模板完整渲染（公式/代码/预期/陷阱/修改任务/诊断/验证）+
// 三层深度 + 能力评价题 + 笔记草稿 + 资源引用。
import * as S from "../state.js";
import { esc, icon, sectionHead, details, md, button, setSaveStatus } from "../ui.js";
import { go } from "../router.js";
import { getCourse, tracks, getSections, labInfo, openSourceCasesForCourse } from "../../content/index.js";

let stepDraft = 0;

export function render(route) {
  const c = getCourse(route.id) || getCourse("foundation");
  const sections = getSections(c);
  const step = Math.max(0, Math.min(sections.length - 1, Number(route.extra) || stepDraft || 0));
  stepDraft = step;
  S.markViewedStep(c.id, step);
  const s = S.getState();
  const p = S.progressFor(c.id);
  const steps = c.steps || [];
  const cur = steps[step] || {};

  return `
<button class="text-button back" data-page="routes">← 返回课程目录</button>
<div class="course-title">
  <span class="eyebrow">${esc(tracks[c.track])} / ${esc(c.level || "基础")}</span>
  <h1>${esc(c.title)}</h1>
  <p>${esc(c.outcome)}</p>
</div>
<div class="course-meta-bar">
  <span>预计 ${c.minutes?.value ?? 40} 分钟（${c.minutes?.basis === "verified" ? "实测校准" : "估计值"}）</span>
  <span>费用：${esc(c.cost || "免费")}</span>
  <span>运行条件：${esc(c.conditions || "浏览器即可")}</span>
  ${c.sourceRef?.chapter ? `<span>来源章节：第 ${c.sourceRef.chapter} 章（仅作引用）</span>` : ""}
</div>
<div class="lesson-layout">
  <aside class="panel lesson-index">
    <span class="eyebrow">本节学习</span>
    ${sections.map(([t], i) => `<button class="lesson-step ${i === step ? "selected" : ""}" data-step="${i}"><span>0${i + 1}</span>${esc(t)}${p.viewedSteps?.includes(i) ? '<span class="step-viewed" aria-hidden="true">·</span>' : ""}</button>`).join("")}
    <div class="prereq"><strong>先修知识</strong>${c.prerequisites?.length ? c.prerequisites.map((id) => `<button class="text-button" data-course="${esc(id)}">${esc(getCourse(id)?.title || id)} ↗</button>`).join("") : "<p>无需先修，从这里开始。</p>"}</div>
    <div class="prereq"><strong>能力状态</strong>${capabilityBadges(p)}</div>
    <div class="prereq"><strong>延伸深度</strong>${depthsAccordion(c)}</div>
  </aside>
  <article class="panel lesson-body">
    <span class="eyebrow">STEP 0${step + 1} / 0${sections.length}</span>
    <h2>${esc(cur.title || sections[step][0])}</h2>
    <div class="lesson-text">${md(cur.body || sections[step][1])}</div>
    ${(cur.formulas || []).map((f) => `<div class="formula-card"><strong>${esc(f.name)}</strong><code>${esc(f.expr)}</code><small>${esc(f.dims)}${f.note ? ` · ${esc(f.note)}` : ""}</small></div>`).join("")}
    ${cur.code ? codeBlock(cur.code) : ""}
    ${(cur.pitfalls || []).length ? `<div class="callout warn"><strong>常见错误</strong><ul>${cur.pitfalls.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${step === 0 ? `<div class="callout"><strong>停一下，做一个预测。</strong><p>${esc(c.predict || "在查看结果之前，写下你的判断。观察后比较差异，并记录支持结论的证据。")}</p></div>` : ""}
    ${cur.modify ? `<div class="modify-task"><strong>修改任务</strong><p>${esc(cur.modify.brief)}</p><small class="muted">起点：${esc(cur.modify.starter)}</small><ul>${(cur.modify.checks || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${step === sections.length - 1 ? verificationBlock(c, p) : ""}
    <div class="lesson-controls">
      ${step ? `<button class="secondary" data-step="${step - 1}">上一步</button>` : "<span></span>"}
      ${step < sections.length - 1
        ? `<button class="primary" data-step="${step + 1}">下一步 ${icon("arrow")}</button>`
        : button(p.read ? "已记录阅读" : "记录阅读完成", "read", "primary", `data-id="${c.id}"`)}
    </div>
    ${c.lab ? `<div class="lesson-lab"><div><span class="eyebrow">LEARN BY DOING</span><h3>${esc(labInfo[c.lab].title)}</h3><p>${esc(labInfo[c.lab].kind)}</p></div><button class="primary" data-lab="${c.lab}">进入实验 ${icon("arrow")}</button></div>` : ""}
    ${(c.quiz || []).length ? quizBlock(c) : ""}
    ${openSourceCaseBlock(c)}
    <div class="section-title"><h3>延伸资料</h3><span class="muted">来源链接 · 外部打开</span></div>
    ${(c.references || []).map((r) => `<a class="resource-link" href="${esc(r.url)}" target="_blank" rel="noreferrer"><span>${esc(r.title)}<small>${esc(r.kind)} · 核对 ${esc(r.verified?.date || "未标注")}（${esc(r.verified?.env || "外部来源")}）</small></span>↗</a>`).join("")}
    ${details("链接失效或内容有问题？", `<p class="muted">复制下面的反馈信息发给维护者（或保存为文件），附上你看到的现象：</p><textarea class="feedback-draft" rows="3" readonly>课程: ${esc(c.title)} (id=${esc(c.id)})
问题: [链接失效 | 内容错误 | 运行环境不符]
链接: ${esc((c.references || [])[0]?.url || "无")}
环境: [浏览器/后端版本] 日期: ${new Date().toISOString().slice(0, 10)}</textarea><button class="secondary" data-action="copy-feedback">复制反馈</button>`)}
    ${cur.limits ? `<p class="caption">结论与局限：${esc(cur.limits)}</p>` : ""}
    ${c.track === "research" ? `<p class="caption">研究专题提示：${esc(c.limits || "")}</p>` : ""}
  </article>
  <aside class="panel lesson-note">
    <span class="eyebrow">YOUR THINKING</span>
    <h3>留下一点自己的理解</h3>
    <label for="lesson-note">预测、证据与疑问</label>
    <textarea id="lesson-note" data-note="${c.id}" placeholder="我原先以为…&#10;观察到…&#10;因此我认为…&#10;还需要验证…">${esc(s.notes[c.id]?.body || "")}</textarea>
    <small id="draft-status" role="status" aria-live="polite">输入后自动保存到此浏览器</small>
    <p>写下猜测也有价值。能力验证请在实验与评价题中完成。</p>
    <button class="text-button" data-page="tutor" data-context="${c.id}">问 AI 助教这道课的问题 ↗</button>
  </aside>
</div>`;
}

function openSourceCaseBlock(course) {
  const cases = openSourceCasesForCourse(course.id);
  if (!cases.length) return "";
  return `<section class="open-source-section">
    <div class="section-title"><h3>把本课放进真实开源项目</h3><span class="muted">阅读路线 + 可交付练习</span></div>
    <p class="open-source-intro">下面的仓库用于结构阅读和独立练习。练习是本课程原创设计，不要求复制上游实现。</p>
    <div class="open-source-grid">${cases.map((item) => `
      <article class="open-source-card">
        <div class="open-source-head">
          <div><span class="eyebrow">${item.stars.toLocaleString("en-US")} stars · ${esc(item.license)} · 核对 ${esc(item.checkedOn)}</span><h4>${esc(item.title)}</h4></div>
          <a href="${esc(item.url)}" target="_blank" rel="noreferrer">打开仓库 ↗</a>
        </div>
        <p>${esc(item.summary)}</p>
        ${item.statusNote ? `<p class="open-source-note">${esc(item.statusNote)}</p>` : ""}
        <strong>建议阅读</strong>
        <ol class="open-source-reading">${item.reading.map((entry) => `<li><a href="${esc(entry.url)}" target="_blank" rel="noreferrer">${esc(entry.title)}</a><code>${esc(entry.path)}</code><small>${esc(entry.focus)}</small></li>`).join("")}</ol>
        <div class="open-source-task"><strong>本课练习</strong><p>${esc(item.lesson.task)}</p><small><b>交付物：</b>${esc(item.lesson.deliverable)}</small></div>
        <small class="open-source-snapshot">GitHub star 数是 ${esc(item.checkedOn)} 的快照；许可证以仓库当前 LICENSE 文件为准。</small>
      </article>`).join("")}</div>
  </section>`;
}

function codeBlock(code) {
  const command = /^(python(?:3)?(?:\.exe)?\s|py\s|\.\\\.venv\\|source\s)/m.test(code.src.trimStart());
  const isTerminal = code.run === "terminal" || command;
  const source = isTerminal ? code.src.replace(/\\\r?\n/g, " `\n") : code.src;
  const label = isTerminal
    ? "PowerShell 命令（在项目根目录运行）"
    : code.run === "browser" ? "浏览器内可运行" : code.run === "python" ? "Python 代码片段（在 pyexp 环境运行）" : "文本模板";
  return `<div class="code-card"><div class="code-head"><span>${esc(isTerminal ? "PowerShell" : code.lang)}</span><span class="muted">${label}</span></div><pre><code>${esc(source)}</code></pre><div class="code-expected"><strong>预期输出</strong>${esc(code.expected || "见运行记录")}</div></div>`;
}

function verificationBlock(c, p) {
  const v = c.steps?.at(-1)?.verify || c.verify;
  return `${v ? `<div class="verify-card ${p.experimentPassed ? "passed" : ""}"><strong>独立验证${p.experimentPassed ? " · 已通过" : ""}</strong><p>${esc(v.task)}</p><small class="muted">需要保存的证据：${esc(v.evidence)}</small></div>` : ""}
  <div class="callout"><strong>结论与局限</strong><p>${esc(c.steps?.at(-1)?.limits || c.outcome)}</p></div>`;
}

function capabilityBadges(p) {
  const items = [
    ["read", "已阅读"],
    ["selfReported", "自报完成"],
    ["exercisePassed", "练习通过"],
    ["experimentPassed", "实验通过"],
    ["reviewed", "人工复核"],
  ];
  return `<div class="capability-badges">${items.map(([k, t]) => `<span class="badge ${p[k] ? "on" : ""}">${t}</span>`).join("")}</div><small class="muted">四类能力有独立采集流程，答对一题不再同时给“诊断+验证”。</small>`;
}

function depthsAccordion(c) {
  if (!c.depths) return "<p class='muted'>研究专题以“研究问题—基线—实验—边界”四步展开。</p>";
  return details("直觉层", `<p>${esc(c.depths.intuition)}</p>`) +
    details("工程层", `<p>${esc(c.depths.engineering)}</p>`) +
    details("研究层", `<p>${esc(c.depths.research)}</p>`);
}

function quizBlock(c) {
  return `<div class="section-title"><h3>能力评价题</h3><span class="muted">按量规自评或请助教评估</span></div>${c.quiz.map((q) => `
  <div class="quiz-card" data-quiz="${esc(q.id)}">
    <div class="card-meta"><span class="pill">${quizKindLabel(q.kind)}</span><span class="pill">${capabilityLabel(q.capability)}</span>${q.kind === "unseen" ? '<span class="pill dark">未见样例</span>' : ""}</div>
    <p>${esc(q.prompt)}</p>
    <textarea class="quiz-answer" aria-label="你的回答" placeholder="写下你的回答…"></textarea>
    <div class="quiz-rubric"><strong>评分量规（提交前自评）</strong><ul>${q.rubric.map((r, i) => `<li><label><input type="checkbox" class="quiz-rubric-check" data-rubric-index="${i}"> ${esc(r)}</label></li>`).join("")}</ul></div>
    <div class="quiz-actions">
      <button class="secondary" data-action="quiz-submit" data-quiz-id="${esc(q.id)}" data-course="${esc(c.id)}" data-capability="${esc(q.capability)}" data-kind="${esc(q.kind)}">提交并自评</button>
      <button class="text-button" data-action="quiz-tutor" data-quiz-id="${esc(q.id)}" data-course="${esc(c.id)}">让助教按量规点评（需后端）</button>
    </div>
    <div class="quiz-result" aria-live="polite"></div>
  </div>`).join("")}`;
}

export const quizKindLabel = (k) =>
  ({ explain: "解释题", modify: "代码修改", fault: "陌生故障", regression: "回归检查", unseen: "未见样例" }[k] || k);
export const capabilityLabel = (cap) =>
  ({ explained: "解释能力", implemented: "实现能力", diagnosed: "诊断能力", verified: "验证能力" }[cap] || cap);

export function bind(root) {
  root.querySelectorAll("[data-step]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      if (e.target.closest("[data-course]")) return;
      go("course", currentCourseId(root), btn.dataset.step);
    }),
  );
  root.querySelectorAll("[data-course]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      go("course", btn.dataset.course, "0");
    }),
  );
  root.querySelector('[data-action="read"]')?.addEventListener("click", (e) => {
    const result = S.markRead(e.currentTarget.dataset.id);
    if (!result.ok) {
      import("../ui.js").then(({ toast }) => toast("阅读状态未保存，请重试或先导出备份。"));
      return;
    }
    e.currentTarget.textContent = "已记录阅读";
    import("../ui.js").then(({ toast }) => toast("阅读已记录。动手实验与评价题可以继续留下能力证据。"));
  });
  root.querySelector("[data-lab]")?.addEventListener("click", (e) =>
    go("lab", e.currentTarget.dataset.lab),
  );
  root.querySelector('[data-page="tutor"]')?.addEventListener("click", (e) =>
    go("tutor", e.currentTarget.dataset.context || ""),
  );
  const note = root.querySelector("#lesson-note");
  const persistDraft = () => {
    if (!note) return { ok: false };
    const id = note.dataset.note;
    const result = S.saveNote(id, {
      body: note.value,
      title: S.getState().notes[id]?.title || getCourse(id)?.title || id,
      links: { course: [id], resource: [], lab: [], run: [] },
    }, { silent: true });
    setSaveStatus(root.querySelector("#draft-status"), result, { okText: "草稿已保存", retry: persistDraft });
    return result;
  };
  note?.addEventListener("input", persistDraft);
  root.querySelector('[data-action="copy-feedback"]')?.addEventListener("click", (e) => {
    const text = e.currentTarget.closest(".fold")?.querySelector(".feedback-draft")?.value || "";
    navigator.clipboard?.writeText(text).then(
      () => import("../ui.js").then(({ toast }) => toast("反馈已复制到剪贴板")),
      () => import("../ui.js").then(({ toast, download }) => {
        download(text, "内容反馈.txt", "text/plain;charset=utf-8");
        toast("剪贴板不可用，已下载反馈文件");
      }),
    );
  });
  bindQuiz(root);
}

function currentCourseId(root) {
  return root.querySelector("#lesson-note")?.dataset.note || "foundation";
}

function bindQuiz(root) {
  root.querySelectorAll('[data-action="quiz-submit"]').forEach((btn) =>
    btn.addEventListener("click", () => {
      const card = btn.closest(".quiz-card");
      const answer = card.querySelector(".quiz-answer").value.trim();
      const resultEl = card.querySelector(".quiz-result");
      if (!answer) {
        resultEl.innerHTML = '<span class="error-inline">请先写下回答再提交。</span>';
        return;
      }
      const qid = btn.dataset.quizId;
      const course = btn.dataset.course;
      const capability = btn.dataset.capability;
      const kind = btn.dataset.kind;
      const record = {
        id: `quiz-${qid}-${Date.now()}`,
        time: new Date().toISOString(),
        courseId: course,
        kind,
        capability,
        answer,
        seenBefore: kind !== "unseen",
      };
      record.rubric = [...card.querySelectorAll(".quiz-rubric input[type=checkbox]")].map((input) => input.checked);
      record.score = { rubricSelf: record.rubric.filter(Boolean).length, rubricTotal: record.rubric.length, checked: "self-assessment" };
      const persistAttempt = () => {
        const result = S.update((s) => {
          if (!s.quizAttempts.some((item) => item.id === record.id)) s.quizAttempts.push(record);
        }, { silent: true });
        if (!result.ok) {
          resultEl.innerHTML = '<div class="feedback save-error" role="alert"><strong>作答未保存</strong><p>存储不可用或空间不足；内容仍在此页，刷新会丢失。</p><button class="text-button" type="button" data-action="retry-save">重试保存</button><button class="text-button" type="button" data-action="backup">导出备份</button></div>';
          resultEl.querySelector('[data-action="retry-save"]')?.addEventListener("click", persistAttempt);
          return;
        }
        resultEl.innerHTML = `<div class="feedback"><strong>作答已保存，自评 ${record.score.rubricSelf}/${record.score.rubricTotal}</strong><p>这只是一条自评记录，不会自动标记为能力通过。可以让助教按量规点评，或在“能力评价”页复核。</p></div>`;
      };
      persistAttempt();
    }),
  );
  root.querySelectorAll('[data-action="quiz-tutor"]').forEach((btn) =>
    btn.addEventListener("click", () => go("tutor", btn.dataset.course, btn.dataset.quizId)),
  );
}
