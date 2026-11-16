// UI 组件与公共渲染工具。
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export const icons = {
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
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  play: "M8 5v14l11-7Z",
  pause: "M8 5v14M16 5v14",
  stop: "M6 6h12v12H6Z",
  alert: "M12 3 2 21h20L12 3Zm0 7v6m0 3v.5",
};
export const icon = (name = "arrow") =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.arrow}"/></svg>`;

export const button = (text, action, cls = "secondary", extra = "") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;

export const eyebrow = (t) => `<span class="eyebrow">${esc(t)}</span>`;
export const pill = (text, cls = "") => `<span class="pill ${cls}">${esc(text)}</span>`;
export const muted = (t) => `<span class="muted">${esc(t)}</span>`;

export const sectionHead = (over, title, sub = "") =>
  `<div class="page-heading"><div>${eyebrow(over)}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div></div>`;

export const emptyState = (title, body, actions = "") =>
  `<div class="empty"><h2>${title}</h2><p>${body}</p>${actions}</div>`;

// 时间格式化（本地化、短格式）。
export const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const toast = (text) => {
  const el = document.querySelector("#toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4200);
};

export function download(content, name, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 确认对话框（原生，避免额外依赖）。
export const confirmDialog = (message) => globalThis.confirm(message);

// 简单 markdown 渲染（受控白名单：标题/列表/粗体/代码/链接）。
export function md(text = "") {
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1 ↗</a>');
  const lines = text.split("\n");
  const out = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      if (/^###\s+/.test(trimmed)) out.push(`<h4>${inline(trimmed.slice(4))}</h4>`);
      else if (/^##\s+/.test(trimmed)) out.push(`<h3>${inline(trimmed.slice(3))}</h3>`);
      else if (trimmed) out.push(`<p>${inline(trimmed)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

// 加载中/空/错误三态容器。
export const loading = (text = "加载中…") =>
  `<div class="loading" role="status">${text}</div>`;
export const errorBox = (message, code = "") =>
  `<div class="error-box" role="alert">${icon("alert")}<strong>${esc(message)}</strong>${code ? `<small>${esc(code)}</small>` : ""}</div>`;

// 展开块（三层深度、故障详情等）。
export function details(summaryText, inner, open = false, cls = "") {
  return `<details class="fold ${cls}" ${open ? "open" : ""}><summary>${summaryText}</summary><div class="fold-body">${inner}</div></details>`;
}

// 表格。rows 支持两种形式：字符串数组的数组（自动包 td），
// 或预格式化的行 HTML 字符串数组。
export function table(headers, rows) {
  const body = rows
    .map((r) => {
      const cells = Array.isArray(r) ? r.map((c) => `<td>${c}</td>`).join("") : `<td>${r}</td>`;
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}
