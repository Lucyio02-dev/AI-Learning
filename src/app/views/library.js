// 资料与笔记库：独立笔记（标签/检索/关联/版本恢复）+ 资料筛选（类型/方向/收藏）
// + PDF 页码锚点 + 视频时间锚点 + 明确的上传边界说明。
import * as S from "../state.js";
import { esc, icon, button, details, sectionHead, pill, fmtTime, setSaveStatus } from "../ui.js";
import { courses, tracks, courseSearchEntries } from "../../content/index.js";
import { go } from "../router.js";

export const filters = { query: "", type: "all", dir: "all", level: "all", favOnly: false };
let noteId = null;
let pdfUrl = null, videoUrl = null, pdfFileId = "local-pdf", videoFileId = "local-video";

export function render(route) {
  const s = S.getState();
  noteId = route.id && s.notes[route.id] ? route.id : noteId && s.notes[noteId] ? noteId : firstNoteId(s);
  const note = s.notes[noteId];
  return `${sectionHead("YOUR KNOWLEDGE", "把资料，变成自己的理解。", "收藏可信来源，记录预测与证据，保留探索的过程。")}
<div class="library-tabs">
  ${button("＋ 新建笔记", "new-note", "secondary")}
  ${button("导出当前笔记", "export-note", "secondary")}
  <label class="secondary file-label">预览本机 PDF<input id="pdf-file" type="file" accept="application/pdf"></label>
  <span class="muted">本机文件不会上传；页码/时间锚点保存在本地</span>
</div>
<div class="notes-layout">
  <aside class="panel note-index">
    <label class="search-field">${icon("search")}<input id="note-search" value="${esc(filters.query)}" placeholder="搜索笔记标题/正文/标签"></label>
    <h3>学习笔记</h3>
    <div id="note-list">${noteList(s)}</div>
  </aside>
  <section class="panel note-editor">
    ${note ? editorHtml(note, s) : '<div class="empty"><p>还没有笔记。点“新建笔记”开始。</p></div>'}
  </section>
</div>
<div class="section-title"><h2>资料库</h2><label class="search-field">${icon("search")}<input id="resource-search" value="${esc(filters.query)}" aria-label="搜索资料" placeholder="搜索教材、论文…"></label></div>
<div class="toolbar">
  <div class="tabs" role="group" aria-label="资料类型">
    ${[["all", "全部"], ["platform-course", "平台课程"], ["external", "外部资料"], ["user-file", "我的文件"]].map(([v, t]) => `<button class="tab ${filters.type === v ? "selected" : ""}" data-rtype="${v}" aria-pressed="${filters.type === v}">${t}</button>`).join("")}
  </div>
  <div class="tabs" role="group" aria-label="方向">
    ${[["all", "全部方向"], ...Object.entries(tracks).filter(([k]) => k !== "all")].map(([v, t]) => `<button class="tab ${filters.dir === v ? "selected" : ""}" data-rdir="${v}" aria-pressed="${filters.dir === v}">${t}</button>`).join("")}
  </div>
  <div class="tabs" role="group" aria-label="难度">
    ${[["all", "全部难度"], ["basic", "起步/基础"], ["advanced", "进阶/研究"]].map(([v, t]) => `<button class="tab ${filters.level === v ? "selected" : ""}" data-rlevel="${v}" aria-pressed="${filters.level === v}">${t}</button>`).join("")}
  </div>
  <label class="check-row"><input id="fav-only" type="checkbox" ${filters.favOnly ? "checked" : ""}>只看收藏</label>
</div>
<div id="resources">${resourceResults(s)}</div>
<section class="panel media-panel">
  <h2>视频链接与本机播放</h2>
  <p>外部链接在新标签打开；本机视频仅在当前浏览器播放，不上传。</p>
  <form id="video-form" class="video-form">
    <input id="video-title" aria-label="视频标题" placeholder="视频标题" required>
    <input id="video-url" type="url" aria-label="视频网址" placeholder="https://…" required>
    <button class="secondary">添加链接</button>
  </form>
  <div id="video-links">${s.videos.map((v) => `<a class="resource-link" href="${esc(v.url)}" target="_blank" rel="noreferrer">${esc(v.title)} ↗</a>`).join("") || '<p class="muted">还没有保存链接。</p>'}</div>
  <label class="secondary file-label">播放本机视频<input id="video-file" type="file" accept="video/*"></label>
  <video id="local-video" controls hidden></video>
</section>
${s.legacy ? `<div class="callout"><strong>旧版数据已保留</strong><p>笔记和实验记录已迁移；旧打卡不作为能力证据。完整原始对象保存在导出备份的 legacy 字段。</p></div>` : ""}`;
}

function firstNoteId(s) {
  const ids = Object.keys(s.notes);
  return ids[0] || null;
}

function noteList(s) {
  const q = filters.query.toLowerCase().trim();
  const entries = Object.values(s.notes)
    .filter((n) => !q || `${n.title} ${n.body} ${(n.tags || []).join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const courseNotes = courses.filter((c) => !s.notes[c.id] && (!q || c.title.toLowerCase().includes(q))).slice(0, 12);
  return `${entries.map((n) => `<div class="note-link ${n.id === noteId ? "selected" : ""}" data-note-id="${esc(n.id)}" role="button" tabindex="0">
    <strong>${esc(n.title)}</strong>
    <small>${n.body ? "已有草稿 · " + fmtTime(n.updatedAt) : "空"}${(n.tags || []).length ? " · " + n.tags.map((t) => "#" + esc(t)).join(" ") : ""}</small>
  </div>`).join("")}
  ${courseNotes.length ? `<div class="muted note-section-label">课程笔记（未创建）</div>${courseNotes.map((c) => `<div class="note-link ghost" data-note-id="${esc(c.id)}" role="button" tabindex="0"><strong>${esc(c.title)}</strong><small>为课程创建</small></div>`).join("")}` : ""}
  ${!entries.length && !courseNotes.length ? '<p class="muted">没有匹配笔记。</p>' : ""}`;
}

function editorHtml(note, s) {
  const isCourseNote = !!courses.find((c) => c.id === note.id);
  const revisions = (note.revisions || []).slice().reverse();
  return `
    <div class="control-pair">
      <label for="note-title">标题</label>
      <input id="note-title" value="${esc(note.title)}">
    </div>
    <label for="note-tags">标签（空格分隔）</label>
    <input id="note-tags" value="${esc((note.tags || []).join(" "))}">
    <label for="note-body">笔记正文 · Markdown（支持 \`代码\`、**粗体**、[链接](url)）</label>
    <textarea id="note-body" rows="12" placeholder="写下预测、观察、结论和仍需验证的问题…">${esc(note.body || "")}</textarea>
    <small id="draft-status" role="status" aria-live="polite">输入后自动保存 · 最后更新 ${fmtTime(note.updatedAt)}</small>
    <div class="note-links">
      <strong>关联</strong>
      ${note.links?.course?.length ? note.links.course.map((c) => `<button class="text-button" data-goto-course="${esc(c)}">${esc(c)} ↗</button>`).join("") : '<span class="muted">未关联课程</span>'}
      ${(note.links?.run || []).length ? `<span class="muted">运行记录 ${note.links.run.length} 条</span>` : ""}
    </div>
    ${revisions.length ? details(`版本历史（${revisions.length}）`, revisions.map((r) => `<div class="revision"><small class="muted">${fmtTime(r.at)}</small><pre>${esc(r.body.slice(0, 300))}</pre><button class="text-button" data-action="restore-revision" data-at="${esc(r.at)}">恢复此版本</button></div>`).join("")) : ""}
    ${isCourseNote ? `<button class="text-button" data-goto-course="${esc(note.id)}">打开对应课程 ↗</button>` : ""}
    <div class="form-actions">
      <button class="secondary" data-action="delete-note">删除笔记</button>
      <button class="secondary" data-action="link-current-run">关联最近一次实验</button>
    </div>
    <div id="pdf-preview"></div>`;
}

export function resourceResults(s) {
  const q = filters.query.toLowerCase().trim();
  let entries = courseSearchEntries().filter((e) => e.type === "resource");
  entries = entries.map((e) => {
    const [courseId] = e.id.split("#");
    const c = courses.find((x) => x.id === courseId);
    return { ...e, courseId, track: c?.track || "llm", kind: "external", title2: e.title };
  });
  entries.push({ id: pdfFileId, type: "resource", title: "本机 PDF", text: "本机文件预览", courseId: "", track: "all", kind: "user-file" });
  entries.push({ id: videoFileId, type: "resource", title: "本机视频", text: "本机文件播放", courseId: "", track: "all", kind: "user-file" });
  const items = entries.filter((r) => {
    if (filters.type !== "all" && r.kind !== filters.type) return false;
    if (filters.dir !== "all" && r.track !== filters.dir && !(filters.dir === "research" && r.track === "research")) return false;
    if (filters.level !== "all") {
      const c = courses.find((x) => x.id === r.courseId);
      const lvl = c?.level || "";
      if (filters.level === "basic" && !/起步|基础/.test(lvl)) return false;
      if (filters.level === "advanced" && !/进阶|研究/.test(lvl)) return false;
    }
    if (filters.favOnly && !S.resourceState(r.id).favorite) return false;
    if (q && !`${r.title} ${r.text}`.toLowerCase().includes(q)) return false;
    return true;
  });
  return items.length
    ? `<div class="resource-grid">${items.map((r) => {
        const rs = S.resourceState(r.id);
        return `<article class="resource-card"><div class="card-meta"><span class="pill">${kindLabel(r.kind)}</span>${r.track !== "all" ? `<span class="muted">${esc(tracks[r.track] || "")}</span>` : ""}<button class="favorite ${rs.favorite ? "on" : ""}" data-favorite="${esc(r.id)}" aria-label="${rs.favorite ? "取消收藏" : "收藏"} ${esc(r.title)}" aria-pressed="${rs.favorite}">${rs.favorite ? "★" : "☆"}</button></div>
        <h3>${esc(r.title)}</h3><p>${esc(String(r.text).slice(0, 80))}</p>
        ${rs.page ? `<small class="muted">上次读到第 ${rs.page} 页</small>` : ""}${rs.seconds ? `<small class="muted">上次播放 ${Math.floor(rs.seconds / 60)} 分 ${Math.floor(rs.seconds % 60)} 秒</small>` : ""}
        ${rs.anchors?.length ? `<small class="muted">${rs.anchors.length} 个锚点</small>` : ""}
        ${r.url ? `<a class="text-button" href="${esc(r.url)}" target="_blank" rel="noreferrer">打开来源 ↗</a>` : `<button class="text-button" data-anchor-jump="${esc(r.id)}">查看锚点</button>`}
        </article>`;
      }).join("")}</div>`
    : '<div class="empty"><p>没有匹配资料，请尝试其他关键词或清空筛选。</p></div>';
}

const kindLabel = (k) =>
  ({ "platform-course": "平台课程", external: "外部资料", "user-file": "我的文件" }[k] || k);

export function bind(root) {
  root.querySelector("#note-search")?.addEventListener("input", (e) => {
    filters.query = e.target.value;
    root.querySelector("#note-list").innerHTML = noteList(S.getState());
    bindNoteList(root);
  });
  bindNoteList(root);
  root.querySelector("#resource-search")?.addEventListener("input", (e) => {
    filters.query = e.target.value;
    root.querySelector("#resources").innerHTML = resourceResults(S.getState());
    bindResources(root);
  });
  root.querySelectorAll("[data-rtype]").forEach((b) =>
    b.addEventListener("click", () => {
      filters.type = b.dataset.rtype;
      root.querySelectorAll("[data-rtype]").forEach((x) => { x.classList.toggle("selected", x === b); x.setAttribute("aria-pressed", x === b); });
      root.querySelector("#resources").innerHTML = resourceResults(S.getState());
      bindResources(root);
    }),
  );
  root.querySelectorAll("[data-rdir]").forEach((b) =>
    b.addEventListener("click", () => {
      filters.dir = b.dataset.rdir;
      root.querySelectorAll("[data-rdir]").forEach((x) => x.classList.toggle("selected", x === b));
      root.querySelector("#resources").innerHTML = resourceResults(S.getState());
      bindResources(root);
    }),
  );
  root.querySelectorAll("[data-rlevel]").forEach((b) =>
    b.addEventListener("click", () => {
      filters.level = b.dataset.rlevel;
      root.querySelectorAll("[data-rlevel]").forEach((x) => x.classList.toggle("selected", x === b));
      root.querySelector("#resources").innerHTML = resourceResults(S.getState());
      bindResources(root);
    }),
  );
  root.querySelector("#fav-only")?.addEventListener("change", (e) => {
    filters.favOnly = e.target.checked;
    root.querySelector("#resources").innerHTML = resourceResults(S.getState());
    bindResources(root);
  });

  root.querySelector('[data-action="new-note"]')?.addEventListener("click", () => {
    const id = `note-${Date.now()}`;
    const result = S.saveNote(id, { title: "新的探索笔记", body: "", tags: [] }, { silent: true });
    go("library", id);
    if (!result.ok) import("../ui.js").then(({ toast }) => toast("笔记已在当前页面创建，但没有写入浏览器；请重试保存或导出备份。"));
  });
  root.querySelector('[data-action="export-note"]')?.addEventListener("click", () => {
    const n = S.getState().notes[noteId];
    if (!n) return;
    import("../ui.js").then(({ download }) => download(`# ${n.title}\n\n${n.body || ""}\n`, `${n.title || "笔记"}.md`));
  });
  root.querySelector('[data-action="delete-note"]')?.addEventListener("click", () => {
    const n = S.getState().notes[noteId];
    if (!n) return;
    if (!confirm(`删除笔记“${n.title}”？此操作不可撤销（建议先导出）。`)) return;
    const result = S.deleteNote(noteId);
    if (!result.ok) {
      import("../ui.js").then(({ toast }) => toast("删除未能写入浏览器，请重试或先导出备份。"));
      return;
    }
    go("library");
  });
  root.querySelector('[data-action="link-current-run"]')?.addEventListener("click", () => {
    const lastRun = S.getState().runs.at(-1);
    if (!lastRun) return import("../ui.js").then(({ toast }) => toast("还没有实验记录可关联"));
    const result = S.saveNote(noteId, { links: { course: courses.find((c) => c.id === noteId) ? [noteId] : [], resource: [], lab: [lastRun.lab], run: [lastRun.id] } }, { silent: true });
    import("../ui.js").then(({ toast }) => toast(result.ok ? "已关联最近一次实验记录" : "关联未保存，请重试或导出备份。"));
    if (result.ok) rerender();
  });
  root.querySelectorAll("[data-action=restore-revision]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const n = S.getState().notes[noteId];
      const rev = (n.revisions || []).find((r) => r.at === btn.dataset.at);
      if (!rev) return;
      const result = S.saveNote(noteId, { body: rev.body }, { silent: true });
      if (!result.ok) {
        import("../ui.js").then(({ toast }) => toast("恢复的版本未写入浏览器，当前编辑内容仍在；请重试或导出备份。"));
        return;
      }
      rerender();
      import("../ui.js").then(({ toast }) => toast("已恢复到所选版本（当前版本进入历史）"));
    }),
  );
  root.querySelectorAll("[data-goto-course]").forEach((btn) =>
    btn.addEventListener("click", () => go("course", btn.dataset.gotoCourse, "0")),
  );

  const title = root.querySelector("#note-title");
  const tags = root.querySelector("#note-tags");
  const body = root.querySelector("#note-body");
  const persistNote = () => {
    if (!noteId) return { ok: false };
    const existing = S.getState().notes[noteId];
    const result = S.saveNote(noteId, {
      title: title?.value || existing?.title || "未命名笔记",
      tags: (tags?.value || "").split(/[\s,，]+/).filter(Boolean),
      body: body?.value ?? existing?.body ?? "",
      links: existing?.links || { course: courses.find((c) => c.id === noteId) ? [noteId] : [], resource: [], lab: [], run: [] },
    }, { silent: true });
    setSaveStatus(root.querySelector("#draft-status"), result, { okText: "自动保存", retry: persistNote });
    return result;
  };
  [title, tags, body].forEach((el) => el?.addEventListener("input", persistNote));

  root.querySelector("#pdf-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pdfUrl?.let?.();
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(file);
    const preview = root.querySelector("#pdf-preview");
    if (preview)
      preview.innerHTML = `<p>本机 PDF · 不上传 · 关闭页面后需重新选择。在 PDF 内翻页后，点下方按钮记录当前页码锚点。</p><iframe title="本机 PDF 预览" src="${pdfUrl}"></iframe><button class="secondary" data-action="save-pdf-anchor">记录页码锚点</button><input id="pdf-page" type="number" min="1" value="1" aria-label="页码" style="width:5rem">`;
    bindResources(root);
  });
  root.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="save-pdf-anchor"]');
    if (btn) {
      const page = Number(root.querySelector("#pdf-page")?.value || 1);
      S.setResourceAnchor(pdfFileId, { page, note: noteId || undefined });
      import("../ui.js").then(({ toast }) => toast(`已记录第 ${page} 页锚点${noteId ? "，并关联当前笔记" : ""}`));
    }
  });
  root.querySelector("#video-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);
    const v = root.querySelector("#local-video");
    v.src = videoUrl;
    v.hidden = false;
    v.addEventListener("timeupdate", () => {
      if (Math.floor(v.currentTime) % 5 === 0) S.setResourceAnchor(videoFileId, { seconds: v.currentTime });
    }, { once: false });
  });
  root.querySelector("#video-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = root.querySelector("#video-title").value.trim();
    const u = root.querySelector("#video-url").value.trim();
    if (!/^https?:\/\//i.test(u)) {
      import("../ui.js").then(({ toast }) => toast("请输入 http 或 https 视频页面链接"));
      return;
    }
    S.update((s) => s.videos.push({ title: t, url: u }));
    rerender();
  });
  bindResources(root);
}

function bindNoteList(root) {
  root.querySelectorAll("[data-note-id]").forEach((el) => {
    const open = () => go("library", el.dataset.noteId);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  });
}

function bindResources(root) {
  root.querySelectorAll("[data-favorite]").forEach((btn) =>
    btn.addEventListener("click", () => {
      S.toggleFavorite(btn.dataset.favorite);
      root.querySelector("#resources").innerHTML = resourceResults(S.getState());
      bindResources(root);
    }),
  );
}

function rerender() {
  import("../../../app.js").then(({ rerender }) => rerender());
}
