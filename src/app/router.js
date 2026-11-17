// 哈希路由：#page/id/extra，支持后退/前进与视图刷新。
const routes = new Map();
let current = { page: "home", id: "", extra: "" };
const navListeners = new Set();

export function register(page, renderFn) {
  routes.set(page, renderFn);
}

export function go(page, id = "", extra = "") {
  const hash = `#${[page, id, extra].filter((x) => x !== "" && x !== undefined).join("/")}`;
  if (location.hash === hash) parseRoute();
  else location.hash = hash;
}

export function currentRoute() {
  return { ...current };
}

export function parseRoute() {
  const [page = "home", id = "", extra = ""] = location.hash.slice(1).split("/");
  current = { page: routes.has(page) ? page : "home", id, extra };
  navListeners.forEach((fn) => fn(current));
}

export function onNavigate(fn) {
  navListeners.add(fn);
  return () => navListeners.delete(fn);
}

export function initRouter() {
  window.addEventListener("hashchange", parseRoute);
  parseRoute();
}
