// 运行历史查询：活跃与归档统一检索，按需分页，不把记录截断成不可见。
export const HISTORY_PAGE_SIZE = 20;

export function combineRuns(runs = [], archive = []) {
  const byId = new Map();
  for (const run of [...archive, ...runs]) if (run?.id) byId.set(run.id, run);
  return [...byId.values()].sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));
}

export function historyPage(runs = [], archive = [], { query = "", lab = "all", scope = "all", limit = HISTORY_PAGE_SIZE } = {}) {
  const source = scope === "active" ? runs : scope === "archive" ? archive : combineRuns(runs, archive);
  const q = String(query || "").trim().toLowerCase();
  const matched = source.filter((run) => {
    if (lab !== "all" && run.lab !== lab) return false;
    if (!q) return true;
    return [run.id, run.lab, run.summary, run.mode, run.evidenceText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const size = Math.max(HISTORY_PAGE_SIZE, Number(limit) || HISTORY_PAGE_SIZE);
  return {
    items: matched.slice(0, size),
    total: matched.length,
    hasMore: matched.length > size,
    limit: size,
    counts: { active: runs.length, archive: archive.length },
  };
}
