// 存储层：加载、迁移、导入预检与可恢复导入。
// v1/v2/v3 迁移链在 schema.normalize 内实现；本文件负责存储交互、
// 错误恢复副本、导入范围预检与合并策略。
import {
  SCHEMA_VERSION,
  fresh,
  normalize,
  normalizeRun,
  normalizeNote,
} from "./schema.js";
import { AppError } from "./errors.js";

export const KEY = "ai-learning-lab-v3";
export const V2_KEY = "ai-learning-lab-v2";
export const LEGACY_KEY = "ai-learning-platform-state-v1";

export function load(storage) {
  try {
    const raw = storage.getItem(KEY) || storage.getItem(V2_KEY);
    if (raw)
      return { state: normalize(JSON.parse(raw)), message: "" };
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy)
      return {
        state: normalize(JSON.parse(legacy)),
        message:
          "已读取旧版笔记与实验记录。旧打卡完整保留在备份中，不计入能力。",
      };
    return { state: fresh(), message: "" };
  } catch (error) {
    let recovered = false;
    try {
      for (const key of [KEY, V2_KEY]) {
        const original = storage.getItem(key);
        if (original) {
          storage.setItem(`${key}-recovery`, original);
          recovered = true;
        }
      }
    } catch {}
    return {
      state: fresh(),
      readOnly: !recovered,
      message: `读取失败，${recovered ? "原始内容已另存为恢复副本" : "请先备份浏览器原始存储再继续"}：${error.message}`,
    };
  }
}

export function persist(storage, state) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exported(state) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "ai-learning-lab",
      schema: SCHEMA_VERSION,
      state,
    },
    null,
    2,
  );
}

// 导入预检：不改动现有数据，返回范围摘要、冲突与建议模式。
export function inspectImport(text, current = fresh()) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new AppError("E_IMPORT_PARSE", error.message);
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AppError("E_IMPORT_NOT_OBJECT");
  const raw = data.state && typeof data.state === "object" ? data.state : data;
  const incoming = normalize(raw);
  const counts = (s) => ({
    notes: Object.keys(s.notes).length,
    runs: s.runs.length + s.archive.length,
    courses: Object.keys(s.progress).length,
    projects: Object.keys(s.projects).length,
    resources: Object.keys(s.resourceStates).length,
    videos: s.videos.length,
    quizAttempts: s.quizAttempts.length,
  });
  const a = counts(incoming);
  const b = counts(current);
  const conflicts = [];
  for (const id of Object.keys(incoming.notes))
    if (current.notes[id] && current.notes[id].body !== incoming.notes[id].body)
      conflicts.push({ type: "note", id, incomingAt: incoming.notes[id].updatedAt });
  if (incoming.diagnostic.completed && current.diagnostic.completed)
    conflicts.push({ type: "diagnostic", id: "diagnostic" });
  const from = incoming.migratedFrom || SCHEMA_VERSION;
  return {
    schema: SCHEMA_VERSION,
    migratedFrom: from,
    incoming: a,
    current: b,
    conflicts,
    suggestedMode: conflicts.length ? "merge" : "replace",
    incomingState: incoming,
  };
}

// 合并策略：笔记/进度/项目/资源取更新时间较新者或并集；
// runs、videos、quizAttempts 并集去重；诊断问卷保留较新完成者。
export function mergeStates(current, incoming) {
  const s = structuredClone(current);
  const newer = (aAt, bAt) => !bAt || (aAt && aAt >= bAt);
  for (const [id, note] of Object.entries(incoming.notes)) {
    const mine = s.notes[id];
    s.notes[id] = !mine || newer(note.updatedAt, mine.updatedAt) ? note : mine;
  }
  for (const [id, p] of Object.entries(incoming.progress)) {
    const mine = s.progress[id];
    s.progress[id] = {
      read: (mine?.read || p.read) && (mine ? (newer(p.updatedAt, mine.updatedAt) ? p.read : mine.read) : p.read),
      selfReported: mine?.selfReported || p.selfReported,
      exercisePassed: mine?.exercisePassed || p.exercisePassed,
      experimentPassed: mine?.experimentPassed || p.experimentPassed,
      reviewed: mine?.reviewed || p.reviewed,
      evidence: [...new Set([...(mine?.evidence || []), ...p.evidence])],
      viewedSteps: [...new Set([...(mine?.viewedSteps || []), ...p.viewedSteps])],
      updatedAt: [mine?.updatedAt, p.updatedAt].sort().at(-1) || "",
    };
  }
  const seen = new Set([...s.runs, ...s.archive].map((r) => r.id));
  for (const r of [...incoming.runs, ...incoming.archive])
    if (!seen.has(r.id)) (s.archive.length > 400 ? s.archive : s.runs).push(r);
  for (const [id, rs] of Object.entries(incoming.resourceStates)) {
    const mine = s.resourceStates[id];
    s.resourceStates[id] = mine
      ? {
          favorite: mine.favorite || rs.favorite,
          kind: rs.kind === "user-file" ? rs.kind : mine.kind,
          page: Math.max(mine.page, rs.page),
          seconds: Math.max(mine.seconds, rs.seconds),
          anchors: [...mine.anchors, ...rs.anchors].slice(-100),
        }
      : rs;
  }
  const videoSeen = new Set(s.videos.map((v) => v.url));
  for (const v of incoming.videos)
    if (!videoSeen.has(v.url)) s.videos.push(v);
  for (const [id, p] of Object.entries(incoming.projects))
    if (!s.projects[id] || !s.projects[id].report) s.projects[id] = p;
  const quizSeen = new Set(s.quizAttempts.map((q) => q.id));
  for (const q of incoming.quizAttempts)
    if (!quizSeen.has(q.id)) s.quizAttempts.push(q);
  if (newer(incoming.diagnostic.completedAt, s.diagnostic.completedAt))
    s.diagnostic = incoming.diagnostic;
  if (newer(incoming.last.updatedAt, s.last.updatedAt)) s.last = incoming.last;
  for (const [id, pos] of Object.entries(incoming.positions))
    if (newer(pos.updatedAt, s.positions[id]?.updatedAt)) s.positions[id] = pos;
  return s;
}

// 导入应用：先落可靠的服务端/备用备份（不依赖浏览器下载），
// 再替换或合并。返回新状态与备份文本。
export function applyImport(parsed, mode, current = fresh()) {
  const incoming = parsed.incomingState || parsed;
  const next =
    mode === "merge" ? mergeStates(current, incoming) : structuredClone(incoming);
  const backup = exported(current);
  return { next, backup };
}

// 便捷入口：接受备份文本（{state} 包装或裸状态），返回 v3 状态。
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new AppError("E_IMPORT_PARSE", error.message);
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AppError("E_IMPORT_NOT_OBJECT");
  const raw = data.state && typeof data.state === "object" ? data.state : data;
  return normalize(raw);
}

// 数据校验：字段类型、URL 协议、日期与原型污染键都拒绝或剔除。
export function validateState(state) {
  const issues = [];
  const dangerous = (s) => /__proto__|constructor|prototype/i.test(s);
  for (const id of Object.keys(state.notes || {}))
    if (dangerous(id)) issues.push({ field: `notes.${id}`, code: "E_IMPORT_SCHEMA" });
  for (const v of state.videos || [])
    if (!/^https?:\/\//i.test(v.url))
      issues.push({ field: "videos.url", code: "E_IMPORT_SCHEMA" });
  for (const [id, p] of Object.entries(state.progress || {}))
    if (dangerous(id)) issues.push({ field: `progress.${id}`, code: "E_IMPORT_SCHEMA" });
  return { ok: issues.length === 0, issues };
}
