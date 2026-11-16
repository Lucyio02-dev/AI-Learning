// v3 正式 schema。所有实体使用稳定 ID；课程 ID 是平台身份，
// 教材章节编号只作为 content.js 里的 sourceRef 属性存在。
import { AppError } from "./errors.js";

export const SCHEMA_VERSION = 3;
export const RUN_CAP = 100; // 活跃实验记录上限；超出进入 archive，不静默丢弃
export const NOTE_REVISIONS = 10;

const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 100000) =>
  typeof v === "string" ? v.slice(0, max) : "";
const num = (v, fallback = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;
const bool = (v) => !!v;
const arr = (v) => (Array.isArray(v) ? v : []);
const iso = (v, max = 80) => {
  const s = str(v, max);
  return s && !Number.isNaN(Date.parse(s)) ? s : "";
};

export function stableId(prefix = "id") {
  const uuid =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

export const fresh = () => ({
  version: SCHEMA_VERSION,
  goal: "llm",
  diagnostic: { completed: false, answers: null, completedAt: "" },
  last: { course: "foundation", step: 0, updatedAt: "" },
  positions: {}, // courseId -> { step, updatedAt } 恢复真实步骤位置
  progress: {}, // courseId -> progress
  notes: {}, // noteId -> note
  runs: [], // 活跃实验/模型运行记录
  archive: [], // 超出上限归档的记录，可查看与导出
  resourceStates: {}, // resourceId -> { favorite, kind, page, seconds, anchors }
  videos: [],
  projects: {}, // projectId -> { stages, report, linkedRunIds }
  quizAttempts: [], // 能力评价的作答记录（解释/实现/诊断/验证）
  reviews: {}, // courseId -> 人工/AI 复核结论
  sync: { enabled: false, account: null, revision: 0, pendingOps: [] },
  settings: { runCap: RUN_CAP, reducedMotion: false },
  legacy: null,
  backedUp: null,
  migratedFrom: 0,
});

export const PROGRESS_STATUSES = [
  "read",
  "selfReported",
  "exercisePassed",
  "experimentPassed",
  "reviewed",
];

export function normalizeProgress(raw = {}) {
  const p = {};
  for (const [id, v] of Object.entries(object(raw) ? raw : {})) {
    if (!object(v)) continue;
    // v2 遗留字段（explained/implemented/diagnosed/verified）只证明自报，
    // 不冒充实验通过；v3 的 experimentPassed/reviewed 才是真实能力。
    const legacy =
      "diagnosed" in v || "verified" in v || "explained" in v || "implemented" in v;
    p[str(id, 80)] = {
      read: bool(v.read),
      selfReported: bool(v.selfReported) || legacy,
      exercisePassed: bool(v.exercisePassed) && !legacy,
      experimentPassed: !legacy && bool(v.experimentPassed),
      reviewed: !legacy && bool(v.reviewed),
      // v2 的 explained/implemented 字段不构成完整采集流程，
      // 迁移时降级为自报状态，避免冒充已验证能力。
      evidence: arr(v.evidence)
        .map((x) => str(x, 100))
        .filter(Boolean)
        .slice(0, 200),
      viewedSteps: arr(v.viewedSteps)
        .map((x) => Math.max(0, Math.min(15, num(x, 0))))
        .filter((x, i, a) => a.indexOf(x) === i),
      updatedAt: iso(v.updatedAt),
    };
  }
  return p;
}

export function normalizeNote(raw) {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => str(t, 60)).filter(Boolean).slice(0, 30)
    : str(raw.tags, 1000)
      ? str(raw.tags, 1000).split(/[,，\s]+/).filter(Boolean).slice(0, 30)
      : [];
  const links = object(raw.links) ? raw.links : {};
  const linkList = (v) =>
    arr(v).map((x) => str(x, 100)).filter(Boolean).slice(0, 100);
  return {
    id: str(raw.id, 120) || stableId("note"),
    title: str(raw.title, 500) || "未命名笔记",
    body: str(raw.body),
    tags,
    links: {
      course: linkList(links.course),
      resource: linkList(links.resource),
      lab: linkList(links.lab),
      run: linkList(links.run),
    },
    pinned: bool(raw.pinned),
    updatedAt: iso(raw.updatedAt) || new Date().toISOString(),
    revisions: arr(raw.revisions)
      .filter(object)
      .slice(-NOTE_REVISIONS)
      .map((r) => ({ at: iso(r.at) || new Date().toISOString(), body: str(r.body) })),
  };
}

export function normalizeRun(raw) {
  const evidence = object(raw.evidence) ? raw.evidence : null;
  return {
    id: str(raw.id, 120) || stableId("run"),
    lab: str(raw.lab, 60),
    time: iso(raw.time) || new Date().toISOString(),
    mode: ["rule", "local-compute", "model", "sim", "train"].includes(raw.mode)
      ? raw.mode
      : "rule",
    summary: str(raw.summary, 1000),
    evidence,
    evidenceText: str(raw.evidenceText ?? (evidence ? "" : raw.evidence), 30000),
    passed: bool(raw.passed),
    statuses: object(raw.statuses)
      ? {
          diagnosed: bool(raw.statuses.diagnosed),
          verified: bool(raw.statuses.verified),
        }
      : { diagnosed: bool(raw.passed), verified: bool(raw.passed) },
    config: object(raw.config) ? raw.config : null,
    metrics: object(raw.metrics) ? raw.metrics : null,
    artifacts: arr(raw.artifacts)
      .map((a) => (object(a) ? a : { name: str(a, 200) }))
      .slice(0, 50),
  };
}

export function normalizeResourceState(raw = {}) {
  const out = {};
  for (const [id, v] of Object.entries(object(raw) ? raw : {})) {
    if (!object(v)) continue;
    out[str(id, 160)] = {
      favorite: bool(v.favorite),
      kind: ["platform-course", "external", "user-file"].includes(v.kind)
        ? v.kind
        : "external",
      page: num(v.page, 0),
      seconds: num(v.seconds, 0),
      anchors: arr(v.anchors)
        .filter(object)
        .slice(0, 100)
        .map((a) => ({
          page: num(a.page, 0) || undefined,
          seconds: num(a.seconds, 0) || undefined,
          note: str(a.note, 100) || undefined,
          noteId: str(a.noteId, 120) || undefined,
          at: iso(a.at) || new Date().toISOString(),
        })),
    };
  }
  return out;
}

export function normalize(raw) {
  if (!object(raw)) throw new AppError("E_IMPORT_NOT_OBJECT");
  if (raw.version === SCHEMA_VERSION) return fromV3(raw);
  if (raw.version === 2) return fromV2(raw);
  if (raw.version === 1 || ["progress", "notes", "practiceLogs", "activeModule"].some((k) => k in raw))
    return fromV1(raw);
  throw new AppError("E_IMPORT_VERSION", `version=${String(raw.version)}`);
}

function base() {
  const s = fresh();
  return s;
}

function fromV3(raw) {
  const s = base();
  s.goal = ["llm", "embodied", "research"].includes(raw.goal) ? raw.goal : "llm";
  const d = object(raw.diagnostic) ? raw.diagnostic : {};
  s.diagnostic = {
    completed: bool(d.completed),
    answers: object(d.answers) ? d.answers : null,
    completedAt: iso(d.completedAt),
  };
  if (object(raw.last))
    s.last = {
      course: str(raw.last.course, 80) || "foundation",
      step: Math.max(0, num(raw.last.step, 0)),
      updatedAt: iso(raw.last.updatedAt),
    };
  if (object(raw.positions))
    for (const [id, p] of Object.entries(raw.positions))
      if (object(p))
        s.positions[str(id, 80)] = {
          step: Math.max(0, num(p.step, 0)),
          updatedAt: iso(p.updatedAt),
        };
  s.progress = normalizeProgress(raw.progress);
  for (const [id, n] of Object.entries(object(raw.notes) ? raw.notes : {})) {
    if (!object(n)) continue;
    const note = normalizeNote({ ...n, id });
    s.notes[str(id, 120)] = note;
  }
  s.runs = arr(raw.runs).filter(object).map(normalizeRun).slice(-RUN_CAP * 3);
  s.archive = arr(raw.archive).filter(object).map(normalizeRun).slice(-500);
  s.resourceStates = normalizeResourceState(raw.resourceStates);
  // v3 之前的收藏字段兼容读取
  if (Array.isArray(raw.favorites))
    for (const id of raw.favorites.slice(0, 2000))
      if (typeof id === "string")
        s.resourceStates[id] = {
          favorite: true,
          kind: "external",
          page: 0,
          seconds: 0,
          anchors: [],
          ...(object(raw.resourceStates?.[id]) ? {} : {}),
        };
  s.videos = arr(raw.videos)
    .filter(object)
    .map((v) => ({ title: str(v.title, 300), url: str(v.url, 2000) }))
    .filter((v) => /^https?:\/\//i.test(v.url))
    .slice(0, 500);
  for (const [id, p] of Object.entries(object(raw.projects) ? raw.projects : {})) {
    if (!object(p)) continue;
    s.projects[str(id, 60)] = {
      stages: object(p.stages) ? p.stages : {},
      report: str(p.report),
      linkedRunIds: arr(p.linkedRunIds).map((x) => str(x, 120)).slice(0, 500),
    };
  }
  s.quizAttempts = arr(raw.quizAttempts)
    .filter(object)
    .slice(-1000)
    .map((q) => ({
      id: str(q.id, 120) || stableId("quiz"),
      time: iso(q.time) || new Date().toISOString(),
      courseId: str(q.courseId, 80),
      kind: ["explain", "modify", "fault", "regression", "unseen"].includes(q.kind)
        ? q.kind
        : "explain",
      capability: ["explained", "implemented", "diagnosed", "verified"].includes(q.capability)
        ? q.capability
        : "explained",
      answer: str(q.answer, 20000),
      score: object(q.score) ? q.score : null,
      rubric: object(q.rubric) ? q.rubric : null,
      seenBefore: bool(q.seenBefore),
    }));
  s.reviews = object(raw.reviews) ? raw.reviews : {};
  if (object(raw.sync))
    s.sync = {
      enabled: bool(raw.sync.enabled),
      account: object(raw.sync.account) ? raw.sync.account : null,
      revision: Math.max(0, num(raw.sync.revision, 0)),
      pendingOps: arr(raw.sync.pendingOps).slice(0, 200),
    };
  if (object(raw.settings))
    s.settings = {
      runCap: Math.max(RUN_CAP, num(raw.settings.runCap, RUN_CAP)),
      reducedMotion: bool(raw.settings.reducedMotion),
    };
  s.legacy = object(raw.legacy) ? raw.legacy : null;
  s.backedUp = iso(raw.backedUp) || null;
  s.migratedFrom = raw.migratedFrom || SCHEMA_VERSION;
  return s;
}

// v2 → v3：保留全部可迁移数据，expl/impl 降级为自报，旧打卡不冒充能力。
function fromV2(raw) {
  const s = fromV3({ ...structuredClone(raw), version: SCHEMA_VERSION });
  if (object(raw.reports))
    for (const [id, body] of Object.entries(raw.reports))
      s.projects[str(id, 60)] = { ...(s.projects[str(id, 60)] || {}), stages: s.projects[str(id, 60)]?.stages || {}, report: str(body), linkedRunIds: s.projects[str(id, 60)]?.linkedRunIds || [] };
  for (const p of Object.values(s.progress)) {
    if (p.experimentPassed || p.diagnosed || p.verified) {
      p.experimentPassed = false;
      p.selfReported = true;
    }
    if (p.explained || p.implemented) p.selfReported = true;
    delete p.explained;
    delete p.implemented;
    delete p.diagnosed;
    delete p.verified;
  }
  for (const r of s.runs) {
    if (!r.evidence && r.evidenceText) r.evidence = null;
    r.mode = r.mode || "rule";
    // v2 的通过判定把一次练习同时计为诊断+验证；v3 要求分开采集。
    if (r.statuses.diagnosed && r.statuses.verified) {
      r.statuses = { diagnosed: true, verified: false };
    }
  }
  for (const [id, n] of Object.entries(s.notes)) {
    if (typeof n.tags === "string")
      n.tags = n.tags.split(/[,，\s]+/).filter(Boolean);
  }
  s.migratedFrom = 2;
  s.legacy = object(raw.legacy) ? raw.legacy : null;
  return s;
}

// v1 → v3：笔记与实验文本保留，打卡不转换。
function fromV1(old) {
  const s = base();
  s.migratedFrom = 1;
  s.legacy = structuredClone(old);
  for (const [id, n] of Object.entries(object(old.notes) ? old.notes : {})) {
    if (!object(n)) continue;
    const note = normalizeNote({
      id,
      title: str(n.title, 500) || "旧版笔记",
      body: str(n.body),
      tags: str(n.tags, 1000),
      updated: n.updated,
    });
    s.notes[str(id, 120)] = note;
  }
  for (const [id, body] of Object.entries(
    object(old.practiceLogs) ? old.practiceLogs : {},
  ))
    if (typeof body === "string" && body.trim())
      s.notes[`legacy-log-${str(id, 60)}`] = normalizeNote({
        id: `legacy-log-${id}`,
        title: `旧版实验记录 · ${id}`,
        body,
        tags: ["旧版迁移"],
        updated: "",
      });
  s.videos = arr(old.videos)
    .filter(object)
    .map((v) => ({ title: str(v.title, 300), url: str(v.url, 2000) }))
    .filter((v) => /^https?:\/\//i.test(v.url));
  return s;
}
