// RAG 词项检索基线（浏览器本地可跑）+ 评测指标。
// embedding 检索与生成由本地后端提供；两者结果在此并列比较。
export const corpus = [
  {
    id: "archive",
    title: "旧版选课说明",
    date: "2024-09-01",
    version: "2024",
    current: false,
    text: "选课课程退选截止时间为开课后第二周周日。旧版规定，仅供历史查询。",
  },
  {
    id: "current",
    title: "当前学期选课指南",
    date: "2026-09-01",
    version: "2026",
    current: true,
    text: "选课课程退选截止时间为开课后第一周周五 17:00。适用于当前学期。",
  },
  {
    id: "library",
    title: "图书馆开放安排",
    date: "2026-09-01",
    version: "2026",
    current: true,
    text: "图书馆工作日开放至 22:00，节假日安排以公告为准。",
  },
  {
    id: "lab",
    title: "实验室预约说明",
    date: "2026-09-01",
    version: "2026",
    current: true,
    text: "实验室预约需提前一天，预约失败后可查询可用时间段。",
  },
];

// 分块（演示用参数化分块；真实资料在服务端同样按此参数分块）。
export function chunkDocument(doc, { size = 60, overlap = 20 } = {}) {
  const text = doc.text;
  const chunks = [];
  for (let i = 0, n = 1; i < text.length; i += size - overlap, n++) {
    const piece = text.slice(i, i + size);
    if (!piece) break;
    chunks.push({
      id: `${doc.id}#c${n}`,
      docId: doc.id,
      title: doc.title,
      version: doc.version,
      current: doc.current,
      date: doc.date,
      text: piece,
    });
  }
  return chunks;
}

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
  { topK = 2, currentOnly = false, missing = false, chunks = null } = {},
) {
  const source = chunks || corpus;
  const q = tokens(query);
  return source
    .filter(
      (d) =>
        (!currentOnly || d.current) &&
        (!missing || d.id !== "current" || d.docId),
    )
    .map((d) => ({
      ...d,
      score: q.reduce(
        (n, t) => n + (`${d.title} ${d.text}`).toLowerCase().includes(t),
        0,
      ),
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.min(6, Math.max(1, Number(topK) || 1)));
}

// 标注评测集：检索指标与回答指标分开。
export const evalSet = [
  {
    id: "q1",
    question: "选课课程退选截止时间",
    gold: ["current#c1"],
    expect: "第一周周五 17:00",
    unseen: false,
  },
  {
    id: "q2",
    question: "图书馆几点关门",
    gold: ["library#c1"],
    expect: "22:00",
    unseen: false,
  },
  {
    id: "q3",
    question: "实验室预约要提前多久",
    gold: ["lab#c1"],
    expect: "提前一天",
    unseen: false,
  },
  {
    id: "q4",
    question: "体育馆游泳馆开放时间",
    gold: [],
    expect: null,
    unseen: false, // 库内无资料 → 应拒答
  },
  {
    id: "q5",
    question: "退课最晚什么时候可以取消",
    gold: ["current#c1"],
    expect: "第一周周五 17:00",
    unseen: false,
  },
  // 未见样例（调试时不允许使用）
  {
    id: "u1",
    question: "查询个人选课结果",
    gold: [],
    expect: null,
    unseen: true,
  },
  {
    id: "u2",
    question: "当前学期课程退选的最后期限是哪天",
    gold: ["current#c1"],
    expect: "第一周周五 17:00",
    unseen: true,
  },
  {
    id: "u3",
    question: "预约实验台位的注意事项",
    gold: ["lab#c1"],
    expect: "提前一天",
    unseen: true,
  },
];

// 检索指标：hit@k（任一正确块出现在 Top-K）。
export function retrievalHit(results, gold) {
  if (!gold.length) return null; // 无正确块的问题不算命中
  return results.some((r) => gold.includes(r.id)) ? 1 : 0;
}

// 回答指标：有据正确 / 无据编造 / 错误。
export function gradeAnswer(answer, item) {
  const text = answer || "";
  if (!item.expect)
    return /无法|未覆盖|没有找到|不知道|资料未/.test(text) ? "grounded-refusal" : "fabrication";
  const right = item.expect
    .split(/[\s，、]/)
    .filter(Boolean)
    .some((k) => text.includes(k));
  const cites = /\[?[\w-]+#c\d+\]?/.test(text);
  return right ? (cites ? "grounded-cited" : "grounded") : "wrong";
}

export const failureModes = {
  version: "旧版与当前规定混合，需要版本过滤",
  missing: "正确证据缺失，应补充资料而非调大 Top-K",
  grounding: "检索正常，仍需核验引用与回答",
  truncation: "上下文过长，正确证据被截断挤掉",
  wrongRecall: "高分召回不相关内容，需改查询或过滤",
  unusedEvidence: "证据在上下文里但生成未使用",
};

// 故障注入配置 → 传给服务端/本地引擎的视图。
export function applyFaults(base, faults = {}) {
  let docs = base;
  if (faults.versionConflict === false) docs = docs.filter((d) => d.current);
  return docs;
}

export const ragDiagnosis = ({ currentOnly = false, missing = false } = {}) =>
  missing ? "missing" : currentOnly ? "grounding" : "version";
export const assessRag = (answer, options) => answer === ragDiagnosis(options);
