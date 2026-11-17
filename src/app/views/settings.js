// 设置页：账户与同步、备份/导入（预检+冲突展示）、存储容量与归档、退出数据处理。
import * as S from "../state.js";
import { esc, button, details, table, pill, sectionHead, loading, errorBox, fmtTime } from "../ui.js";
import { hasBackend, register, login, logout, clearToken, hasToken, syncPull, syncPush } from "../api.js";
import { go } from "../router.js";
import { release } from "../release.js";
import { courses, labInfo, projects } from "../../content/index.js";

let importPlan = null;

export function render() {
  const s = S.getState();
  const sync = s.sync || {};
  return `${sectionHead("SETTINGS", "数据、账户与同步。", "课程、笔记、规则实验和仿真可直接使用。真实模型、训练与账户同步由计算服务提供。")}
<section class="panel release-panel">
  <div class="section-title"><h2>学习实验室 v${release.version}</h2><span class="pill">基于 ${release.baseline} 持续迭代</span></div>
  <p>同一套工作台包含 ${courses.length} 门课程、${Object.keys(labInfo).length} 个实验室、${projects.length} 个项目，以及学习地图、能力评价、资料笔记与 AI 助教。</p>
  <p class="caption">正式入口：<a href="${release.canonicalUrl}">${release.canonicalUrl}</a>。学习数据沿用 v3 格式；版本升级会保留此网址下的笔记、课程进度和实验记录。</p>
  <div id="release-status" class="caption" aria-live="polite"></div>
  ${table(["功能", "当前状态"], [
    ["课程、开源案例、项目任务、资料笔记", "可在浏览器使用"],
    ["Prompt 规则、RAG 词项、Agent、2D 仿真与 Q-learning", "可在浏览器运行"],
    ["真实模型、向量检索、Python 训练、账户同步", hasBackend() ? "已连接计算服务，依赖与模型配置以服务状态为准" : "实现已保留，当前站点尚未连接计算服务"],
  ])}
</section>
<div class="lower-grid">
  <section class="panel">
    <h2>账户与计算服务</h2>
    ${hasBackend()
      ? hasToken()
        ? `<p>已登录：<strong>${esc(sync.account?.username || "本地账户")}</strong>（数据按用户隔离存储在本地后端）</p>
           <div class="stack">
             <button class="secondary" data-action="sync-pull">从服务器拉取</button>
             <button class="primary" data-action="sync-push">推送到服务器</button>
             <button class="secondary" data-action="account-logout">退出登录</button>
           </div>
           ${details("退出登录后本机数据怎么办？", "<p>退出只清除登录令牌。本机浏览器数据保留；如需清除，请使用下方“清除本机数据”。服务端数据保留在你的账户里，下次登录可恢复。</p>")}`
        : `<div class="control-pair">
             <div><label for="reg-user">用户名（注册）</label><input id="reg-user" placeholder="3-32 位字母数字"></div>
             <div><label for="reg-pass">密码（至少 8 位）</label><input id="reg-pass" type="password"></div>
           </div>
           <div class="control-pair">
             <div><label for="login-user">用户名（登录）</label><input id="login-user"></div>
             <div><label for="login-pass">密码</label><input id="login-pass" type="password"></div>
           </div>
           <div class="stack">
             <button class="primary" data-action="account-register">注册并登录</button>
             <button class="secondary" data-action="account-login">登录</button>
           </div>
           <p class="caption">同一账户在第二台设备/浏览器登录即可验证隔离与同步。密码经 scrypt 加盐哈希后存于本地后端。</p>`
      : `<p class="muted">当前公开站点提供浏览器学习。账户同步、真实模型和训练需要部署计算服务；连接后沿用这一套课程、实验和学习数据。</p>`}
    <div id="sync-status" aria-live="polite"></div>
  </section>
  <section class="panel">
    <h2>备份与迁移</h2>
    <p class="muted">最近备份：${s.backedUp ? fmtTime(s.backedUp) : "尚未导出"}</p>
    <div class="stack">
      <button class="primary" data-action="backup">导出完整备份（JSON）</button>
      <label class="secondary file-label">导入备份（先预检）<input id="backup-import-input" type="file" accept=".json,application/json"></label>
      <button class="secondary" data-action="archive-export">导出归档记录</button>
    </div>
    <div id="import-preview"></div>
    <p class="caption">导入前会先将当前数据保存在本机恢复备份中；预检显示范围与冲突，替换或合并由你选择。</p>
    <p class="caption">从昨天的本机地址或旧在线地址切换过来时，请先在原地址导出备份，再在这里选择“合并”。不同网址的浏览器存储互相独立，页面空白不代表原记录被删除。</p>
  </section>
</div>
<div class="lower-grid">
  <section class="panel">
    <h2>存储与容量</h2>
    ${table(["项", "数量", "说明"], [
      ["活跃实验记录", String(s.runs.length), "上限 100 条"],
      ["归档记录", String(s.archive.length), "超出上限自动归档，不丢弃"],
      ["笔记", String(Object.keys(s.notes).length), "每篇保留最近 10 个版本"],
      ["评价作答", String(s.quizAttempts.length), "保留全部，用于对比成长"],
      ["v1 原始数据", s.legacy ? "有" : "无", "完整保留在 legacy 字段"],
    ])}
    <div class="stack">
      <button class="secondary" data-action="archive-clear" ${s.archive.length ? "" : "disabled"}>清空归档（先导出）</button>
      <button class="secondary" data-action="wipe-local">清除本机数据（危险）</button>
    </div>
  </section>
  <section class="panel">
    <h2>界面偏好</h2>
    <label class="check-row"><input id="reduced-motion" type="checkbox" ${s.settings?.reducedMotion ? "checked" : ""}>减少动态效果</label>
    <p class="caption">遵循系统“减少动态效果”设置的同时，可在此强制关闭。</p>
  </section>
</div>`;
}

export function bind(root) {
  const releaseStatus = root.querySelector("#release-status");
  fetch(new URL("./release.json", location.href), { cache: "no-store" })
    .then((res) => res.ok ? res.json() : null)
    .then((info) => {
      if (!info || !releaseStatus?.isConnected) return;
      releaseStatus.textContent = `本次发布：v${info.version} · 提交 ${String(info.commit || "未记录").slice(0, 7)}${info.builtAt ? ` · ${fmtTime(info.builtAt)}` : ""}`;
    })
    .catch(() => {});
  // 账户
  root.querySelector('[data-action="account-register"]')?.addEventListener("click", async () => {
    const status = root.querySelector("#sync-status");
    try {
      status.innerHTML = loading("注册中…");
      const data = await register(root.querySelector("#reg-user").value.trim(), root.querySelector("#reg-pass").value);
      await connectAccount(data, status, "注册成功");
    } catch (error) {
      const latestStatus = document.querySelector("#sync-status");
      if (latestStatus) latestStatus.innerHTML = errorBox(error.message, error.code);
    }
  });
  root.querySelector('[data-action="account-login"]')?.addEventListener("click", async () => {
    const status = root.querySelector("#sync-status");
    try {
      status.innerHTML = loading("登录中…");
      const data = await login(root.querySelector("#login-user").value.trim(), root.querySelector("#login-pass").value);
      await connectAccount(data, status, "登录成功");
    } catch (error) {
      const latestStatus = document.querySelector("#sync-status");
      if (latestStatus) latestStatus.innerHTML = errorBox(error.message, error.code);
    }
  });
  root.querySelector('[data-action="account-logout"]')?.addEventListener("click", async () => {
    await logout().catch(() => clearToken());
    S.setSyncAccount(null, false);
    rerender();
  });
  root.querySelector('[data-action="sync-pull"]')?.addEventListener("click", async () => {
    const status = root.querySelector("#sync-status");
    try {
      status.innerHTML = loading("拉取中…");
      const remote = await syncPull();
      if (!remote.state) {
        S.setSyncAccount(S.getState().sync?.account, true, remote.revision);
        const latestStatus = document.querySelector("#sync-status");
        if (latestStatus) latestStatus.innerHTML = '<p class="muted">服务器上还没有数据，先“推送到服务器”。</p>';
        return;
      }
      const { mergeStates } = await import("../../core/store.js");
      const { normalize } = await import("../../core/schema.js");
      const merged = mergeStates(S.getState(), normalize(remote.state));
      const result = await syncPush(merged, remote.revision, "reject");
      S.applyRemote(merged, result.revision, S.getState().sync?.account);
      const latestStatus = document.querySelector("#sync-status");
      if (latestStatus) latestStatus.innerHTML = `<span class="pill success">本机与服务器已合并</span> 服务器版本 r${result.revision}`;
    } catch (error) {
      const latestStatus = document.querySelector("#sync-status");
      if (latestStatus) latestStatus.innerHTML = errorBox(error.message, error.code);
    }
  });
  root.querySelector('[data-action="sync-push"]')?.addEventListener("click", async () => {
    const status = root.querySelector("#sync-status");
    try {
      status.innerHTML = loading("推送中…");
      const result = await syncPush(S.getState(), S.getState().sync?.revision ?? 0, "reject");
      S.markSynced(result.revision);
      status.innerHTML = `<span class="pill success">已推送</span> 服务器版本 r${result.revision}`;
    } catch (error) {
      if (error.statusCode === 409 && error.payload) {
        const serverState = error.payload.serverState;
        status.innerHTML = `<div class="callout warn"><strong>同步冲突</strong><p>服务器已有更新数据（r${error.payload.serverRevision}）。选择处理方式：</p>
          <div class="stack">
            <button class="primary" data-action="conflict-merge">合并（两边都保留，同字段取较新）</button>
            <button class="secondary" data-action="conflict-overwrite">用本机数据覆盖服务器（服务器旧版本存入历史）</button>
            <button class="secondary" data-action="conflict-download">下载服务器数据稍后处理</button>
          </div></div>`;
        const merge = async () => {
          try {
            const { mergeStates } = await import("../../core/store.js");
            const { fresh, normalize } = await import("../../core/schema.js");
            const remoteState = serverState ? normalize(serverState) : fresh();
            const merged = mergeStates(S.getState(), remoteState);
            const result = await syncPush(merged, error.payload.serverRevision, "reject");
            S.applyRemote(merged, result.revision, S.getState().sync?.account);
            const latestStatus = document.querySelector("#sync-status");
            if (latestStatus) latestStatus.innerHTML = `<span class="pill success">已合并推送</span> r${result.revision}`;
          } catch (mergeError) {
            const latestStatus = document.querySelector("#sync-status");
            if (latestStatus) latestStatus.innerHTML = errorBox(mergeError.message, mergeError.code);
          }
        };
        status.querySelector('[data-action="conflict-merge"]').onclick = merge;
        status.querySelector('[data-action="conflict-overwrite"]').onclick = async () => {
          try {
            const result = await syncPush(S.getState(), error.payload.serverRevision, "force");
            S.markSynced(result.revision);
            const latestStatus = document.querySelector("#sync-status");
            if (latestStatus) latestStatus.innerHTML = `<span class="pill success">已覆盖</span> r${result.revision}`;
          } catch (overwriteError) {
            const latestStatus = document.querySelector("#sync-status");
            if (latestStatus) latestStatus.innerHTML = errorBox(overwriteError.message, overwriteError.code);
          }
        };
        status.querySelector('[data-action="conflict-download"]').onclick = () => {
          import("../ui.js").then(({ download }) => download(JSON.stringify({ state: serverState }, null, 2), "server-data.json", "application/json"));
        };
      } else {
        status.innerHTML = errorBox(error.message, error.code);
      }
    }
  });

  // 备份与导入
  root.querySelector('[data-action="backup"]')?.addEventListener("click", () => {
    const text = S.exportAll();
    import("../ui.js").then(({ download, toast }) => {
      download(text, "ai-learning-backup.json", "application/json");
      toast("备份已导出，包含笔记、实验、归档与旧版原始数据。");
    });
  });
  root.querySelector("#backup-import-input")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = root.querySelector("#import-preview");
    try {
      const text = await file.text();
      importPlan = S.inspect(text);
      const c = importPlan.conflicts;
      preview.innerHTML = `
        <div class="callout"><strong>导入预检</strong>
        ${table(["项", "备份中", "当前"], [
          ["笔记", String(importPlan.incoming.notes), String(importPlan.current.notes)],
          ["运行记录", String(importPlan.incoming.runs), String(importPlan.current.runs)],
          ["课程进度", String(importPlan.incoming.courses), String(importPlan.current.courses)],
          ["项目", String(importPlan.incoming.projects), String(importPlan.current.projects)],
          ["评价作答", String(importPlan.incoming.quizAttempts), String(importPlan.current.quizAttempts)],
        ])}
        <p>迁移来源：v${importPlan.migratedFrom} → v3 ${importPlan.migratedFrom < 3 ? "（自动迁移，旧 ID 与原始副本保留）" : ""}</p>
        ${c.length ? `<p><strong>冲突 ${c.length} 处</strong>（同 ID 内容不同）：${c.slice(0, 6).map((x) => `${x.type}:${x.id}`).join("、")}${c.length > 6 ? "…" : ""}</p>` : "<p>无冲突。</p>"}
        <div class="stack">
          <button class="primary" data-action="import-replace">替换现有数据（推荐：${importPlan.suggestedMode === "replace" ? "预检建议" : "注意冲突"}）</button>
          <button class="secondary" data-action="import-merge">合并导入（冲突取较新）</button>
        </div></div>`;
      preview.querySelector('[data-action="import-replace"]').onclick = () => doImport("replace");
      preview.querySelector('[data-action="import-merge"]').onclick = () => doImport("merge");
    } catch (error) {
      preview.innerHTML = errorBox(`导入失败：${error.message}`, error.code);
    }
    e.target.value = "";
  });
  async function doImport(mode) {
    const preview = root.querySelector("#import-preview");
    try {
      const result = S.importData(importPlan.incomingState ? JSON.stringify({ state: importPlan.incomingState }) : "", mode);
      import("../ui.js").then(({ download, toast }) => {
        download(result.backup, "ai-learning-pre-import-backup.json", "application/json");
        toast("导入成功，导入前备份已保存在本机并下载。");
      });
      preview.innerHTML = `<span class="pill success">导入完成</span> 模式：${mode === "merge" ? "合并" : "替换"}。导入前数据已保存在本机恢复备份中，并下载为文件。`;
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      preview.innerHTML = errorBox(`导入失败：${error.message}`, error.code);
    }
  }
  root.querySelector('[data-action="archive-export"]')?.addEventListener("click", () => {
    const s = S.getState();
    import("../ui.js").then(({ download }) =>
      download(JSON.stringify({ archive: s.archive, runs: s.runs }, null, 2), "ai-learning-archive.json", "application/json"));
  });
  root.querySelector('[data-action="archive-clear"]')?.addEventListener("click", () => {
    if (!confirm("清空归档记录？建议先导出。")) return;
    S.update((s) => { s.archive = []; });
    rerender();
  });
  root.querySelector('[data-action="wipe-local"]')?.addEventListener("click", () => {
    if (!confirm("清除本浏览器全部学习数据？此操作不可撤销。请确认已导出备份。")) return;
    ["ai-learning-lab-v3", "ai-learning-lab-v2", "ai-learning-platform-state-v1", "ai-learning-import-backup", "ai-learning-agent-checkpoint"].forEach((k) => localStorage.removeItem(k));
    location.reload();
  });
  root.querySelector("#reduced-motion")?.addEventListener("change", (e) => {
    S.update((s) => { s.settings.reducedMotion = e.target.checked; });
    document.documentElement.classList.toggle("reduced-motion", e.target.checked);
  });
}

function rerender() {
  import("../../../app.js").then(({ rerender }) => rerender());
}

async function connectAccount(data, status, actionLabel) {
  S.setSyncAccount(data.user, true, 0);
  const remote = await syncPull();
  S.setSyncAccount(data.user, true, remote.revision);
  const { mergeStates } = await import("../../core/store.js");
  const { fresh, normalize } = await import("../../core/schema.js");
  const remoteState = remote.state ? normalize(remote.state) : fresh();
  const merged = mergeStates(S.getState(), remoteState);
  const result = await syncPush(merged, remote.revision, "reject");
  S.applyRemote(merged, result.revision, data.user);
  const latestStatus = document.querySelector("#sync-status");
  if (latestStatus) latestStatus.innerHTML = `<span class="pill success">${esc(actionLabel)}</span> ${esc(data.user.username)}，本机与服务器数据已合并同步至 r${result.revision}`;
}
