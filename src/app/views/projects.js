// 项目空间：阶段任务、可展开提示、验收标准、报告草稿、运行证据关联、导出。
import * as S from "../state.js";
import { esc, icon, button, details, sectionHead, setSaveStatus, fmtTime } from "../ui.js";
import { projects, getProject, getOpenSourceCase, labInfo } from "../../content/index.js";
import { stageEvidence, stageEvidenceNote } from "../evidence.js";
import {
  allProjectRuns, linkedRunsForProject, runCandidatesForProject, suggestedRunsForProject,
} from "../project-runs.js";
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
  const allRuns = allProjectRuns(s.runs, s.archive);
  const linkInfo = linkedRunsForProject(data, allRuns);
  const suggested = suggestedRunsForProject(p.id, allRuns);
  const hasWork = !!data.report || Object.keys(data.stages || {}).length > 0;
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
  <h3>关联实验记录 <span class="muted">${linkInfo.runs.length} 条显式关联 · 活跃与归档同等保留</span></h3>
  ${linkInfo.missing.length ? `<div class="callout warn"><strong>有 ${linkInfo.missing.length} 条关联记录找不到</strong><p>可能来自损坏或被替换的旧备份：${linkInfo.missing.map((id) => `<code>${esc(id)}</code>`).join("、")}。导出时会保留缺失 ID，供你核对来源。</p></div>` : ""}
  ${linkInfo.runs.length
    ? `<div class="linked-run-list">${linkInfo.runs.map((run) => linkedRunRow(run)).join("")}</div>`
    : '<p class="muted">还没有显式关联实验。请从下方选择，不会再把同类实验室的全部运行自动混入报告。</p>'}
  ${!linkInfo.ids.length && hasWork && suggested.length ? `<div class="callout"><strong>旧版项目曾按实验室类型自动归类</strong><p>检测到 ${suggested.length} 条可能相关的记录。是否把它们转成显式关联？转换后仍可逐条解除。</p><button class="secondary" type="button" data-action="link-suggested">确认迁移 ${suggested.length} 条记录</button></div>` : ""}
  <details class="fold" ${allRuns.length ? "" : "hidden"}>
    <summary>添加实验记录（可选 ${allRuns.length} 条）</summary>
    <div class="fold-body">
      <label class="search-field">${icon("search")}<input id="run-link-search" placeholder="搜索 ID、实验、摘要、时间或证据"></label>
      <div id="run-link-results">${runCandidateResults(data, allRuns, "", 20)}</div>
    </div>
  </details>
  <small id="project-link-status" role="status" aria-live="polite"></small>
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

function linkedRunRow(run) {
  const verdict = run.passed === true ? "验证通过" : run.passed === false ? "探索记录" : "运行记录";
  return `<details class="linked-run" data-linked-run="${esc(run.id)}">
    <summary><span class="pill ${run.passed === true ? "success" : ""}">${verdict}</span> ${esc(labInfo[run.lab]?.title || run.lab)} <span class="muted">${fmtTime(run.time)}</span> ${esc(run.summary || "")}</summary>
    <div class="linked-run-body">
      ${runDetails(run)}
      <button class="text-button" type="button" data-unlink-run="${esc(run.id)}">解除这条关联</button>
    </div>
  </details>`;
}

function runDetails(run) {
  const artifacts = (run.artifacts || []).map((artifact) => {
    const label = esc(artifact.name || artifact.path || JSON.stringify(artifact));
    return artifact.url && /^https?:\/\//i.test(artifact.url)
      ? `<li>${label} · <a href="${esc(artifact.url)}" target="_blank" rel="noreferrer">打开 ↗</a></li>`
      : `<li>${label}</li>`;
  }).join("");
  return `<p>${esc(run.summary || "未填写摘要")}</p>
    <p class="muted">配置：${run.config ? `<code>${esc(JSON.stringify(run.config))}</code>` : "未记录"}</p>
    <p class="muted">指标：${run.metrics ? `<code>${esc(JSON.stringify(run.metrics))}</code>` : "未记录"}</p>
    <p class="muted">产物：${artifacts ? `<ul>${artifacts}</ul>` : "未记录"}</p>
    <details class="fold"><summary>查看证据</summary><pre>${esc(typeof run.evidence === "string" ? run.evidence : JSON.stringify(run.evidence, null, 2))}</pre></details>`;
}

export function runCandidateResults(projectData, allRuns, query = "", limit = 20) {
  const page = runCandidatesForProject(projectData, allRuns, query, limit);
  if (!page.items.length) return '<p class="muted">没有可关联的运行记录。完成一次实验后再回来。</p>';
  return `<p class="muted">匹配 ${page.total} 条，当前显示 ${page.items.length} 条。</p>
    <div class="run-candidate-list">${page.items.map((run) => `<div class="run-candidate">
      <div><strong>${esc(labInfo[run.lab]?.title || run.lab)}</strong><small>${fmtTime(run.time)} · ${esc(run.summary || "未填写摘要")}</small><code>${esc(run.id)}</code></div>
      <button class="secondary" type="button" data-link-run="${esc(run.id)}">关联</button>
    </div>`).join("")}</div>
    ${page.hasMore ? `<button class="text-button" type="button" data-run-more>再显示 ${Math.min(20, page.total - page.items.length)} 条</button>` : ""}`;
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

  const projectId = report?.dataset.report;
  const linkStatus = root.querySelector("#project-link-status");
  const linkResults = root.querySelector("#run-link-results");
  const linkState = { query: "", limit: 20 };
  const currentAllRuns = () => {
    const s = S.getState();
    return allProjectRuns(s.runs, s.archive);
  };
  const paintCandidates = () => {
    if (!linkResults || !projectId) return;
    const data = S.getState().projects[projectId] || {};
    linkResults.innerHTML = runCandidateResults(data, currentAllRuns(), linkState.query, linkState.limit);
  };
  const saveLinks = (nextIds) => {
    if (!projectId) return false;
    const result = S.update((s) => {
      const project = (s.projects[projectId] ||= { stages: {}, report: "", linkedRunIds: [] });
      project.linkedRunIds = [...new Set(nextIds)].slice(0, 500);
      project.updatedAt = new Date().toISOString();
    }, { silent: true });
    if (!result.ok) {
      setSaveStatus(linkStatus, result, { failureText: "项目与实验的关联没有写入浏览器", retry: () => saveLinks(nextIds) });
      return false;
    }
    rerender();
    return true;
  };
  const linkOne = (runId) => {
    if (!projectId) return false;
    const data = S.getState().projects[projectId] || {};
    return saveLinks([...(data.linkedRunIds || []), runId]);
  };
  root.querySelector("#run-link-search")?.addEventListener("input", (e) => {
    linkState.query = e.target.value;
    linkState.limit = 20;
    paintCandidates();
  });
  linkResults?.addEventListener("click", (e) => {
    if (e.target.closest("[data-run-more]")) {
      linkState.limit += 20;
      paintCandidates();
      return;
    }
    const link = e.target.closest("[data-link-run]");
    if (link) linkOne(link.dataset.linkRun);
  });
  root.querySelectorAll("[data-unlink-run]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const runId = btn.dataset.unlinkRun;
      const data = S.getState().projects[projectId] || {};
      saveLinks((data.linkedRunIds || []).filter((id) => id !== runId));
    }),
  );
  root.querySelector('[data-action="link-suggested"]')?.addEventListener("click", () => {
    if (!projectId) return;
    const suggested = suggestedRunsForProject(projectId, currentAllRuns()).map((run) => run.id);
    saveLinks([...(S.getState().projects[projectId]?.linkedRunIds || []), ...suggested]);
  });

  root.querySelector('[data-action="export-project"]')?.addEventListener("click", (e) => {
    const pid = e.currentTarget.dataset.id;
    const p = getProject(pid);
    const s = S.getState();
    const data = s.projects[pid] || {};
    const allRuns = allProjectRuns(s.runs, s.archive);
    const linkInfo = linkedRunsForProject(data, allRuns);
    import("../ui.js").then(({ download }) => {
      download(projectArchiveMarkdown(p, data, linkInfo.runs, linkInfo.missing), `${pid}-项目档案.md`);
    });
  });
}

export function projectArchiveMarkdown(project, data = {}, linkedRuns = [], missingIds = []) {
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
    ? linkedRuns.map((run) => {
        const artifacts = (run.artifacts || []).length
          ? run.artifacts.map((artifact) => `- ${artifact.name || artifact.path || JSON.stringify(artifact)}${artifact.url ? ` (${artifact.url})` : ""}`).join("\n")
          : "未记录";
        const evidence = run.evidence ?? run.evidenceText ?? null;
        return `### ${run.lab} · ${run.time}

- 记录 ID：${run.id}
- 状态：${run.passed === true ? "验证通过" : run.passed === false ? "未通过/探索记录" : "未判定"}
- 模式：${run.mode || "未记录"}
- 摘要：${run.summary || "未填写"}

#### 配置

\`\`\`json
${JSON.stringify(run.config ?? null, null, 2)}
\`\`\`

#### 指标

\`\`\`json
${JSON.stringify(run.metrics ?? null, null, 2)}
\`\`\`

#### 产物

${artifacts}

#### 证据

\`\`\`json
${JSON.stringify(evidence, null, 2)}
\`\`\``;
      }).join("\n\n")
    : "尚未关联可读取的实验记录。";
  const missing = missingIds.length
    ? `\n\n## 关联记录缺失\n\n以下 ID 仍在项目关联中，但当前数据里找不到对应运行，导出未静默删除：\n\n${missingIds.map((id) => `- ${id}`).join("\n")}`
    : "";
  return `# ${project.title}\n\n${data.report || "尚未填写报告"}\n\n## 阶段证据状态\n\n${stages}\n\n## 关联实验记录\n\n${runs}${missing}\n`;
}
