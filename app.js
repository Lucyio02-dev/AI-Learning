// AI Learning · 学习实验室 —— 应用入口。
// 职责：装配路由与视图、全局事件委托、后端探测与模式标注。
import * as S from "./src/app/state.js";
import { initRouter, register, currentRoute, go, parseRoute } from "./src/app/router.js";
import { probe, hasBackend, backendProbed } from "./src/app/api.js";
import { esc, icon, toast, download, fmtTime } from "./src/app/ui.js";
import { validateContent } from "./src/content/index.js";
import { release } from "./src/app/release.js";

import * as home from "./src/app/views/home.js";
import * as diagnostic from "./src/app/views/diagnostic.js";
import * as map from "./src/app/views/map.js";
import * as routes from "./src/app/views/routes.js";
import * as course from "./src/app/views/course.js";
import * as labs from "./src/app/views/labs.js";
import * as labPrompt from "./src/app/views/lab-prompt.js";
import * as labRag from "./src/app/views/lab-rag.js";
import * as labAgent from "./src/app/views/lab-agent.js";
import * as labEmbodied from "./src/app/views/lab-embodied.js";
import * as projects from "./src/app/views/projects.js";
import * as library from "./src/app/views/library.js";
import * as tutor from "./src/app/views/tutor.js";
import * as quiz from "./src/app/views/quiz.js";
import * as settings from "./src/app/views/settings.js";

const root = document.querySelector("#app");
let modeLabel = "检查计算服务…";

register("home", home);
register("diagnostic", diagnostic);
register("map", map);
register("routes", routes);
register("course", course);
register("labs", labs);
register("lab", { render: labRouter, bind: labBind });
register("projects", projects);
register("library", library);
register("tutor", tutor);
register("quiz", quiz);
register("settings", settings);

function labRouter(route) {
  return { prompt: labPrompt, rag: labRag, agent: labAgent, embodied: labEmbodied }[route.id]?.render(route) || labs.render(route);
}
function labBind(route, el) {
  const view = { prompt: labPrompt, rag: labRag, agent: labAgent, embodied: labEmbodied }[route.id];
  if (view) view.bind(el);
  else labs.bind(el);
}

const NAV = [
  ["home", "home", "我的学习"],
  ["routes", "map", "学习路线"],
  ["map", "map", "学习地图"],
  ["labs", "lab", "实验室"],
  ["projects", "project", "项目空间"],
  ["library", "book", "资料与笔记"],
  ["quiz", "check", "能力评价"],
  ["tutor", "sun", "AI 助教"],
];

function shell(body) {
  const route = currentRoute();
  const crumbs = { home: "我的学习", diagnostic: "起点诊断", map: "学习地图", routes: "学习路线", course: "课程学习", labs: "实验室", lab: "实验工作台", projects: "项目空间", library: "资料与笔记", tutor: "AI 助教", quiz: "能力评价", settings: "设置" };
  const active = (p) => route.page === p || (p === "routes" && route.page === "course") || (p === "labs" && route.page === "lab");
  return `<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#home"><span class="brand-symbol">a<span>i</span></span><span>AI Learning<small>学习实验室</small></span></a>
      <div class="nav-label">WORKSPACE</div>
      <nav aria-label="主导航">${NAV.map(([p, i, t]) => `<button data-page="${p}" class="nav-item ${active(p) ? "active" : ""}" ${route.page === p ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span></button>`).join("")}</nav>
      <div class="sidebar-bottom">
        <div class="mode-indicator" id="mode-indicator" title="${hasBackend() ? "计算服务已连接：可使用已配置的模型、向量检索、训练和同步" : "课程、笔记、规则实验和仿真直接在浏览器运行；模型与训练需要计算服务"}">
          <span class="status-dot ${hasBackend() ? "ok" : ""}"></span><span>${esc(modeLabel)}</span>
        </div>
        <p>笔记与实验保存在此浏览器<br>定期备份，让积累留得住。</p>
        <button class="text-button" data-action="backup">导出学习备份 ${icon("arrow")}</button>
        <button class="text-button" data-page="settings">导入备份 ${icon("arrow")}</button>
        <button class="text-button" data-page="settings">账户与同步 ${icon("arrow")}</button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">学习空间 <span>/</span> ${esc(crumbs[route.page] || route.page)}</div>
        <div class="top-meta"><span class="status-dot"></span><span id="save-status">保存在此浏览器</span><button class="avatar" data-page="settings" aria-label="打开设置">学</button></div>
      </header>
      <main id="main" tabindex="-1">${body}</main>
      <footer>AI LEARNING LAB <span>理解 · 实现 · 诊断 · 验证</span><span>v${release.version} · ${hasBackend() ? "已连接计算服务" : "浏览器学习"}</span></footer>
    </div>
  </div>`;
}

function render() {
  const route = currentRoute();
  const view = { home, diagnostic, map, routes, course, labs, lab: { render: labRouter, bind: labBind }, projects, library, tutor, quiz, settings }[route.page] || home;
  root.innerHTML = shell(view.render(route));
  // 视图自行绑定交互
  const bindTarget = { home, diagnostic, map, routes, course, labs, projects, library, tutor, quiz, settings }[route.page];
  if (bindTarget?.bind) bindTarget.bind(root, () => {
    const results = root.querySelector("#course-results");
    if (results) {
      results.innerHTML = routes.courseResults();
      routes.bind(root, () => {
        results.innerHTML = routes.courseResults();
        routes.bind(root, () => {});
      });
    }
  });
  if (route.page === "lab") labBind(route, root);
  document.title = `${crumb(route.page)} · AI Learning 学习实验室`;
}

const crumb = (p) =>
  ({ home: "我的学习", diagnostic: "起点诊断", map: "学习地图", routes: "学习路线", course: "课程学习", labs: "实验室", lab: "实验工作台", projects: "项目空间", library: "资料与笔记", tutor: "AI 助教", quiz: "能力评价", settings: "设置" }[p] || "学习空间");

const rerender = render;
export { rerender };

// ---------- 全局事件 ----------
root.addEventListener("click", (e) => {
  const el = e.target.closest("button,[data-page]");
  if (!el) return;
  if (el.dataset.page) {
    go(el.dataset.page, el.dataset.context || "", el.dataset.extra || "");
    return;
  }
  if (el.dataset.course) {
    go("course", el.dataset.course, el.dataset.step || "0");
    return;
  }
  if (el.dataset.lab) {
    go("lab", el.dataset.lab);
    return;
  }
  if (el.dataset.action === "backup") {
    S.exportAll();
    download(S.exportAll(), "ai-learning-backup.json", "application/json");
    toast("备份已导出，包含笔记、实验、归档与旧版原始数据。");
    return;
  }
});

root.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "goal") {
    S.setGoal(el.value);
    toast("学习方向已更新，课程和记录都会保留。");
    render();
  }
});

// 键盘可达性：g + 首字母导航略；保证焦点顺序即可。

async function boot() {
  try {
    const problems = validateContent();
    if (!problems.ok) console.error("内容一致性错误：", problems.problems);
    S.init();
    const state = S.getState();
    if (state.settings?.reducedMotion) document.documentElement.classList.add("reduced-motion");
    initRouter();
    render();
    S.subscribe(() => render());
    window.addEventListener("hashchange", render);
    // 后端探测（异步，完成后更新模式指示与页面）
    const health = await probe();
    modeLabel = health.ok
      ? `完整模式 · ${health.providers.filter((p) => p.configured).length} 个模型已配置`
      : "浏览器学习模式";
    render();
  } catch (error) {
    console.error("启动失败：", error);
    root.innerHTML = `<div class="error-box" role="alert"><strong>启动失败</strong><pre>${String(error?.stack || error)}</pre></div>`;
    toast(`启动失败：${error?.message || error}`);
  }
}

boot();

// 最新页面加载后也清理本应用的旧 worker；学习数据始终保留。
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .getRegistrations()
    .then((rs) =>
      rs
        .filter((r) => r.scope === new URL("./", location.href).href)
        .forEach((r) => r.unregister()),
    )
    .catch(() => {});
if ("caches" in globalThis) caches.delete("ai-learning-platform-v1").catch(() => {});
const upgradedUrl = new URL(location.href);
if (upgradedUrl.searchParams.has("app-upgrade")) {
  upgradedUrl.searchParams.delete("app-upgrade");
  history.replaceState(history.state, "", upgradedUrl.href);
}
