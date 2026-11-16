export const KEY = "ai-learning-lab-v2";
export const LEGACY_KEY = "ai-learning-platform-state-v1";
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 100000) => (typeof v === "string" ? v.slice(0, max) : "");
export const fresh = () => ({
  version: 2,
  goal: "llm",
  last: { course: "foundation", step: 0 },
  progress: {},
  notes: {},
  runs: [],
  favorites: [],
  videos: [],
  reports: {},
  legacy: null,
  backedUp: null,
});
export function normalize(raw) {
  if (!object(raw) || raw.version !== 2)
    throw Error("需要版本 2 学习数据，或旧版平台导出的备份。");
  const s = fresh();
  s.goal = ["llm", "embodied", "research"].includes(raw.goal)
    ? raw.goal
    : "llm";
  if (object(raw.last))
    s.last = {
      course: str(raw.last.course, 80) || "foundation",
      step: Math.max(0, Math.min(3, Number(raw.last.step) || 0)),
    };
  for (const [id, p] of Object.entries(
    object(raw.progress) ? raw.progress : {},
  )) {
    if (!object(p)) continue;
    s.progress[id] = {
      read: !!p.read,
      explained: !!p.explained,
      implemented: !!p.implemented,
      diagnosed: !!p.diagnosed,
      verified: !!p.verified,
    };
  }
  for (const [id, n] of Object.entries(object(raw.notes) ? raw.notes : {})) {
    if (!object(n)) continue;
    s.notes[id] = {
      title: str(n.title, 500),
      body: str(n.body),
      tags: str(n.tags, 1000),
      updated: str(n.updated, 80),
    };
  }
  s.favorites = Array.isArray(raw.favorites)
    ? raw.favorites.filter((x) => typeof x === "string").slice(0, 1000)
    : [];
  s.runs = Array.isArray(raw.runs)
    ? raw.runs
        .filter(object)
        .slice(-100)
        .map((r) => ({
          id: str(r.id, 100),
          lab: str(r.lab, 50),
          time: str(r.time, 80),
          summary: str(r.summary, 1000),
          evidence: str(r.evidence, 20000),
          passed: !!r.passed,
        }))
    : [];
  s.videos = Array.isArray(raw.videos)
    ? raw.videos
        .filter(object)
        .map((v) => ({ title: str(v.title, 300), url: str(v.url, 2000) }))
        .filter((v) => /^https?:\/\//i.test(v.url))
    : [];
  if (object(raw.reports))
    for (const [id, body] of Object.entries(raw.reports))
      s.reports[id] = str(body);
  s.legacy = object(raw.legacy) ? raw.legacy : null;
  s.backedUp = str(raw.backedUp, 80) || null;
  return s;
}
export function migrate(old) {
  if (
    !object(old) ||
    ![
      "progress",
      "notes",
      "practiceLogs",
      "activeModule",
      "favorites",
      "videos",
    ].some((k) => k in old)
  )
    throw Error("没有找到有效学习数据。");
  const s = fresh();
  s.legacy = old;
  // 旧进度来自手动打卡，不将它转换为新版本能力证据。
  for (const [id, n] of Object.entries(object(old.notes) ? old.notes : {})) {
    if (!object(n)) continue;
    s.notes[id] = {
      title: str(n.title, 500) || "旧版笔记",
      body: str(n.body),
      tags: str(n.tags, 1000),
      updated: str(n.updated, 80),
    };
  }
  for (const [id, body] of Object.entries(
    object(old.practiceLogs) ? old.practiceLogs : {},
  )) {
    if (typeof body === "string" && body.trim())
      s.notes[`legacy-log-${id}`] = {
        title: `旧版实验记录 · ${id}`,
        body,
        tags: "旧版迁移",
        updated: "",
      };
  }
  s.videos = Array.isArray(old.videos) ? old.videos : [];
  return normalize(s);
}
export function parseImport(text) {
  const data = JSON.parse(text);
  if (!object(data)) throw Error("备份内容不是学习数据对象。");
  const raw = data.state || data;
  return raw.version === 2 ? normalize(raw) : migrate(raw);
}
export function load(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (raw) return { state: normalize(JSON.parse(raw)), message: "" };
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy)
      return {
        state: migrate(JSON.parse(legacy)),
        message:
          "已读取旧版笔记与实验记录。旧打卡完整保留在备份中，不计入能力。",
      };
    return { state: fresh(), message: "" };
  } catch (error) {
    let recovered = false;
    try {
      const original = storage.getItem(KEY);
      if (original) {
        storage.setItem(`${KEY}-recovery`, original);
        recovered = true;
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
    { exportedAt: new Date().toISOString(), app: "ai-learning-lab", state },
    null,
    2,
  );
}
