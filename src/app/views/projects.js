// 项目空间：阶段任务、可展开提示、验收标准、报告草稿、运行证据关联、导出。
import * as S from "../state.js";
import { esc, icon, button, details, sectionHead, setSaveStatus } from "../ui.js";
import { projects, getProject, getOpenSourceCase } from "../../content/index.js";
import { stageEvidence, stageEvidenceNote } from "../evidence.js";
import { go } from "../router.js";

export function render(route) {
  const s = S.getState();
  const project = route.id ? getProject(route.id) : null;
  if (project) return renderProject(project, s);
  return `${sectionHead("BUILD SOMETHING REAL", "让知识，在项目里连起来。", "每个项目都有阶段任务、逐级提示、参考实现与独立验收；报告关联真实运行证据。")}
<div class="project-grid">${projects.map((p) => projectCard(p, s)).join("")}</div>
<div class="panel"><h3>论文 → 实验 学习模板</h3><p>用统一结构复现一篇论文，标明原作者贡献与你自己的改动：</p>
<ol class="project-steps">
  ${["问题：论文要解决什么", "假设：核心主张与前提", "方法：关键设计与作者贡献", "复现：我的改动（明确标注）", "基线：与什么对比", "消融：去掉哪个组件差多少", "失败：什么情况下不成立", "局限：数据/模型/评测边界"].map((x) => `<li>${esc(x)}</li>`).join("")}
</ol>
${details("查看小型复现实例（知识编辑最小复现）", `<pre>docs/REPRO_EXAMPLE.md 的结构：
1. 问题：ROME 方法能否修改 GPT-2 的单条事实？
2. 作者贡献：ROME 的因果中介分析 + first-layer 编辑
3. 我的改动：把探针集从 10 条换成自建 5 条中文事实
4. 基线：微调最后一层 vs ROME
5. 消融：去掉因果中介定位，直接选第 5 层
6. 失败：改写问句后泛化成功率下降
7. 局限：小模型、英文方法迁移中文</pre>`)}</div>`;
}

function projectCard(p, s) {
  const marked = Object.values(s.projects[p.id]?.stages || {}).filter((entry) => stageEvidence(entry).done).length;
  return `<article class="panel project-card">
    <span class="eyebrow">${esc(p.tag)}</span>
    <h2>${esc(p.title)}</h2>
    <p>${esc(p.summary)}</p>
    <small class="muted">运行条件：${esc(p.runConditions)}</small>
    <div class="card-meta"><span class="pill">阶段 ${marked}/${p.stages.length} 已标记（自报）</span></div>
    <ol class="project-steps">${p.stages.map((st) => `<li><button class="text-button" data-project="${p.id}">${esc(st.title)}</button><small>${st.acceptance.length} 项验收</small></li>`).join("")}</ol>
    <div class="card-foot"><button class="primary" data-project="${p.id}">进入项目 ${icon("arrow")}</button></div>
  </article>`;
}

function renderProject(p, s) {
  const data = s.projects[p.id] || { stages: {}, report: "", linkedRunIds: [] };
  const linkedRuns = runsForProject(p.id, s.runs);
  return `
<button class="text-button back" data-page="projects">← 返回项目空间</button>
<div class="page-heading"><div><span class="eyebrow">${esc(p.tag)}</span><h1>${esc(p.title)}</h1><p>${esc(p.summary)}</p></div></div>
<div class="experiment-info"><span class="pill">运行条件</span><span>${esc(p.runConditions)}</span></div>
${projectReferences(p)}
<div class="project-stages">
  ${p.stages.map((st, i) => stageCard(p, st, data.stages[st.id] || {}, i)).join("")}
</div>
<section class="panel">
  <div class="section-title"><h2>项目报告 · 本机草稿</h2><span class="muted">报告不自动编造结果，只引用真实运行记录</span></div>
  <label for="report-body">报告正文（Markdown）</label>
  <textarea id="report-body" data-report="${p.id}" placeholder="${esc(p.questions.join("\n"))}">${esc(data.report || "")}</textarea>
  <small id="draft-status" role="status" aria-live="polite">输入后自动保存到此浏览器</small>
  <h3>关联实验记录（${linkedRuns.length}）</h3>
  ${linkedRuns.length
    ? `<ul class="text-list">${linkedRuns.slice(-10).reverse().map((r) => `<li><small class="muted">${esc(r.time.slice(0, 16).replace("T", " "))}</small> ${esc(r.summary || "")}</li>`).join("")}</ul>`
    : '<p class="muted">还没有关联实验。完成实验室里的运行后自动出现在这里。</p>'}
  <div class="form-actions">
    <button class="primary" data-action="export-project" data-id="${p.id}">导出项目档案</button>
    <span class="muted">阶段状态在勾选时自动保存；自报不等于验收。</span>
  </div>
</section>`;
}

function stageCard(p, st, saved, i) {
  const hints = st.hints || [];
  const evidence = stageEvidence(saved);
  return `<section class="panel project-stage ${evidence.done ? "done" : ""}">
    <div class="section-title"><h3>${esc(st.title)}</h3><label class="check-row"><input type="checkbox" data-stage-done="${p.id}/${st.id}" ${evidence.done ? "checked" : ""}> 标记阶段自报完成</label></div>
    <small class="stage-evidence" data-stage-status="${esc(p.id)}/${esc(st.id)}" aria-live="polite">${esc(stageEvidenceNote(saved))}</small>
    <p>${esc(st.brief)}</p>
    <h4>任务</h4>
    <ul>${st.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    ${st.starter ? `<small class="muted">起始代码：${esc(st.starter)}</small>` : ""}
    ${st.links?.length ? `<div class="project-stage-links"><strong>本阶段参考</strong>${st.links.map((link) => `<a href="${esc(link.url)}" target="_blank" rel="noreferrer">${esc(link.title)} ↗</a>`).join("")}</div>` : ""}
    ${hints.length ? details("逐级提示（先自己试）", hints.map((h) => `<p><strong>提示 ${h.level}</strong>：${esc(h.text)}</p>`).join("")) : ""}
    <div class="verify-card"><strong>验收标准</strong><ul>${st.acceptance.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>
    ${p.directions ? `<details class="fold"><summary>方向侧重（${Object.keys(p.directions).map((k) => ({ product: "产品", engineering: "工程", research: "研究" }[k])).join("/")}）</summary><div class="fold-body">${Object.entries(p.directions).map(([k, v]) => `<p><strong>${({ product: "产品", engineering: "工程", research: "研究" }[k])}</strong>：${esc(v)}</p>`).join("")}</div></details>` : ""}
  </section>`;
}

function projectReferences(project) {
  const repos = (project.openSourceRefs || []).map((id) => getOpenSourceCase(id)).filter(Boolean);
  if (!repos.length) return "";
  return `<section class="project-references">
    <div class="section-title"><h2>开源项目拆解路线</h2><span class="muted">星数快照：2026-11-17</span></div>
    <p class="muted">练习围绕本项目设计；阅读上游实现时保留仓库边界，不把未运行的上游结果记成本地实验。</p>
    <div class="project-reference-grid">${repos.map((repo) => `<article class="project-reference-card">
      <div class="project-reference-meta">${repo.stars.toLocaleString("en-US")} stars · ${esc(repo.license)}</div>
      <h3><a href="${esc(repo.url)}" target="_blank" rel="noreferrer">${esc(repo.title)} ↗</a></h3>
      <p>${esc(repo.summary)}</p>
      <ul>${repo.reading.slice(0, 2).map((entry) => `<li><a href="${esc(entry.url)}" target="_blank" rel="noreferrer">${esc(entry.title)}</a><small>${esc(entry.focus)}</small></li>`).join("")}</ul>
    </article>`).join("")}</div>
  </section>`;
}

function runsForProject(projectId, runs) {
  if (projectId === "robot") return runs.filter((run) => run.lab === "embodied");
  if (projectId === "assistant") return runs.filter((run) => ["rag", "agent", "prompt"].includes(run.lab));
  return [];
}

export function bind(root) {
  root.querySelectorAll("[data-project]").forEach((btn) =>
    btn.addEventListener("click", () => go("projects", btn.dataset.project)),
  );
  root.querySelector('[data-page="projects"]')?.addEventListener("click", () => go("projects"));
  root.querySelectorAll("[data-stage-done]").forEach((cb) =>
    cb.addEventListener("change", () => {
      const [pid, sid] = cb.dataset.stageDone.split("/");
      const status = cb.closest(".project-stage")?.querySelector("[data-stage-status]");
      const persistStage = () => {
        const result = S.update((s) => {
          const updatedAt = new Date().toISOString();
          const proj = (s.projects[pid] ||= { stages: {}, report: "", linkedRunIds: [] });
          proj.stages[sid] = {
            ...(proj.stages[sid] || {}),
            done: cb.checked,
            source: "self-report",
            updatedAt,
          };
          proj.updatedAt = updatedAt;
        }, { silent: true });
        if (!result.ok) {
          setSaveStatus(status, result, { failureText: "阶段状态没有写入浏览器", retry: persistStage });
          return;
        }
        if (status) {
          status.classList.remove("save-error");
          status.textContent = stageEvidenceNote(S.getState().projects[pid]?.stages?.[sid]);
        }
      };
      persistStage();
    }),
  );
  const report = root.querySelector("[data-report]");
  const persistReport = () => {
    if (!report) return { ok: false };
    const result = S.update((s) => {
      const pid = report.dataset.report;
      const updatedAt = new Date().toISOString();
      const project = (s.projects[pid] ||= { stages: {}, report: "", linkedRunIds: [] });
      project.report = report.value;
      project.reportUpdatedAt = updatedAt;
      project.updatedAt = updatedAt;
    }, { silent: true });
    setSaveStatus(root.querySelector("#draft-status"), result, { okText: "草稿已保存", retry: persistReport });
    return result;
  };
  report?.addEventListener("input", persistReport);
  root.querySelector('[data-action="export-project"]')?.addEventListener("click", (e) => {
    const pid = e.currentTarget.dataset.id;
    const p = getProject(pid);
    const s = S.getState();
    const data = s.projects[pid] || {};
    const linkedRuns = runsForProject(pid, s.runs);
    import("../ui.js").then(({ download }) => {
      download(projectArchiveMarkdown(p, data, linkedRuns), `${pid}-项目档案.md`);
    });
  });
}

export function projectArchiveMarkdown(project, data = {}, linkedRuns = []) {
  const stages = project.stages.map((stage) => {
    const saved = data.stages?.[stage.id] || {};
    const evidence = stageEvidence(saved);
    return `### ${stage.title}
- 阶段证据：${evidence.label}${evidence.legacy ? "（旧记录按自报处理）" : ""}
- 说明：${evidence.verified ? "来源已记录，仍需核对证据是否完整。" : "这是自报状态，不等同程序检查或人工复核。"}
- 标记时间：${saved.updatedAt || "未记录"}

#### 验收标准（供复核）

${stage.acceptance.map((item) => `- ${item}`).join("\n")}`;
  }).join("\n\n");
  const runs = linkedRuns.length
    ? linkedRuns.map((run) => `### ${run.lab} · ${run.time}\n\n${run.summary || ""}\n\n\`\`\`json\n${JSON.stringify(run.evidence ?? null, null, 2)}\n\`\`\``).join("\n\n")
    : "尚未关联实验记录。";
  return `# ${project.title}\n\n${data.report || "尚未填写报告"}\n\n## 阶段证据状态\n\n${stages}\n\n## 关联实验记录\n\n${runs}\n`;
}
