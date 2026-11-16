// Prompt 实验室引擎：规则演示（入门）+ 变体/批量/校验逻辑。
// 真实模型调用在 server 端完成，本文件提供请求构造与结果评估。
export function promptDemo({ evidence = false, format = false, conflict = false }) {
  if (conflict)
    return {
      answer: "要求冲突：同时要求“只返回 JSON”和“只返回一段自然语言”。",
      diagnosis: "conflict",
      reason: "先消除互相排斥的输出要求，再验证格式与事实。",
    };
  if (!evidence)
    return {
      answer: format
        ? '{"deadline":null,"reason":"缺少当前学期规定"}'
        : "缺少当前学期规定，无法从已有信息确定截止时间。",
      diagnosis: "evidence",
      reason: "角色和格式不能补全缺失事实。应提供适用资料或查询来源。",
    };
  return {
    answer: format
      ? '{"deadline":"第一周周五 17:00","source":"当前学期选课指南"}'
      : "根据当前学期选课指南，退选截止时间为第一周周五 17:00。",
    diagnosis: "ready",
    reason: "已提供适用证据；仍需对照原文核验。这是规则演示，不代表模型行为测量。",
  };
}

// 变体构造：单变量差异（A/B），每版只改一个成分。
export function buildVariants(base = {}) {
  const material = base.material || "当前学期选课指南：退选截止时间为第一周周五 17:00。";
  const task = base.task || "本学期退选课程的截止时间是什么时候？";
  const mk = (name, diff, content) => ({
    id: name,
    diff,
    messages: [{ role: "user", content }],
  });
  const withEvidence = `以下是学校规定：${material}\n\n任务：${task}\n只使用给出的规定作答，并注明来源。若规定未覆盖问题，回答“资料未覆盖”。`;
  return [
    mk("A-基线（无证据）", "无", `任务：${task}\n请回答。`),
    mk("B-补充证据", "+事实材料", withEvidence),
    mk("C-证据+格式", "+JSON 格式", `${withEvidence}\n输出 JSON：{"deadline": string|null, "source": string}`),
    mk("D-冲突指令", "+格式冲突", `${withEvidence}\n只返回 JSON。\n同时：只返回一段自然语言，不要 JSON。`),
  ];
}

// JSON 结构校验（独立于内容正确性）。
export function checkJson(text, schema = ["deadline", "source"]) {
  try {
    const obj = JSON.parse(text);
    const missing = schema.filter((k) => !(k in obj));
    return { valid: missing.length === 0, missing, obj };
  } catch {
    return { valid: false, missing: schema.slice(), obj: null };
  }
}

// 内容评估：依据明确任务与证据（规则模式用关键词判定；
// 真实模式优先人工/量规，这里提供辅助判定）。
export function evaluateAnswer(answer, { expectDeadline = false, material } = {}) {
  const hasDeadline = /第一周周五|17:00|friday 17|周五 ?17/i.test(answer || "");
  const grounded = material && material.split("。").some((frag) => frag && answer?.includes(frag.replace(/^[^：]*：/, "")));
  const refuses = /资料未覆盖|无法确定|没有提供/.test(answer || "");
  if (!expectDeadline) return { ok: refuses || !/第一周周五/.test(answer || ""), kind: "should-refuse" };
  return { ok: hasDeadline && (grounded || material === undefined), kind: grounded ? "grounded" : hasDeadline ? "ungrounded" : "wrong" };
}

// 批量运行聚合：返回通过率与失败样例索引。
export function aggregate(results) {
  const passed = results.filter((r) => r.eval?.ok).length;
  return {
    total: results.length,
    passed,
    rate: results.length ? passed / results.length : 0,
    failures: results.map((r, i) => (r.eval?.ok ? null : i)).filter((i) => i !== null),
  };
}

// 兼容旧 assessRag 位置（历史测试引用）。
export const ragDiagnosis = ({ currentOnly = false, missing = false } = {}) =>
  missing ? "missing" : currentOnly ? "grounding" : "version";
export const assessRag = (answer, options) => answer === ragDiagnosis(options);
