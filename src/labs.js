export const corpus = [
  {
    id: "archive",
    title: "旧版选课说明",
    date: "2024-09-01",
    current: false,
    text: "选课课程退选截止时间为开课后第二周周日。旧版规定，仅供历史查询。",
  },
  {
    id: "current",
    title: "当前学期选课指南",
    date: "2026-09-01",
    current: true,
    text: "选课课程退选截止时间为开课后第一周周五 17:00。适用于当前学期。",
  },
  {
    id: "library",
    title: "图书馆开放安排",
    date: "2026-09-01",
    current: true,
    text: "图书馆工作日开放至 22:00，节假日安排以公告为准。",
  },
  {
    id: "lab",
    title: "实验室预约说明",
    date: "2026-09-01",
    current: true,
    text: "实验室预约需提前一天，预约失败后可查询可用时间段。",
  },
];
const tokens = (text) => {
  const s = text.toLowerCase();
  return [
    ...new Set([
      ...(s.match(/[a-z0-9]+/g) || []),
      ...Array.from(s.matchAll(/[\u4e00-\u9fff]{2}/gu), (m) => m[0]),
      ...Array.from(s.matchAll(/(?=([\u4e00-\u9fff]{2}))/gu), (m) => m[1]),
    ]),
  ];
};
export function retrieve(
  query,
  { topK = 2, currentOnly = false, missing = false } = {},
) {
  const q = tokens(query);
  return corpus
    .filter(
      (d) => (!currentOnly || d.current) && (!missing || d.id !== "current"),
    )
    .map((d) => ({
      ...d,
      score: q.reduce(
        (n, t) => n + (d.title + " " + d.text).toLowerCase().includes(t),
        0,
      ),
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.min(4, Math.max(1, Number(topK) || 1)));
}
export function promptDemo({
  evidence = false,
  format = false,
  conflict = false,
}) {
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
    reason:
      "已提供适用证据；仍需对照原文核验。这是规则演示，不代表模型行为测量。",
  };
}
export function ragDiagnosis({ currentOnly = false, missing = false }) {
  return missing ? "missing" : currentOnly ? "grounding" : "version";
}
export function agentStep(state, action) {
  const s = structuredClone(state);
  if (s.done) return s;
  if (action === "start") {
    s.phase = "interrupted";
    s.log.push(
      "① 查询可用预约 → 成功",
      "② 写入预约 → 服务端已提交，但客户端收到超时",
      "检查点：写入结果未知；已发生一次写入",
    );
    s.writes = 1;
  }
  if (s.phase === "interrupted" && action === "retry") {
    s.writes++;
    s.done = true;
    s.passed = false;
    s.log.push(
      "③ 原样重试写入 → 创建重复预约",
      "验证失败：同一目标出现两条预约。应先按请求标识核验。",
    );
  }
  if (s.phase === "interrupted" && action === "verify") {
    s.phase = "checked";
    s.log.push(
      "③ 按请求标识查询 → 找到已生效预约，状态 confirmed",
      "恢复检查点：已确认写入，不再重复提交",
    );
  }
  if (s.phase === "checked" && action === "finish") {
    s.done = true;
    s.passed = s.writes === 1;
    s.log.push(
      "④ 核验目标、时间与预约数量 → 通过",
      "完成：一次写入，一条预约，保留可追踪记录",
    );
  }
  return s;
}
export const newAgent = () => ({
  phase: "idle",
  writes: 0,
  log: [],
  done: false,
  passed: false,
});
export function motion(angle, correct = true, target = { x: 3, y: 2 }) {
  const t = (Number(angle) * Math.PI) / 180;
  const c = Math.cos(t),
    s = Math.sin(t);
  const body = correct
    ? { x: c * target.x + s * target.y, y: -s * target.x + c * target.y }
    : { ...target };
  const actual = { x: c * body.x - s * body.y, y: s * body.x + c * body.y };
  return {
    body,
    actual,
    target,
    error: Math.hypot(actual.x - target.x, actual.y - target.y),
  };
}
export function assessRag(answer, options) {
  return answer === ragDiagnosis(options);
}
