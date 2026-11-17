// 应用状态：加载/保存、运行记录、能力状态、继续学习恢复。
// UI 层不直接碰 localStorage；一切通过这里的函数。
import {
  load, persist, exported, parseImport, inspectImport, applyImport, validateState,
} from "../core/store.js";
import { fresh, normalize, stableId, RUN_CAP } from "../core/schema.js";
import { getCourse } from "../content/index.js";

let state = fresh();
let readOnly = false;
const listeners = new Set();

export function init() {
  const loaded = load(localStorage);
  state = loaded.state;
  readOnly = !!loaded.readOnly;
  if (loaded.message) {
    setTimeout(() => import("./ui.js").then(({ toast }) => toast(loaded.message)), 300);
  }
  return state;
}

export const getState = () => state;
export const isReadOnly = () => readOnly;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notify() {
  listeners.forEach((fn) => fn(state));
}

export function save() {
  if (readOnly) return false;
  const ok = persist(localStorage, state);
  if (!ok) {
    import("./ui.js").then(({ toast }) =>
      toast("浏览器存储不可用或空间不足，请立即导出备份。"));
  }
  return ok;
}

export function update(mutator, { silent = false } = {}) {
  const result = mutator(state);
  const ok = save();
  if (!silent) notify();
  return { ok, result };
}

// 运行记录：进活跃区，超上限归档（不静默丢弃）。
// 不触发全局重渲染：实验室视图自行局部刷新历史区，
// 避免把实验输出面板清空。
export function recordRun(run) {
  const r = {
    id: stableId("run"),
    time: new Date().toISOString(),
    ...run,
  };
  state.runs.push(r);
  if (state.runs.length > RUN_CAP) {
    const overflow = state.runs.length - RUN_CAP;
    state.archive.push(...state.runs.splice(0, overflow));
  }
  save();
  return r;
}

// 进度状态：区分已读/自报/练习通过/实验通过/复核。
export function progressFor(courseId) {
  return (
    state.progress[courseId] || {
      read: false, selfReported: false, exercisePassed: false,
      experimentPassed: false, reviewed: false, evidence: [], viewedSteps: [],
    }
  );
}

export function markRead(courseId) {
  update((s) => {
    const p = (s.progress[courseId] ||= {});
    p.read = true;
    p.updatedAt = new Date().toISOString();
  });
}

export function markViewedStep(courseId, step) {
  // 静默：此调用发生在渲染过程中，notify 会造成无限重渲染。
  update((s) => {
    const p = (s.progress[courseId] ||= {});
    p.viewedSteps = [...new Set([...(p.viewedSteps || []), step])];
    s.positions[courseId] = { step, updatedAt: new Date().toISOString() };
    s.last = { course: courseId, step, updatedAt: new Date().toISOString() };
  }, { silent: true });
}

export function setCapability(courseId, capability, value = true, runId = "") {
  // 静默：记录流程中调用，避免清空实验输出面板；需要刷新的视图自行处理。
  update((s) => {
    const p = (s.progress[courseId] ||= { evidence: [] });
    p[capability] = value;
    if (runId && value) p.evidence = [...new Set([...(p.evidence || []), runId])];
    p.updatedAt = new Date().toISOString();
  }, { silent: true });
}

// 继续学习：恢复真实课程步骤位置。
export function continuePoint() {
  const last = state.last || { course: "foundation", step: 0 };
  const course = getCourse(last.course) || getCourse("foundation");
  const step = Math.min(last.step || 0, (course.steps?.length || 4) - 1);
  return { course, step };
}

// 下一步任务（首页）：优先未读先修链上的最近课程。
export function nextTask() {
  const cont = continuePoint();
  if (!state.progress[cont.course.id]?.read) {
    return { course: cont.course, step: cont.step, reason: "继续上次的学习位置" };
  }
  const goalOrder = {
    llm: ["foundation", "tokens", "attention", "sampling", "ch02", "rag", "agent", "ch01"],
    embodied: ["foundation", "pyexp", "vector", "space", "policy"],
    research: ["foundation", "tensor", "ch01", "ch03", "ch04", "ch08", "ch11"],
  };
  const order = goalOrder[state.goal] || goalOrder.llm;
  for (const id of order) {
    if (!state.progress[id]?.read) {
      const course = getCourse(id);
      if (course) return { course, step: state.positions[id]?.step || 0, reason: "按你的目标方向的下一节" };
    }
  }
  return { course: cont.course, step: cont.step, reason: "全部核心课已读，进入项目与研究专题" };
}

// 笔记。
export function saveNote(noteId, patch) {
  update((s) => {
    const existing = s.notes[noteId] || { id: noteId, title: "未命名笔记", body: "", tags: [], links: { course: [], resource: [], lab: [], run: [] }, revisions: [] };
    const next = {
      ...existing,
      ...patch,
      id: noteId,
      updatedAt: new Date().toISOString(),
    };
    if (patch.body !== undefined && existing.body && patch.body !== existing.body) {
      next.revisions = [...(existing.revisions || []).slice(-9), { at: existing.updatedAt, body: existing.body }];
    }
    s.notes[noteId] = next;
  });
}
export function deleteNote(noteId) {
  update((s) => { delete s.notes[noteId]; });
}

// 资源状态。
export function toggleFavorite(resourceId) {
  update((s) => {
    const rs = (s.resourceStates[resourceId] ||= { favorite: false, kind: "external", page: 0, seconds: 0, anchors: [] });
    rs.favorite = !rs.favorite;
  });
}
export function resourceState(resourceId) {
  return state.resourceStates[resourceId] || { favorite: false, kind: "external", page: 0, seconds: 0, anchors: [] };
}
export function setResourceAnchor(resourceId, anchor) {
  update((s) => {
    const rs = (s.resourceStates[resourceId] ||= { favorite: false, kind: "user-file", page: 0, seconds: 0, anchors: [] });
    rs.anchors = [...(rs.anchors || []).slice(-99), { ...anchor, at: new Date().toISOString() }];
    if (anchor.page !== undefined) rs.page = anchor.page;
    if (anchor.seconds !== undefined) rs.seconds = anchor.seconds;
  });
}

// 导入：预检 + 应用（先落可靠备份，不依赖浏览器下载）。
export function inspect(text) {
  return inspectImport(text, state);
}
export function importData(text, mode) {
  if (readOnly) {
    const error = new Error("当前数据以只读恢复模式打开，请先导出备份后重新载入");
    error.code = "E_STORAGE_READ_ONLY";
    throw error;
  }
  const plan = inspect(text);
  const { next, backup } = applyImport(plan, mode, state);
  const check = validateState(next);
  if (!check.ok) {
    const error = new Error("备份包含不安全字段，已拒绝导入");
    error.code = "E_IMPORT_SCHEMA";
    throw error;
  }
  const backupKey = "ai-learning-import-backup";
  try {
    localStorage.setItem(backupKey, backup);
  } catch {
    const error = new Error("导入前备份写入失败，现有数据未更改。请先导出备份或释放浏览器存储空间。");
    error.code = "E_IMPORT_BACKUP_FAILED";
    throw error;
  }
  if (!persist(localStorage, next)) {
    const error = new Error("存储空间不足，未替换现有数据；导入前备份已保留在本机");
    error.code = "E_STORAGE_QUOTA";
    throw error;
  }
  state = normalize(next);
  notify();
  return { plan, backup };
}

export function exportAll() {
  update((s) => { s.backedUp = new Date().toISOString(); }, { silent: true });
  return exported(state);
}

export function setGoal(goal) {
  update((s) => { s.goal = goal; });
}
export function saveDiagnostic(answers) {
  update((s) => {
    s.diagnostic = {
      completed: true,
      answers,
      completedAt: new Date().toISOString(),
    };
  });
}

// 同步（完整模式）。
export function applyRemote(remoteState, revision, account) {
  if (!remoteState || typeof remoteState !== "object") {
    const error = new Error("服务器没有可恢复的数据");
    error.code = "E_SYNC_EMPTY";
    throw error;
  }
  const next = normalize(remoteState);
  next.sync = { ...next.sync, enabled: true, account, revision };
  if (readOnly || !persist(localStorage, next)) {
    const error = new Error("服务器数据已保留；本机存储空间不足或处于只读模式，未替换本机数据");
    error.code = "E_SYNC_LOCAL_STORAGE";
    throw error;
  }
  state = next;
  notify();
}
export function markSynced(revision) {
  update((s) => { s.sync.revision = revision; }, { silent: true });
}
export function setSyncAccount(account, enabled, revision = 0) {
  update((s) => {
    s.sync.account = account;
    s.sync.enabled = enabled;
    s.sync.revision = revision;
  });
}

export function totalEvidence() {
  return Object.values(state.progress).reduce(
    (n, p) => n + ["read", "selfReported", "exercisePassed", "experimentPassed", "reviewed", "explained", "implemented", "diagnosed", "verified"].filter((k) => p[k]).length,
    0,
  );
}
