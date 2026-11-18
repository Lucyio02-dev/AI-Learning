// 项目与实验记录只通过稳定 ID 显式关联；活跃与归档运行同等可追溯。
import { combineRuns } from "./history.js";

export const PROJECT_SUGGESTED_LABS = Object.freeze({
  assistant: ["prompt", "rag", "agent"],
  robot: ["embodied"],
  "drone-mapping": [],
});

export function linkedRunsForProject(projectData = {}, allRuns = []) {
  const ids = [...new Set((projectData.linkedRunIds || []).filter(Boolean))];
  const byId = new Map(allRuns.map((run) => [run.id, run]));
  return {
    ids,
    runs: ids.map((id) => byId.get(id)).filter(Boolean),
    missing: ids.filter((id) => !byId.has(id)),
  };
}

export function suggestedRunsForProject(projectId, allRuns = []) {
  const labs = PROJECT_SUGGESTED_LABS[projectId] || [];
  return labs.length ? allRuns.filter((run) => labs.includes(run.lab)) : [];
}

export function runCandidatesForProject(projectData = {}, allRuns = [], query = "", limit = 20) {
  const linked = new Set(projectData.linkedRunIds || []);
  const q = String(query || "").trim().toLowerCase();
  const matched = allRuns.filter((run) => {
    if (linked.has(run.id)) return false;
    if (!q) return true;
    return [run.id, run.lab, run.summary, run.time, run.evidenceText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const size = Math.max(10, Number(limit) || 20);
  return {
    items: matched.slice(0, size),
    total: matched.length,
    hasMore: matched.length > size,
    limit: size,
  };
}

export function allProjectRuns(runs = [], archive = []) {
  return combineRuns(runs, archive);
}
