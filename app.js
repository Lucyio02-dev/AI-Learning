const REPO = "https://github.com/Lordog/dive-into-llms";
const COURSE = "https://hiascend.com/developer/courses/detail/1578542990315864066";
const STORE_KEY = "ai-learning-platform-state-v1";

const modules = [
  {
    id: "ch01",
    index: "01",
    title: "微调与部署",
    stage: "基础",
    summary: "完成大模型实践环境搭建，理解微调流程、模型加载、推理与部署的基本闭环。",
    tags: ["Fine-tuning", "Deployment", "Environment"],
    tutorial: `${REPO}/tree/main/documents/chapter1`,
    scripts: `${REPO}/tree/main/documents/chapter1`,
    tasks: [
      ["检查 GPU、Python、CUDA 或 NPU 环境是否可用", "python --version"],
      ["选择一个小模型完成本地推理 smoke test", "python -c \"print('model inference smoke test')\""],
      ["记录微调数据格式、训练参数和部署方式", ""]
    ]
  },
  {
    id: "ch02",
    index: "02",
    title: "提示学习",
    stage: "基础",
    summary: "练习 few-shot、chain-of-thought、角色约束和结构化输出，形成可复用提示模板。",
    tags: ["Prompt", "CoT", "Evaluation"],
    tutorial: `${REPO}/tree/main/documents/chapter2`,
    scripts: `${REPO}/tree/main/documents/chapter2`,
    tasks: [
      ["为同一任务设计 zero-shot、few-shot 和结构化 JSON 三种提示", ""],
      ["用 10 个样例比较提示稳定性和失败模式", ""],
      ["沉淀一个可复用提示模板到笔记区", ""]
    ]
  },
  {
    id: "ch03",
    index: "03",
    title: "知识编辑",
    stage: "进阶",
    summary: "理解模型内部知识更新、定位与编辑的基本思路，比较编辑前后的行为差异。",
    tags: ["Knowledge Editing", "Model Behavior"],
    tutorial: `${REPO}/tree/main/documents/chapter3`,
    scripts: `${REPO}/tree/main/documents/chapter3`,
    tasks: [
      ["准备一个待编辑事实和一组泛化测试问题", ""],
      ["记录编辑前后的回答差异", ""],
      ["分析知识编辑是否引入无关行为变化", ""]
    ]
  },
  {
    id: "ch04",
    index: "04",
    title: "DeepSeekMath 数学推理",
    stage: "进阶",
    summary: "围绕数学推理任务实践数据构造、推理链路和结果评估。",
    tags: ["Reasoning", "Math", "DeepSeekMath"],
    tutorial: `${REPO}/tree/main/documents/chapter4`,
    scripts: `${REPO}/tree/main/documents/chapter4`,
    tasks: [
      ["整理一组数学题并标注标准答案", ""],
      ["比较直接回答和逐步推理的正确率", ""],
      ["记录模型在哪类题型上最容易出错", ""]
    ]
  },
  {
    id: "ch05",
    index: "05",
    title: "多模态大模型",
    stage: "应用",
    summary: "实践图文理解、多模态输入组织和输出校验。",
    tags: ["Multimodal", "Vision", "VLM"],
    tutorial: `${REPO}/tree/main/documents/chapter5`,
    scripts: `${REPO}/tree/main/documents/chapter5`,
    tasks: [
      ["准备 5 张测试图片并写出期望问题", ""],
      ["比较模型对文字、物体和空间关系的识别能力", ""],
      ["把失败案例整理到笔记区", ""]
    ]
  },
  {
    id: "ch06",
    index: "06",
    title: "多模态模型编辑",
    stage: "进阶",
    summary: "学习多模态模型的行为修正、编辑验证和跨输入泛化。",
    tags: ["VLM Editing", "Robustness"],
    tutorial: `${REPO}/tree/main/documents/chapter6`,
    scripts: `${REPO}/tree/main/documents/chapter6`,
    tasks: [
      ["定义一个图文相关的错误知识点", ""],
      ["设计编辑样本和保留样本", ""],
      ["验证编辑是否影响原本正确的能力", ""]
    ]
  },
  {
    id: "ch07",
    index: "07",
    title: "大语言模型测试",
    stage: "进阶",
    summary: "建立测试集、指标和回归评估方式，让实验结果可复现。",
    tags: ["Testing", "Benchmark", "Regression"],
    tutorial: `${REPO}/tree/main/documents/chapter7`,
    scripts: `${REPO}/tree/main/documents/chapter7`,
    tasks: [
      ["为一个任务建立最小测试集", ""],
      ["定义准确性、格式合规、幻觉率等指标", ""],
      ["记录一次 prompt 或模型变更后的回归结果", ""]
    ]
  },
  {
    id: "ch08",
    index: "08",
    title: "大模型水印",
    stage: "安全",
    summary: "理解文本水印、检测与鲁棒性问题，评估生成内容的可追踪性。",
    tags: ["Watermark", "Detection", "Security"],
    tutorial: `${REPO}/tree/main/documents/chapter8`,
    scripts: `${REPO}/tree/main/documents/chapter8`,
    tasks: [
      ["阅读水印生成和检测流程", ""],
      ["生成一组带水印与不带水印文本样例", ""],
      ["测试改写、翻译、摘要对检测结果的影响", ""]
    ]
  },
  {
    id: "ch09",
    index: "09",
    title: "Data-Copilot",
    stage: "应用",
    summary: "实践数据处理智能助手，关注数据理解、清洗建议和自动化分析。",
    tags: ["Data Agent", "Copilot", "Automation"],
    tutorial: `${REPO}/tree/main/documents/chapter9`,
    scripts: `${REPO}/tree/main/documents/chapter9`,
    tasks: [
      ["准备一个 CSV 或表格数据集", ""],
      ["让模型生成清洗和分析计划", ""],
      ["检查模型生成代码的正确性和风险", ""]
    ]
  },
  {
    id: "ch10",
    index: "10",
    title: "大模型 + GUI 智能体",
    stage: "应用",
    summary: "围绕 GUI Agent 练习任务分解、界面观察、操作规划和失败恢复。",
    tags: ["GUI Agent", "Planning", "Tool Use"],
    tutorial: `${REPO}/tree/main/documents/chapter10`,
    scripts: `${REPO}/tree/main/documents/chapter10`,
    tasks: [
      ["定义一个可观察、可验证的 GUI 任务", ""],
      ["拆分观察、计划、执行、校验四个环节", ""],
      ["记录失败恢复策略和边界条件", ""]
    ]
  },
  {
    id: "ch11",
    index: "11",
    title: "大模型安全对齐",
    stage: "安全",
    summary: "学习安全对齐、红队测试、拒答策略和可用性之间的权衡。",
    tags: ["Alignment", "Safety", "Red Team"],
    tutorial: `${REPO}/tree/main/documents/chapter11`,
    scripts: `${REPO}/tree/main/documents/chapter11`,
    tasks: [
      ["整理安全、合规和误拒三个维度的测试问题", ""],
      ["比较不同系统提示对安全表现的影响", ""],
      ["记录模型的高风险失败模式", ""]
    ]
  }
];

const ebooks = [
  {
    title: "《动手学大模型》GitHub 项目",
    type: "在线教程",
    desc: "章节资料、课件、教程和脚本入口。",
    url: REPO
  },
  {
    title: "动手学大模型资料目录",
    type: "在线资料",
    desc: "按章节查看项目中的 documents 内容。",
    url: `${REPO}/tree/main/documents`
  },
  {
    title: "大模型开发全流程在线课程",
    type: "课程",
    desc: "华为昇腾开发者课程入口，可与网页端笔记配合使用。",
    url: COURSE
  }
];

const defaultVideos = [
  {
    title: "大模型开发全流程",
    type: "外部课程",
    url: COURSE,
    desc: "从开发到部署的完整课程入口。"
  },
  {
    title: "Dive into LLMs 配套资料",
    type: "资料入口",
    url: REPO,
    desc: "打开项目后可按章节进入课件和脚本。"
  }
];

const state = loadState();
let currentView = "dashboard";
let currentReaderUrl = null;
let currentVideoUrl = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function defaultState() {
  return {
    activeModule: modules[0].id,
    progress: Object.fromEntries(modules.map((item) => [item.id, { read: false, practice: false, video: false }])),
    notes: {},
    practiceLogs: {},
    videos: []
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return mergeState(defaultState(), parsed || {});
  } catch {
    return defaultState();
  }
}

function mergeState(base, saved) {
  const merged = { ...base, ...saved };
  merged.progress = { ...base.progress, ...(saved.progress || {}) };
  merged.notes = { ...(saved.notes || {}) };
  merged.practiceLogs = { ...(saved.practiceLogs || {}) };
  merged.videos = Array.isArray(saved.videos) ? saved.videos : [];
  if (!modules.some((item) => item.id === merged.activeModule)) merged.activeModule = modules[0].id;
  return merged;
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  renderStats();
  renderQuickGrid();
  renderNoteList();
}

function moduleById(id) {
  return modules.find((item) => item.id === id) || modules[0];
}

function setView(view) {
  currentView = view;
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === `${view}-view`));
  $$(".nav-button").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  const titles = {
    dashboard: "总览",
    curriculum: "学习路线",
    practice: "实践实验",
    library: "电子书",
    videos: "课程视频",
    notes: "学习笔记"
  };
  $("#view-title").textContent = titles[view];
  if (view === "dashboard") drawMap();
}

function renderStats() {
  const totalChecks = modules.length * 3;
  const finishedChecks = modules.reduce((sum, item) => {
    const progress = state.progress[item.id] || {};
    return sum + Number(progress.read) + Number(progress.practice) + Number(progress.video);
  }, 0);
  const read = modules.filter((item) => state.progress[item.id]?.read).length;
  const practice = modules.filter((item) => state.progress[item.id]?.practice).length;
  const notes = Object.values(state.notes).filter((note) => note?.body?.trim()).length;
  $("#stat-progress").textContent = `${Math.round((finishedChecks / totalChecks) * 100)}%`;
  $("#stat-read").textContent = `${read} / ${modules.length}`;
  $("#stat-practice").textContent = `${practice} / ${modules.length}`;
  $("#stat-notes").textContent = String(notes);

  const next = modules.find((item) => !state.progress[item.id]?.practice) || modules[0];
  $("#next-title").textContent = `${next.index}. ${next.title}`;
}

function renderQuickGrid() {
  const target = $("#quick-grid");
  target.innerHTML = "";
  const next = modules.find((item) => !state.progress[item.id]?.practice) || moduleById(state.activeModule);
  const recentNotes = Object.entries(state.notes)
    .filter(([, note]) => note?.body?.trim())
    .slice(-2)
    .map(([id, note]) => ({ ...note, module: moduleById(id) }));

  const cards = [
    {
      title: "继续实践",
      text: `${next.title}: ${next.summary}`,
      action: "打开实践",
      onClick: () => {
        state.activeModule = next.id;
        $("#practice-module").value = next.id;
        renderPractice();
        setView("practice");
      }
    },
    {
      title: "整理笔记",
      text: recentNotes[0] ? `${recentNotes[0].module.title}: ${recentNotes[0].title || "未命名笔记"}` : "还没有笔记，先为当前模块记录关键概念和实验结果。",
      action: "打开笔记",
      onClick: () => setView("notes")
    },
    {
      title: "课程资料",
      text: "查看项目教程、配套资料和你设备上的 PDF。",
      action: "打开书库",
      onClick: () => setView("library")
    }
  ];

  cards.forEach((card) => {
    const el = document.createElement("article");
    el.className = "module-card";
    el.innerHTML = `<div class="card-head"><span class="stage-pill">快捷入口</span></div><h3></h3><p></p><div class="card-actions"></div>`;
    el.querySelector("h3").textContent = card.title;
    el.querySelector("p").textContent = card.text;
    const button = document.createElement("button");
    button.className = "primary-button";
    button.textContent = card.action;
    button.addEventListener("click", card.onClick);
    el.querySelector(".card-actions").append(button);
    target.append(el);
  });
}

function renderModules() {
  const search = $("#module-search").value.trim().toLowerCase();
  const stage = $("#stage-filter").value;
  const target = $("#module-grid");
  const template = $("#module-card-template");
  target.innerHTML = "";

  modules
    .filter((item) => stage === "all" || item.stage === stage)
    .filter((item) => {
      const haystack = `${item.title} ${item.summary} ${item.tags.join(" ")}`.toLowerCase();
      return !search || haystack.includes(search);
    })
    .forEach((item) => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.querySelector(".stage-pill").textContent = item.stage;
      card.querySelector(".module-index").textContent = item.index;
      card.querySelector("h3").textContent = item.title;
      card.querySelector("p").textContent = item.summary;
      const tagRow = card.querySelector(".tag-row");
      item.tags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = tag;
        tagRow.append(span);
      });
      card.querySelectorAll("input[type='checkbox']").forEach((input) => {
        input.checked = Boolean(state.progress[item.id]?.[input.dataset.field]);
        input.addEventListener("change", () => {
          state.progress[item.id][input.dataset.field] = input.checked;
          saveState();
          renderModules();
        });
      });
      const actions = card.querySelector(".card-actions");
      actions.append(linkButton("教程", item.tutorial));
      actions.append(linkButton("脚本", item.scripts));
      const start = document.createElement("button");
      start.className = "primary-button";
      start.textContent = "开始";
      start.addEventListener("click", () => {
        state.activeModule = item.id;
        $("#practice-module").value = item.id;
        $("#note-module").value = item.id;
        renderPractice();
        renderNoteEditor();
        saveState();
        setView("practice");
      });
      actions.append(start);
      target.append(card);
    });
}

function linkButton(text, href) {
  const a = document.createElement("a");
  a.className = "link-button";
  a.href = href;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = text;
  return a;
}

function populateSelects() {
  [$("#practice-module"), $("#note-module")].forEach((select) => {
    select.innerHTML = "";
    modules.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.index}. ${item.title}`;
      select.append(option);
    });
    select.value = state.activeModule;
  });
}

function renderPractice() {
  const id = $("#practice-module").value || state.activeModule;
  const item = moduleById(id);
  state.activeModule = id;
  $("#practice-module-title").textContent = item.title;
  $("#practice-summary").textContent = item.summary;
  $("#practice-log").value = state.practiceLogs[id] || "";
  const target = $("#task-list");
  target.innerHTML = "";

  item.tasks.forEach(([title, command], index) => {
    const task = document.createElement("div");
    task.className = "task-item";
    const heading = document.createElement("strong");
    heading.textContent = `${index + 1}. ${title}`;
    task.append(heading);
    if (command) {
      const code = document.createElement("code");
      code.textContent = command;
      const copy = document.createElement("button");
      copy.className = "copy-button";
      copy.textContent = "复制命令";
      copy.addEventListener("click", () => copyText(command, copy));
      task.append(code, copy);
    }
    target.append(task);
  });
}

function renderLibrary() {
  const target = $("#ebook-list");
  target.innerHTML = "";
  ebooks.forEach((item) => {
    const row = document.createElement("article");
    row.className = "resource-item";
    row.innerHTML = `<span class="stage-pill"></span><strong></strong><p class="muted"></p><div class="resource-actions"></div>`;
    row.querySelector(".stage-pill").textContent = item.type;
    row.querySelector("strong").textContent = item.title;
    row.querySelector("p").textContent = item.desc;
    row.querySelector(".resource-actions").append(linkButton("打开", item.url));
    target.append(row);
  });
}

function renderVideos() {
  const target = $("#video-list");
  target.innerHTML = "";
  [...defaultVideos, ...state.videos].forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "resource-item";
    row.innerHTML = `<span class="stage-pill"></span><strong></strong><p class="muted"></p><div class="resource-actions"></div>`;
    row.querySelector(".stage-pill").textContent = item.type || "自定义";
    row.querySelector("strong").textContent = item.title;
    row.querySelector("p").textContent = item.desc || item.url;
    const actions = row.querySelector(".resource-actions");
    actions.append(linkButton("打开链接", item.url));
    if (item.url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      const play = document.createElement("button");
      play.className = "secondary-button";
      play.textContent = "播放";
      play.addEventListener("click", () => playVideo(item.url));
      actions.append(play);
    }
    if (index >= defaultVideos.length) {
      const remove = document.createElement("button");
      remove.className = "secondary-button";
      remove.textContent = "删除";
      remove.addEventListener("click", () => {
        state.videos.splice(index - defaultVideos.length, 1);
        saveState();
        renderVideos();
      });
      actions.append(remove);
    }
    target.append(row);
  });
}

function renderNoteList() {
  const target = $("#note-list");
  target.innerHTML = "";
  modules.forEach((item) => {
    const note = state.notes[item.id];
    const button = document.createElement("button");
    button.className = `note-item ${item.id === $("#note-module")?.value ? "active" : ""}`;
    button.innerHTML = `<strong></strong><span class="muted"></span>`;
    button.querySelector("strong").textContent = `${item.index}. ${item.title}`;
    button.querySelector("span").textContent = note?.updated ? `更新于 ${note.updated}` : "尚未记录";
    button.addEventListener("click", () => {
      $("#note-module").value = item.id;
      state.activeModule = item.id;
      renderNoteEditor();
      renderNoteList();
      saveState();
    });
    target.append(button);
  });
}

function renderNoteEditor() {
  const id = $("#note-module").value || state.activeModule;
  const item = moduleById(id);
  const note = state.notes[id] || {};
  state.activeModule = id;
  $("#note-title").value = note.title || `${item.title} 学习笔记`;
  $("#note-tags").value = note.tags || item.tags.join(", ");
  $("#note-body").value = note.body || "";
}

function saveNote() {
  const id = $("#note-module").value;
  state.notes[id] = {
    title: $("#note-title").value.trim(),
    tags: $("#note-tags").value.trim(),
    body: $("#note-body").value,
    updated: new Date().toLocaleString("zh-CN", { hour12: false })
  };
  saveState();
  renderNoteList();
}

function downloadNote() {
  const id = $("#note-module").value;
  const item = moduleById(id);
  const title = $("#note-title").value.trim() || `${item.title} 学习笔记`;
  const tags = $("#note-tags").value.trim();
  const body = $("#note-body").value;
  const markdown = `# ${title}\n\n模块：${item.index}. ${item.title}\n\n标签：${tags}\n\n${body}\n`;
  downloadBlob(markdown, `${item.index}-${item.title}-note.md`, "text/markdown;charset=utf-8");
}

function copyText(text, button) {
  const reset = () => setTimeout(() => (button.textContent = "复制命令"), 1200);
  const task = navigator.clipboard?.writeText?.(text);
  if (!task) {
    button.textContent = "手动复制";
    reset();
    return;
  }
  task.then(
    () => {
      button.textContent = "已复制";
      reset();
    },
    () => {
      button.textContent = "复制失败";
      reset();
    }
  );
}

function openPdf(file) {
  if (currentReaderUrl) URL.revokeObjectURL(currentReaderUrl);
  currentReaderUrl = URL.createObjectURL(file);
  $("#pdf-reader").src = currentReaderUrl;
  $("#pdf-reader").style.display = "block";
  $("#reader-empty").style.display = "none";
}

function playVideo(url) {
  if (currentVideoUrl?.startsWith("blob:")) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = url;
  $("#video-player").src = url;
  $("#video-player").style.display = "block";
  $("#video-empty").style.display = "none";
  $("#video-player").play().catch(() => {});
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: REPO,
    state
  };
  downloadBlob(JSON.stringify(payload, null, 2), "ai-learning-data.json", "application/json;charset=utf-8");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, "-");
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const imported = data.state || data;
      Object.assign(state, mergeState(defaultState(), imported));
      saveState();
      populateSelects();
      renderAll();
    } catch {
      alert("导入失败：文件不是有效的学习数据 JSON。");
    }
  };
  reader.readAsText(file);
}

function drawMap() {
  const canvas = $("#map-canvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(260, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#eaf1f8";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#c6d4e4";
  ctx.lineWidth = 1;
  for (let x = 28; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.35, height);
    ctx.stroke();
  }

  const points = [
    [0.11, 0.28, "基础"],
    [0.3, 0.38, "提示"],
    [0.47, 0.24, "推理"],
    [0.62, 0.43, "多模态"],
    [0.78, 0.31, "智能体"],
    [0.9, 0.52, "安全"]
  ].map(([x, y, label]) => ({ x: width * x, y: height * y, label }));

  ctx.strokeStyle = "#2868c7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point, index) => {
    ctx.fillStyle = ["#2868c7", "#147c72", "#247a3d", "#9a5b00", "#6b5fb5", "#b43a3a"][index];
    ctx.beginPath();
    ctx.arc(point.x, point.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 12px Microsoft YaHei, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), point.x, point.y);
    ctx.fillStyle = "#17202a";
    ctx.font = "700 14px Microsoft YaHei, Arial";
    ctx.fillText(point.label, point.x, point.y + 34);
  });
}

function bindEvents() {
  $$(".nav-button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#module-search").addEventListener("input", renderModules);
  $("#stage-filter").addEventListener("change", renderModules);
  $("#practice-module").addEventListener("change", () => {
    state.activeModule = $("#practice-module").value;
    renderPractice();
    saveState();
  });
  $("#mark-practice").addEventListener("click", () => {
    const id = $("#practice-module").value;
    state.progress[id].practice = true;
    saveState();
    renderModules();
  });
  $("#save-practice-log").addEventListener("click", () => {
    state.practiceLogs[$("#practice-module").value] = $("#practice-log").value;
    saveState();
  });
  $("#ebook-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) openPdf(file);
  });
  $("#video-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) playVideo(URL.createObjectURL(file));
  });
  $("#video-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#video-title-input").value.trim();
    const url = $("#video-url-input").value.trim();
    if (!title || !url) return;
    state.videos.push({ title, url, type: "自定义链接", desc: url });
    $("#video-title-input").value = "";
    $("#video-url-input").value = "";
    saveState();
    renderVideos();
  });
  $("#note-module").addEventListener("change", () => {
    state.activeModule = $("#note-module").value;
    renderNoteEditor();
    renderNoteList();
    saveState();
  });
  $("#save-note").addEventListener("click", saveNote);
  $("#download-note").addEventListener("click", downloadNote);
  $("#export-data").addEventListener("click", exportData);
  $("#import-data").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importData(file);
  });
  $("#continue-learning").addEventListener("click", () => {
    const next = modules.find((item) => !state.progress[item.id]?.practice) || moduleById(state.activeModule);
    state.activeModule = next.id;
    $("#practice-module").value = next.id;
    renderPractice();
    saveState();
    setView("practice");
  });
  window.addEventListener("resize", () => {
    if (currentView === "dashboard") drawMap();
  });
}

function renderAll() {
  renderStats();
  renderQuickGrid();
  renderModules();
  renderPractice();
  renderLibrary();
  renderVideos();
  renderNoteEditor();
  renderNoteList();
  drawMap();
}

populateSelects();
bindEvents();
renderAll();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
