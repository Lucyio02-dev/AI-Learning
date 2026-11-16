import {
  courses,
  tracks,
  labInfo,
  projects,
  getCourse,
  getSections,
} from "./src/content.js";
import { load, persist, exported, parseImport } from "./src/store.js";
import {
  retrieve,
  promptDemo,
  newAgent,
  agentStep,
  motion,
  assessRag,
} from "./src/labs.js";

const loaded = load(localStorage);
let state = loaded.state;
let readOnly = !!loaded.readOnly;
let route = { page: "home" },
  query = "",
  filter = "all",
  resourceQuery = "",
  noteId = "foundation",
  agent = newAgent(),
  currentRun = null;
const root = document.querySelector("#app");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16",
  lab: "M9 3h6m-5 0v7L4 20h16l-6-10V3M8 15h8",
  project: "M3 7h7l2-3h9v16H3Z",
  book: "M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3Zm9 2v16",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  search: "M20 20l-5-5m2-6a6 6 0 1 1-12 0 6 6 0 0 1 12 0",
  chevron: "m9 5 7 7-7 7",
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M6 6l1 1m10 10 1 1M6 18l1-1M17 7l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
};
const icon = (name = "arrow") =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.arrow}"/></svg>`;
const button = (text, action, cls = "secondary", extra = "") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const go = (page, id = "", step = 0) => {
  route = { page, id, step };
  location.hash = [page, id, step].join("/");
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
};
function toast(text) {
  const el = document.querySelector("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4200);
}
function save() {
  const ok = !readOnly && persist(localStorage, state);
  const status = document.querySelector("#save-status");
  if (status)
    status.textContent = ok ? "已保存在此浏览器" : "保存失败，请立即导出备份";
  if (!ok) toast("浏览器存储不可用或空间不足，请立即导出备份。");
  return ok;
}
function download(content, name, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function record(lab, summary, evidence, passed) {
  const r = {
    id: crypto.randomUUID(),
    lab,
    time: new Date().toISOString(),
    summary,
    evidence,
    passed,
  };
  state.runs.push(r);
  state.runs = state.runs.slice(-100);
  if (passed) {
    const id = labInfo[lab].course;
    state.progress[id] = {
      ...state.progress[id],
      diagnosed: true,
      verified: true,
    };
  }
  save();
  currentRun = r;
  toast(
    passed ? "已记录诊断证据与验证结果" : "已保存本次实验，可根据反馈继续尝试",
  );
}
const countEvidence = () =>
  Object.values(state.progress).reduce(
    (n, p) =>
      n +
      ["explained", "implemented", "diagnosed", "verified"].filter((k) => p[k])
        .length,
    0,
  );
function shell(body) {
  const nav = [
    ["home", "home", "我的学习"],
    ["routes", "map", "学习路线"],
    ["labs", "lab", "实验室"],
    ["projects", "project", "项目空间"],
    ["library", "book", "资料与笔记"],
  ];
  return `<div class="shell"><aside class="sidebar"><a class="brand" href="#home"><span class="brand-symbol">a<span>i</span></span><span>AI Learning<small>学习实验室</small></span></a><div class="nav-label">WORKSPACE</div><nav aria-label="主导航">${nav.map(([p, i, t]) => `<button data-page="${p}" class="nav-item ${route.page === p || (p === "routes" && route.page === "course") || (p === "labs" && route.page === "lab") ? "active" : ""}" ${route.page === p ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span>${route.page === p ? '<span class="nav-dot"></span>' : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="local-dot">本地学习空间</div><p>笔记与实验保存在此浏览器<br>定期备份，让积累留得住。</p><button class="text-button" data-action="backup">导出学习备份 ${icon("arrow")}</button><label class="text-button file-label">导入备份<input type="file" id="import" accept=".json,application/json"></label></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumb">学习空间 <span>/</span> ${esc({ home: "我的学习", routes: "学习路线", course: "课程学习", labs: "实验室", lab: "实验工作台", projects: "项目空间", library: "资料与笔记" }[route.page])}</div><div class="top-meta"><span class="status-dot"></span><span id="save-status">保存在此浏览器</span><span class="avatar">学</span></div></header><main id="main" tabindex="-1">${body}</main><footer>AI LEARNING LAB <span>理解 · 实现 · 诊断 · 验证</span><span>本地版 2.0</span></footer></div></div>`;
}
const sectionHead = (over, title, sub = "") =>
  `<div class="page-heading"><div><span class="eyebrow">${over}</span><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div></div>`;
function home() {
  const c = getCourse(state.last.course),
    step = state.last.step || 0;
  const learned = Object.values(state.progress).filter((p) => p.read).length;
  return `${sectionHead("KEEP EXPLORING", "把好奇心，变成真正的能力。", "从一个问题开始，带着证据继续向前。")}<div class="home-grid"><section class="hero"><div class="hero-top"><span class="pill dark">继续你的探索</span><span>LEARNING IN PROGRESS</span></div><div class="hero-layout"><div><div class="hero-course">${tracks[c.track]} / 第 ${step + 1} 步</div><h2>${esc(c.title)}</h2><p>${esc(c.outcome)}</p><div class="hero-details"><span>约 ${c.duration} 分钟</span><span>${c.lab ? "浏览器内可体验" : "外部实践指南"}</span></div><button class="primary light" data-course="${c.id}" data-step="${step}">继续学习 ${icon("arrow")}</button></div><div class="orbit" aria-hidden="true"><div class="orbit-line"></div><div class="orbit-line second"></div><div class="orbit-core">AI<small>LEARN BY DOING</small></div><span class="orb one"></span><span class="orb two"></span><span class="orb three"></span></div></div><div class="hero-bottom"><span>01 理解现象</span><span>02 动手修改</span><span>03 验证结论</span></div></section><aside class="panel focus-panel"><span class="eyebrow">YOUR DIRECTION</span><h2>这次，想走向哪里？</h2><label for="goal">当前学习目标</label><select id="goal">${[
    ["llm", "构建大模型应用"],
    ["embodied", "探索具身智能"],
    ["research", "开展研究与复现"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${state.goal === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select><p>公共基础与方向课程共享。随时调整，已有积累都会保留。</p><button class="text-button" data-page="routes">查看适合的路线 ${icon("arrow")}</button><div class="mini-stats"><div><strong>${learned}</strong><span>已读课程</span></div><div><strong>${countEvidence()}</strong><span>能力证据</span></div><div><strong>${state.runs.length}</strong><span>实验记录</span></div></div></aside></div><div class="section-title"><h2>在动手中，理解它。</h2><button class="text-button" data-page="labs">全部实验 ${icon("arrow")}</button></div><div class="lab-grid">${Object.entries(
    labInfo,
  )
    .map(([id, l], i) => labCard(id, l, i))
    .join(
      "",
    )}</div><div class="lower-grid"><section class="panel"><div class="section-title"><h2>你的能力，用证据说话</h2><span class="muted">学习行为与能力分别记录</span></div><div class="ability-row">${[
    ["解释", "说明为什么"],
    ["实现", "改变一个变量"],
    ["诊断", "找到失败环节"],
    ["验证", "用对照支持结论"],
  ]
    .map(
      ([a, b], i) =>
        `<div><span class="ability-number">0${i + 1}</span><strong>${a}</strong><p>${b}</p></div>`,
    )
    .join(
      "",
    )}</div></section><section class="panel"><span class="eyebrow">RECENT ACTIVITY</span><h2>最近一次实验</h2>${state.runs.length ? `<p>${esc(state.runs.at(-1).summary)}</p><span class="pill">${state.runs.at(-1).passed ? "验证通过" : "保留失败，继续探索"}</span>` : '<p>还没有实验记录。试着定位一次错误回答，留下第一份证据。</p><button class="text-button" data-lab="rag">进入 RAG 诊断 ' + icon("arrow") + "</button>"}</section></div>`;
}
function labCard(id, l, i) {
  return `<button class="lab-card" data-lab="${id}"><div class="lab-card-top"><span class="lab-symbol tone-${i}">${icon(["sun", "search", "project", "map"][i])}</span><span class="lab-number">LAB / 0${i + 1}</span></div><h3>${l.title}</h3><p>${l.subtitle}</p><div class="lab-card-bottom"><span>${l.kind}</span>${icon("arrow")}</div></button>`;
}
function routes() {
  const selected = filter === "all" ? state.goal : filter;
  return `${sectionHead("LEARNING PATHS", "找到起点，也看见远方。", "公共基础 → 方向实践 → 独立项目 → 研究探索。课程始终开放，按需补学。")}<div class="route-banner"><div><span class="pill">推荐方向 · ${tracks[state.goal]}</span><h2>先理解，再带着问题动手。</h2><p>打开课程查看先修。绿色标记记录已读，能力证据由实验结果支持。</p></div>${icon("map")}</div><div class="toolbar"><div class="tabs" role="group" aria-label="课程方向">${Object.entries(
    tracks,
  )
    .map(
      ([id, t]) =>
        `<button data-filter="${id}" class="tab ${filter === id ? "selected" : ""}" aria-pressed="${filter === id}">${t}</button>`,
    )
    .join(
      "",
    )}</div><label class="search-field">${icon("search")}<input id="course-search" value="${esc(query)}" aria-label="搜索课程" placeholder="搜索 RAG、坐标、微调…"></label></div><div id="course-results">${courseResults()}</div>`;
}
function courseResults() {
  const q = query.toLowerCase().trim();
  const items = courses.filter(
    (c) =>
      (filter === "all" || c.track === filter) &&
      (!q ||
        `${c.title} ${c.tags.join(" ")} ${c.outcome}`
          .toLowerCase()
          .includes(q)),
  );
  return items.length
    ? `<div class="course-grid">${items.map((c) => `<article class="course-card"><div class="card-meta"><span class="pill">${tracks[c.track]}</span><span>${state.progress[c.id]?.read ? "✓ 已读" : "约 " + c.duration + " 分钟"}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.outcome)}</p><div class="tags">${c.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div><div class="card-foot"><span>${c.lab ? "含互动实验" : "外部实践指南"}</span><button class="text-button" data-course="${c.id}">进入课程 ${icon("arrow")}</button></div></article>`).join("")}</div>`
    : `<div class="empty"><h2>暂时没有找到“${esc(query)}”</h2><p>可以搜索“推理”“Agent”“坐标”，或切换到全部课程。</p>${button("清空筛选", "clear-search")}</div>`;
}
function coursePage() {
  const c = getCourse(route.id),
    sections = getSections(c),
    step = Math.max(0, Math.min(3, Number(route.step) || 0));
  state.last = { course: c.id, step };
  save();
  return `<button class="text-button back" data-page="routes">← 返回学习路线</button><div class="course-title"><span class="eyebrow">${tracks[c.track]} / ${c.level}</span><h1>${esc(c.title)}</h1><p>${esc(c.outcome)}</p></div><div class="lesson-layout"><aside class="panel lesson-index"><span class="eyebrow">本节学习</span>${sections.map(([t], i) => `<button class="lesson-step ${i === step ? "selected" : ""}" data-course="${c.id}" data-step="${i}"><span>0${i + 1}</span>${esc(t)}</button>`).join("")}<div class="prereq"><strong>先修知识</strong>${c.prerequisites.length ? c.prerequisites.map((id) => `<button class="text-button" data-course="${id}">${esc(getCourse(id).title)} ↗</button>`).join("") : "<p>无需先修，从这里开始。</p>"}</div></aside><article class="panel lesson-body"><span class="eyebrow">STEP 0${step + 1} / 04</span><h2>${esc(sections[step][0])}</h2><p class="lesson-text">${esc(sections[step][1])}</p><div class="callout"><strong>停一下，做一个预测。</strong><p>在查看结果之前，写下你的判断。观察后比较差异，并记录支持结论的证据。</p></div>${c.id === "ch01" ? '<pre><code>python -m pip install -r experiments/requirements.txt\npython experiments/inference.py --check\npython experiments/inference.py</code></pre><a class="secondary" href="./experiments/inference.py" download>下载真实推理脚本</a>' : ""}<div class="lesson-controls">${step ? `<button class="secondary" data-course="${c.id}" data-step="${step - 1}">上一步</button>` : "<span></span>"}${step < 3 ? `<button class="primary" data-course="${c.id}" data-step="${step + 1}">下一步 ${icon("arrow")}</button>` : button(state.progress[c.id]?.read ? "已记录阅读" : "记录阅读完成", "read", "primary", `data-id="${c.id}"`)}</div>${c.lab ? `<div class="lesson-lab"><div><span class="eyebrow">LEARN BY DOING</span><h3>${labInfo[c.lab].title}</h3><p>${labInfo[c.lab].kind}</p></div><button class="primary" data-lab="${c.lab}">进入实验 ${icon("arrow")}</button></div>` : ""}<div class="section-title"><h3>延伸资料</h3><span class="muted">来源链接 · 外部打开</span></div>${c.resources.map((r) => `<a class="resource-link" href="${esc(r.url)}" target="_blank" rel="noreferrer"><span>${esc(r.title)}<small>${r.kind} · 独立来源，运行条件请查看原文</small></span>↗</a>`).join("")}<p class="caption">资源主题映射核对：2026-11-16。外部实验的依赖兼容性以原教材为准。</p></article><aside class="panel lesson-note"><span class="eyebrow">YOUR THINKING</span><h3>留下一点自己的理解</h3><label for="lesson-note">预测、证据与疑问</label><textarea id="lesson-note" data-note="${c.id}" placeholder="我原先以为…\n观察到…\n因此我认为…\n还需要验证…">${esc(state.notes[c.id]?.body || "")}</textarea><small id="draft-status">自动保存到此浏览器</small><p>写下猜测也有价值。能力验证请在实验中完成。</p></aside></div>`;
}
function labs() {
  return `${sectionHead("LEARN BY DOING", "让每一次尝试，都有反馈。", "先预测，后观察。保留失败，找到证据。")}<div class="lab-grid">${Object.entries(
    labInfo,
  )
    .map(([id, l], i) => labCard(id, l, i))
    .join(
      "",
    )}</div><section class="panel history"><h2>实验记录 <span class="muted">${state.runs.length} 次 · 最近 100 次</span></h2>${
    state.runs.length
      ? state.runs
          .slice()
          .reverse()
          .map(
            (r) =>
              `<details><summary><span class="pill ${r.passed ? "success" : ""}">${r.passed ? "验证通过" : "探索记录"}</span> ${esc(labInfo[r.lab]?.title || r.lab)}<span class="muted">${new Date(r.time).toLocaleString("zh-CN")}</span></summary><p>${esc(r.summary)}</p><pre>${esc(r.evidence)}</pre><button class="text-button" data-lab="${esc(r.lab)}">再次探索 →</button></details>`,
          )
          .join("")
      : '<div class="empty"><p>从上方选择一个实验，留下第一条记录。</p></div>'
  }</section>`;
}
function labPage() {
  const id = labInfo[route.id] ? route.id : "rag",
    l = labInfo[id];
  return `<button class="text-button back" data-page="labs">← 返回实验室</button>${sectionHead("EXPERIMENT WORKBENCH", l.title, l.subtitle)}<div class="experiment-info"><span class="pill">${l.kind}</span><span>无需独立显卡 · 不发送数据到模型服务</span><button class="text-button" data-course="${l.course}">补学相关原理 ↗</button></div><div class="experiment-layout"><section class="panel experiment-controls">${id === "prompt" ? promptControls() : id === "rag" ? ragControls() : id === "agent" ? agentControls() : motionControls()}</section><section class="panel experiment-output"><div class="section-title"><h2>观察与证据</h2><span class="live-label">LOCAL EXPERIMENT</span></div><div id="output" aria-live="polite"><div class="output-empty">${icon("lab")}<h3>先做预测，再运行实验。</h3><p>运行后，这里会展示过程、证据与验证反馈。</p></div></div></section></div>`;
}
function promptControls() {
  return `<span class="eyebrow">01 / CONFIGURE</span><h2>同一个问题，改变输入</h2><div class="callout"><strong>什么时候可以退选课程？</strong><p>默认没有提供当前学期规定。</p></div><label class="check-row"><input id="p-evidence" type="checkbox">补充当前学期规定</label><label class="check-row"><input id="p-format" type="checkbox">要求 JSON 输出</label><label class="check-row"><input id="p-conflict" type="checkbox">加入互相冲突的输出要求</label><label for="p-predict">预测：当前最需要解决什么？</label><select id="p-predict"><option value="evidence">缺少事实证据</option><option value="conflict">指令冲突</option><option value="ready">证据已具备，核验输出</option></select>${button("运行教学对照", "run-prompt", "primary full")}<p class="caption">这是固定规则示例，不生成模型输出，不测量真实模型准确率。用于学习如何区分变量。</p>`;
}
function ragControls() {
  return `<span class="eyebrow">01 / RETRIEVE</span><h2>检索有结果，答案就对了吗？</h2><label for="r-query">查询问题</label><input id="r-query" value="选课课程退选截止时间"><div class="control-pair"><div><label for="r-k">取回条数</label><select id="r-k"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div></div><label class="check-row"><input id="r-current" type="checkbox">只检索当前版本</label><label class="check-row"><input id="r-missing" type="checkbox">注入故障：移除当前规定</label><label for="r-diagnosis">诊断：这个配置最大的风险是什么？</label><select id="r-diagnosis"><option value="version">旧版与当前规定混合</option><option value="missing">正确证据缺失，应补充资料</option><option value="grounding">已筛选版本，仍需核验引用与答案</option></select>${button("检索并查看证据", "run-rag", "primary full")}<p class="caption">实际运行词项匹配检索；4 份虚构校园资料用于教学。不调用生成模型，不能据此评估 LLM。</p>`;
}
function agentControls() {
  return `<span class="eyebrow">01 / RECOVER</span><h2>预约写入后，客户端超时</h2><p>系统已发起一次预约写入。超时后，无法仅凭客户端错误判断是否生效。</p><div class="callout"><strong>目标：一条有效预约</strong><p>不重复创建；按请求标识核验；保留执行状态。</p></div><div class="stack">${button("启动故障任务", "agent-start", "primary")}${button("原样重试写入", "agent-retry", "secondary", "disabled")}${button("先查询实际写入状态", "agent-verify", "secondary", "disabled")}${button("从检查点恢复并验证", "agent-finish", "secondary", "disabled")}</div><p class="caption">固定模拟：服务端已提交但响应丢失。可重置后比较两种策略，不执行真实预约。</p>`;
}
function motionControls() {
  return `<span class="eyebrow">01 / TRANSFORM</span><h2>世界里的目标，机体里的动作</h2><p>机器人在原点，目标在世界坐标 (3, 2)。动作接口接收机体坐标位移。</p><label for="m-angle">机器人朝向（度）</label><input id="m-angle" type="range" min="0" max="180" step="15" value="90"><output id="angle-value">90°</output><label class="check-row"><input id="m-correct" type="checkbox">先把世界位移转换到机体坐标</label><label for="m-predict">预测：需要先修复什么？</label><select id="m-predict"><option value="frame">坐标转换</option><option value="verify">转换已启用，检查实际误差</option></select>${button("执行并查看轨迹", "run-motion", "primary full")}<p class="caption">二维刚体运动学，无障碍物、噪声和动力学。不是机器人策略训练，也不能代表真实设备安全性。</p>`;
}
function projectPage() {
  return `${sectionHead("BUILD SOMETHING REAL", "让知识，在项目里连起来。", "先完成任务，再用证据讲清楚你的选择。项目报告会自动保存。")}<div class="project-grid">${projects.map((p) => `<article class="panel project-card"><span class="eyebrow">${p.tag}</span><h2>${p.title}</h2><p>${p.summary}</p><ol class="project-steps">${p.steps.map(([id, t], i) => `<li><button class="text-button" data-course="${id}">${t} ${icon("arrow")}</button><small>${i === 1 ? "完成实验并保存证据" : "阅读、实践与记录"}</small></li>`).join("")}</ol><label for="report-${p.id}">项目报告 · 自动草稿</label><textarea id="report-${p.id}" data-report="${p.id}" placeholder="${esc(p.questions.join("\n"))}">${esc(state.reports[p.id] || "")}</textarea><div class="card-foot"><span class="muted">已关联 ${state.runs.filter((r) => (p.id === "robot" ? r.lab === "embodied" : ["rag", "agent", "prompt"].includes(r.lab))).length} 条实验</span><button class="secondary" data-action="export-project" data-id="${p.id}">导出项目档案</button></div></article>`).join("")}</div>`;
}
function library() {
  const current = state.notes[noteId] || {};
  return `${sectionHead("YOUR KNOWLEDGE", "把资料，变成自己的理解。", "收藏可信来源，记录预测与证据，保留探索的过程。")}<div class="library-tabs"><button class="secondary" data-action="new-note">＋ 新建笔记</button><button class="secondary" data-action="export-note">导出当前笔记</button><label class="secondary file-label">预览本机 PDF<input id="pdf-file" type="file" accept="application/pdf"></label></div><div class="notes-layout"><aside class="panel note-index"><h3>学习笔记</h3>${[...new Set([...courses.map((c) => c.id), ...Object.keys(state.notes)])].map((id) => `<button class="note-link ${id === noteId ? "selected" : ""}" data-note-id="${esc(id)}"><strong>${esc(state.notes[id]?.title || getCourse(id).title)}</strong><small>${state.notes[id]?.body ? "已有草稿" : "尚未记录"}</small></button>`).join("")}</aside><section class="panel note-editor"><label for="note-title">标题</label><input id="note-title" value="${esc(current.title || getCourse(noteId).title)}"><label for="note-body">笔记正文 · 纯文本 / Markdown</label><textarea id="note-body" placeholder="写下预测、观察、结论和仍需验证的问题…">${esc(current.body || "")}</textarea><small id="draft-status">自动保存到此浏览器</small><div id="pdf-preview"></div></section></div><div class="section-title"><h2>资料收藏</h2><label class="search-field">${icon("search")}<input id="resource-search" value="${esc(resourceQuery)}" aria-label="搜索资料" placeholder="搜索教材、论文…"></label></div><div id="resources">${resourceResults()}</div><section class="panel media-panel"><h2>我的视频链接</h2><p>外部页面在新标签打开。本机视频仅在当前浏览器播放。</p><form id="video-form" class="video-form"><input id="video-title" aria-label="视频标题" placeholder="视频标题" required><input id="video-url" type="url" aria-label="视频网址" placeholder="https://…" required><button class="secondary">添加链接</button></form><div id="video-links">${state.videos.map((v) => `<a class="resource-link" href="${esc(v.url)}" target="_blank" rel="noreferrer">${esc(v.title)} ↗</a>`).join("")}</div><label class="secondary file-label">播放本机视频<input id="video-file" type="file" accept="video/*"></label><video id="local-video" controls hidden></video></section>${state.legacy ? '<div class="callout"><strong>旧版数据已保留</strong><p>笔记和实验记录已迁移。旧版收藏与打卡完整保存在导出备份的 legacy 字段中，未转换为能力证据。</p></div>' : ""}`;
}
function resourceResults() {
  const resources = courses.flatMap((c) =>
    c.resources.map((r, i) => ({ ...r, id: `${c.id}-${i}`, course: c.title })),
  );
  const q = resourceQuery.toLowerCase();
  const items = resources.filter((r) =>
    `${r.title} ${r.course} ${r.kind}`.toLowerCase().includes(q),
  );
  return items.length
    ? `<div class="resource-grid">${items.map((r) => `<article class="resource-card"><div class="card-meta"><span class="pill">${r.kind}</span><button class="favorite ${state.favorites.includes(r.id) ? "on" : ""}" data-favorite="${r.id}" aria-label="${state.favorites.includes(r.id) ? "取消收藏" : "收藏"} ${esc(r.title)}" aria-pressed="${state.favorites.includes(r.id)}">${state.favorites.includes(r.id) ? "★" : "☆"}</button></div><h3>${esc(r.title)}</h3><p>${esc(r.course)}</p><a class="text-button" href="${esc(r.url)}" target="_blank" rel="noreferrer">打开来源 ↗</a></article>`).join("")}</div>`
    : '<div class="empty"><p>没有匹配资料，请尝试其他关键词。</p></div>';
}
function render() {
  root.innerHTML = shell(
    (
      {
        home,
        routes,
        course: coursePage,
        labs,
        lab: labPage,
        projects: projectPage,
        library,
      }[route.page] || home
    )(),
  );
}
function parseRoute() {
  const [page, id, step] = location.hash.slice(1).split("/");
  route = { page: page || "home", id, step: Number(step) || 0 };
  render();
}
root.addEventListener("click", (e) => {
  const el = e.target.closest("button,[data-page]");
  if (!el) return;
  if (el.dataset.page) {
    go(el.dataset.page);
    return;
  }
  if (el.dataset.course) {
    go("course", el.dataset.course, Number(el.dataset.step) || 0);
    return;
  }
  if (el.dataset.lab) {
    agent = newAgent();
    go("lab", el.dataset.lab);
    return;
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    render();
    return;
  }
  if (el.dataset.noteId) {
    noteId = el.dataset.noteId;
    render();
    return;
  }
  if (el.dataset.favorite) {
    const id = el.dataset.favorite;
    state.favorites = state.favorites.includes(id)
      ? state.favorites.filter((x) => x !== id)
      : [...state.favorites, id];
    save();
    render();
    return;
  }
  action(el.dataset.action, el);
});
function action(a, el) {
  if (a === "backup") {
    state.backedUp = new Date().toISOString();
    save();
    download(exported(state), "ai-learning-backup.json", "application/json");
    toast("备份已导出，包含笔记、实验与旧版原始数据。");
  }
  if (a === "clear-search") {
    filter = "all";
    query = "";
    render();
  }
  if (a === "read") {
    state.progress[el.dataset.id] = {
      ...state.progress[el.dataset.id],
      read: true,
    };
    save();
    el.textContent = "已记录阅读";
    toast("阅读已记录。动手实验可继续留下能力证据。");
  }
  if (a === "new-note") {
    noteId = `note-${Date.now()}`;
    state.notes[noteId] = {
      title: "新的探索笔记",
      body: "",
      updated: new Date().toISOString(),
    };
    save();
    render();
    document.querySelector("#note-title").focus();
  }
  if (a === "export-note") {
    const n = state.notes[noteId] || {
      title: getCourse(noteId).title,
      body: "",
    };
    download(`# ${n.title}\n\n${n.body || ""}\n`, "学习笔记.md");
  }
  if (a === "export-project") {
    const p = projects.find((p) => p.id === el.dataset.id);
    const runs = state.runs.filter((r) =>
      p.id === "robot"
        ? r.lab === "embodied"
        : ["prompt", "rag", "agent"].includes(r.lab),
    );
    download(
      `# ${p.title}\n\n${state.reports[p.id] || "尚未填写报告"}\n\n## 实验记录\n\n${runs.map((r) => `### ${labInfo[r.lab]?.title} · ${r.time}\n\n${r.summary}\n\n${r.evidence}`).join("\n\n")}`,
      `${p.id}-项目档案.md`,
    );
  }
  if (a === "run-prompt") {
    const options = {
      evidence: document.querySelector("#p-evidence").checked,
      format: document.querySelector("#p-format").checked,
      conflict: document.querySelector("#p-conflict").checked,
    };
    const r = promptDemo(options),
      passed = document.querySelector("#p-predict").value === r.diagnosis;
    output(
      `<span class="pill">规则演示结果</span><pre>${esc(r.answer)}</pre><h3>${passed ? "预测与现象一致" : "对比你的预测"}</h3><p>${esc(r.reason)}</p><div class="callout">真实模型实验还需固定版本与采样，重复运行并评估未见样例。</div>`,
    );
    record(
      "prompt",
      passed ? "正确识别输入中的关键问题" : "保留了一次输入对照",
      JSON.stringify({ options, ...r }, null, 2),
      passed,
    );
  }
  if (a === "run-rag") {
    const options = {
      topK: Number(document.querySelector("#r-k").value),
      currentOnly: document.querySelector("#r-current").checked,
      missing: document.querySelector("#r-missing").checked,
    };
    const q = document.querySelector("#r-query").value,
      docs = retrieve(q, options),
      answer = document.querySelector("#r-diagnosis").value;
    const passed =
      docs.some((d) => ["archive", "current"].includes(d.id)) &&
      assessRag(answer, options);
    output(
      `${docs.length ? docs.map((d) => `<article class="evidence-card"><div class="card-meta"><span class="pill ${d.current ? "success" : ""}">${d.current ? "当前资料" : "历史资料"}</span><span>匹配分 ${d.score}</span></div><h3>${esc(d.title)}</h3><small>${d.date} · ${d.id}</small><p>${esc(d.text)}</p></article>`).join("") : '<div class="empty"><h3>没有召回证据</h3><p>检查查询、索引与资料覆盖，不能据此编造答案。</p></div>'}<div class="feedback ${passed ? "pass" : ""}"><strong>${passed ? "诊断通过" : "继续检查证据"}</strong><p>${options.missing ? "当前规定已移除，应补充来源，增加 Top-K 不能找回不存在的资料。" : options.currentOnly ? "已按版本过滤；检索成功后仍应核验引用与回答。" : "资料包含不同版本，应先确认适用学期，不能简单采用第一条。"}</p>${!docs.length ? "<p>当前查询无证据，未计为验证通过。</p>" : ""}</div>`,
    );
    record(
      "rag",
      passed ? "依据检索证据完成诊断" : "完成检索，继续诊断",
      JSON.stringify(
        { query: q, options, diagnosis: answer, documents: docs },
        null,
        2,
      ),
      passed,
    );
  }
  if (a?.startsWith("agent-")) {
    if (a === "agent-start") agent = newAgent();
    agent = agentStep(
      agent,
      a.replace("agent-", "") === "start" ? "start" : a.replace("agent-", ""),
    );
    document.querySelector('[data-action="agent-start"]').textContent =
      "重置并启动任务";
    document.querySelector('[data-action="agent-retry"]').disabled =
      agent.phase !== "interrupted" || agent.done;
    document.querySelector('[data-action="agent-verify"]').disabled =
      agent.phase !== "interrupted" || agent.done;
    document.querySelector('[data-action="agent-finish"]').disabled =
      agent.phase !== "checked" || agent.done;
    output(
      `<ol class="trace">${agent.log.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><div class="feedback ${agent.passed ? "pass" : ""}"><strong>写入次数：${agent.writes}</strong><p>${agent.done ? (agent.passed ? "已核验一条有效预约。" : "发生重复写入。重置后尝试先查询状态。") : "检查当前状态，再选择下一步。"}</p></div>`,
    );
    if (agent.done)
      record(
        "agent",
        agent.passed ? "核验写入后从检查点恢复" : "原样重试导致重复预约",
        agent.log.join("\n"),
        agent.passed,
      );
  }
  if (a === "run-motion") {
    const angle = Number(document.querySelector("#m-angle").value),
      correct = document.querySelector("#m-correct").checked,
      r = motion(angle, correct),
      predict = document.querySelector("#m-predict").value;
    const passed = correct && r.error < 0.01 && predict === "verify";
    const sx = (x) => 220 + x * 32,
      sy = (y) => 190 - y * 32;
    output(
      `<svg class="motion-plot" viewBox="0 0 440 380" role="img" aria-label="目标与实际位置轨迹，误差 ${r.error.toFixed(2)}"><defs><pattern id="grid" width="55" height="55" patternUnits="userSpaceOnUse"><path d="M55 0H0V55" fill="none" stroke="#e0e6e2"/></pattern></defs><rect width="440" height="380" fill="url(#grid)"/><path d="M220 20V350M30 190H410" stroke="#7b8c85" fill="none"/><path d="M220 190L${sx(r.actual.x)} ${sy(r.actual.y)}" stroke="#397b68" stroke-width="3" stroke-dasharray="7 5"/><circle cx="${sx(r.target.x)}" cy="${sy(r.target.y)}" r="9" fill="#ce8b42"/><circle cx="${sx(r.actual.x)}" cy="${sy(r.actual.y)}" r="6" fill="#205947"/><circle cx="220" cy="190" r="8" fill="#203e35"/><text x="230" y="215">起点 (0,0)</text><text x="${sx(3) + 12}" y="${sy(2) - 12}">目标 (3,2)</text><text x="375" y="215">世界 x</text></svg><div class="metric-strip"><div><span>机体动作</span><strong>(${r.body.x.toFixed(2)}, ${r.body.y.toFixed(2)})</strong></div><div><span>实际位置</span><strong>(${r.actual.x.toFixed(2)}, ${r.actual.y.toFixed(2)})</strong></div><div><span>位置误差</span><strong>${r.error.toFixed(3)}</strong></div></div><div class="feedback ${passed ? "pass" : ""}"><strong>${passed ? "变换与验证通过" : "观察参考系与误差"}</strong><p>${correct ? "世界位移已先转换为机体动作，再由执行系统旋转回世界坐标。" : "世界位移被当成机体位移执行，朝向非零时可能偏离目标。朝向为零的成功不能证明转换正确。"}</p></div>`,
    );
    record(
      "embodied",
      passed ? "正确转换坐标并核验误差" : "观察到一次坐标执行结果",
      JSON.stringify({ angle, correct, ...r }, null, 2),
      passed,
    );
  }
}
const output = (html) => {
  document.querySelector("#output").innerHTML = html;
};
root.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "course-search") {
    query = el.value;
    document.querySelector("#course-results").innerHTML = courseResults();
  }
  if (el.id === "resource-search") {
    resourceQuery = el.value;
    document.querySelector("#resources").innerHTML = resourceResults();
  }
  if (el.id === "m-angle")
    document.querySelector("#angle-value").textContent = `${el.value}°`;
  let changed = false;
  if (el.dataset.note) {
    const id = el.dataset.note;
    state.notes[id] = {
      ...state.notes[id],
      title: state.notes[id]?.title || getCourse(id).title,
      body: el.value,
      updated: new Date().toISOString(),
    };
    changed = true;
  }
  if (["note-title", "note-body"].includes(el.id)) {
    state.notes[noteId] = {
      ...state.notes[noteId],
      title: document.querySelector("#note-title").value,
      body: document.querySelector("#note-body").value,
      updated: new Date().toISOString(),
    };
    changed = true;
  }
  if (el.dataset.report) {
    state.reports[el.dataset.report] = el.value;
    changed = true;
  }
  if (changed) {
    const ok = save();
    const status = document.querySelector("#draft-status");
    if (status)
      status.textContent = ok
        ? "草稿已保存 · " + new Date().toLocaleTimeString("zh-CN")
        : "保存失败，请导出备份";
  }
});
let pdfUrl, videoUrl;
root.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.id === "goal") {
    state.goal = el.value;
    save();
    toast("学习方向已更新，课程和记录都会保留。");
  }
  if (el.id === "import" && el.files[0]) {
    try {
      const next = parseImport(await el.files[0].text());
      if (!persist(localStorage, next))
        throw Error("存储空间不足，未替换现有数据");
      download(exported(state), "导入前学习备份.json", "application/json");
      state = next;
      readOnly = false;
      render();
      toast("已导入，并下载导入前备份。");
    } catch (error) {
      toast("导入失败：" + error.message);
    }
    el.value = "";
  }
  if (el.id === "pdf-file" && el.files[0]) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(el.files[0]);
    document.querySelector("#pdf-preview").innerHTML =
      `<p>本机 PDF · 不上传 · 关闭页面后需重新选择</p><iframe title="本机 PDF 预览" src="${pdfUrl}"></iframe>`;
  }
  if (el.id === "video-file" && el.files[0]) {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(el.files[0]);
    const v = document.querySelector("#local-video");
    v.src = videoUrl;
    v.hidden = false;
  }
});
root.addEventListener("submit", (e) => {
  if (e.target.id !== "video-form") return;
  e.preventDefault();
  const title = document.querySelector("#video-title").value.trim(),
    url = document.querySelector("#video-url").value.trim();
  if (!/^https?:\/\//i.test(url)) {
    toast("请输入 http 或 https 视频页面链接");
    return;
  }
  state.videos.push({ title, url });
  save();
  render();
  toast("视频链接已保存");
});
window.addEventListener("hashchange", parseRoute);
parseRoute();
if (loaded.message) toast(loaded.message);
// v2 不缓存学习数据。清理由旧版本注册的同目录离线脚本，让修正内容及时生效。
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .getRegistrations()
    .then((rs) =>
      rs
        .filter((r) => r.scope === new URL("./", location.href).href)
        .forEach((r) => r.unregister()),
    )
    .catch(() => {});
