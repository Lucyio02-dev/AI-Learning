// 项目阶段的证据来源。自报只表示学习者认为任务完成，不冒充程序检查或人工复核。
export const STAGE_SOURCES = Object.freeze({
  none: "未标记",
  "self-report": "自报完成",
  "program-check": "程序检查通过",
  "model-suggestion": "模型建议",
  "manual-review": "人工复核通过",
});

const VERIFIED_SOURCES = new Set(["program-check", "manual-review"]);

export function stageEvidence(saved = {}) {
  const done = !!saved?.done;
  const source = done
    ? (Object.hasOwn(STAGE_SOURCES, saved?.source) ? saved.source : "self-report")
    : "none";
  return {
    done,
    source,
    label: STAGE_SOURCES[source],
    verified: done && VERIFIED_SOURCES.has(source),
    legacy: done && !saved?.source,
  };
}

export function stageEvidenceNote(saved = {}) {
  const evidence = stageEvidence(saved);
  if (!evidence.done) return "尚未标记；勾选仅记录为自报，不增加已验证能力。";
  const legacy = evidence.legacy ? "旧记录没有来源字段，按自报处理。" : "";
  const verified = evidence.verified ? "" : "尚未经过程序检查或人工复核。";
  return `${evidence.label}。${legacy}${verified}`;
}
