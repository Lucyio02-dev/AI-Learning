// 能力评价页：四类能力量表、作答历史、状态区分、修订对比。
import * as S from "../state.js";
import { esc, sectionHead, table, pill, details, fmtTime } from "../ui.js";
import { courses, getCourse } from "../../content/index.js";
import { quizKindLabel, capabilityLabel } from "./course.js";

export function render() {
  const s = S.getState();
  const rows = [...s.quizAttempts].reverse();
  const capabilityRows = ["explained", "implemented", "diagnosed", "verified"].map((cap) => {
    const coursesWith = courses.filter((c) => {
      const p = s.progress[c.id];
      return p?.[cap];
    });
    return `<tr><td><strong>${capabilityLabel(cap)}</strong></td>
      <td>${rubricFor(cap)}</td>
      <td>${coursesWith.length} 门</td>
      <td>${coursesWith.slice(0, 6).map((c) => `<button class="text-button" data-course="${c.id}">${esc(c.title)}</button>`).join(" ") || '<span class="muted">暂无</span>'}</td></tr>`;
  });
  return `${sectionHead("CAPABILITY", "你的能力，用证据说话。", "阅读、自报、练习、实验、复核是五种不同强度的证据；下面是每类能力的量表与你的作答历史。")}
<section class="panel">
  <h2>能力量表（可观察证据）</h2>
  ${table(["能力", "量规（满足即得分）", "覆盖课程", "课程入口"], capabilityRows)}
  <div class="callout"><strong>状态含义</strong>
    <ul>
      <li><strong>已阅读</strong>：读完了四步内容，只是起点。</li>
      <li><strong>自报完成</strong>：你自己声明完成，未经验证（v2 旧数据降级到此类）。</li>
      <li><strong>练习通过</strong>：固定教学练习答对，不能泛化到陌生问题。</li>
      <li><strong>实验通过</strong>：真实运行/诊断/验证流程完成，有运行记录。</li>
      <li><strong>人工复核</strong>：助教或人工按量规检查过你的回答。</li>
    </ul>
  </div>
</section>
<section class="panel">
  <h2>作答历史（${rows.length}）</h2>
  ${rows.length
    ? rows.map((q) => `<details class="fold"><summary><span class="pill">${quizKindLabel(q.kind)}</span> ${esc(getCourse(q.courseId)?.title || q.courseId)} · ${capabilityLabel(q.capability)} <small class="muted">${fmtTime(q.time)}</small></summary>
      <div class="fold-body"><p><strong>你的回答</strong></p><pre>${esc(q.answer.slice(0, 2000))}</pre>
      <p class="muted">量规自评：${q.score?.rubricSelf ?? 0}/${q.score?.rubricTotal ?? 0} 条。提交与自评不会自动标记为能力通过；修订回答请在课程页重新提交，系统保留历史以便对比变化。</p></div></details>`).join("")
    : '<p class="muted">还没有作答记录。进入课程页的“能力评价题”开始。</p>'}
</section>
<section class="panel">
  <h2>下一步怎么练</h2>
  ${nextPractice(s)}
</section>`;
}

function rubricFor(cap) {
  const rubrics = {
    explained: ["能说明机制为什么成立（不只复述结论）", "能指出机制的适用条件", "能举出反例/边界情况"],
    implemented: ["只改一个变量并说明理由", "运行并保留了配置/输出", "结果与预期差异能解释"],
    diagnosed: ["先描述证据再给结论", "能区分至少两类可能原因", "用对照验证了归因"],
    verified: ["用了未见样例或新条件", "报告了指标与失败样例", "结论标明了适用范围"],
  };
  return `<ul>${rubrics[cap].map((r) => `<li>${r}</li>`).join("")}</ul>`;
}

function nextPractice(s) {
  const suggestions = [];
  const weak = ["explained", "implemented", "diagnosed", "verified"].filter((cap) => !courses.some((c) => s.progress[c.id]?.[cap]));
  for (const cap of weak.slice(0, 2))
    suggestions.push(`${capabilityLabel(cap)}还没有证据：到${cap === "explained" ? "课程页的解释题" : cap === "implemented" ? "课程的修改任务" : cap === "diagnosed" ? "实验室注入一次陌生故障" : "实验里用 gold-evidence 对照做一次归因"}练一次。`);
  const unseenMissing = !s.quizAttempts.some((q) => q.kind === "unseen");
  if (unseenMissing) suggestions.push("还没做过“未见样例”题：这类题才能检验泛化，避免拿调试题的标准答案自证。");
  if (s.runs.length < 5) suggestions.push("实验记录还少：每个实验室至少留 2 条不同故障的记录，用于回归对比。");
  return `<ul>${suggestions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

export function bind(root) {
  root.querySelectorAll("[data-course]").forEach((btn) => btn.addEventListener("click", () => import("../router.js").then(({ go }) => go("course", btn.dataset.course, "0"))));
}
