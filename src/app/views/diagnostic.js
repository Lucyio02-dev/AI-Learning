// 基础诊断（可跳过）：编程/数学/模型概念/目标/时间/设备，减少填写负担。
import * as S from "../state.js";
import { esc, icon, sectionHead, button } from "../ui.js";
import { go } from "../router.js";

const QUESTIONS = [
  {
    id: "coding",
    title: "编程经验",
    help: "决定是否需要先补 Python 环境",
    options: [
      ["none", "没写过代码", 0],
      ["basic", "写过一些脚本", 1],
      ["solid", "能独立完成小型项目", 2],
      ["pro", "熟练，了解工程化", 3],
    ],
  },
  {
    id: "math",
    title: "线性代数与概率",
    help: "决定数学补学深度",
    options: [
      ["none", "基本没接触", 0],
      ["basic", "学过但生疏", 1],
      ["ok", "矩阵乘法、梯度可以上手", 2],
      ["good", "熟悉并用于实践", 3],
    ],
  },
  {
    id: "concepts",
    title: "对大模型的概念",
    help: "决定是否从“模型做了什么”开始",
    options: [
      ["none", "只听过 ChatGPT", 0],
      ["basic", "知道 token/训练这些词", 1],
      ["ok", "能解释 RAG 或微调", 2],
      ["good", "动手调用过模型 API", 3],
    ],
  },
  {
    id: "embodied",
    title: "机器人 / 具身经验",
    options: [
      ["none", "没有", 0],
      ["basic", "了解坐标/传感器概念", 1],
      ["ok", "用过仿真环境", 2],
      ["good", "训练或部署过策略", 3],
    ],
  },
  {
    id: "time",
    title: "每周可投入时间",
    options: [
      ["light", "3 小时以内", 1],
      ["normal", "3-8 小时", 2],
      ["heavy", "8 小时以上", 3],
    ],
  },
  {
    id: "device",
    title: "运行条件",
    help: "影响实验入口推荐",
    options: [
      ["browser", "只能用浏览器", 0],
      ["python", "能装 Python 环境（CPU）", 1],
      ["gpu", "有 GPU 或云算力", 2],
    ],
  },
];

const GOAL_OPTIONS = [
  ["llm", "构建大模型应用（Prompt/RAG/Agent/微调）"],
  ["embodied", "探索具身智能（仿真/策略/VLA）"],
  ["research", "开展研究与论文复现"],
];

export function render() {
  const s = S.getState();
  const answers = s.diagnostic.answers || {};
  return `${sectionHead(
    "STARTING POINT",
    "2 分钟，找准你的起点。",
    "6 个选择题，可全部跳过。答案只保存在本机，用于推荐起点与实验入口，不做能力评判。",
  )}
<form class="panel diagnostic-form" data-form="diagnostic">
  ${GOAL_OPTIONS.map(([v, t]) => `<label class="check-row"><input type="radio" name="goal" value="${v}" ${s.goal === v ? "checked" : ""}> ${esc(t)}</label>`).join("")}
  ${QUESTIONS.map((q) => `
    <fieldset>
      <legend>${esc(q.title)}${q.help ? `<small class="muted">${esc(q.help)}</small>` : ""}</legend>
      <div class="option-row">
        ${q.options.map(([v, t]) => `<label class="check-row"><input type="radio" name="${q.id}" value="${v}" ${answers[q.id] === v ? "checked" : ""}> ${esc(t)}</label>`).join("")}
        <label class="check-row muted-opt"><input type="radio" name="${q.id}" value="skip" ${!answers[q.id] || answers[q.id] === "skip" ? "checked" : ""}> 跳过</label>
      </div>
    </fieldset>`).join("")}
  <div class="form-actions">
    <button class="primary" type="submit">保存并查看推荐起点 ${icon("arrow")}</button>
    <button class="secondary" type="button" data-action="diag-skip">跳过，直接浏览课程</button>
  </div>
</form>
${s.diagnostic.completed ? `<div class="panel">${recommendation(s)}</div>` : ""}`;
}

export function recommendation(s) {
  const a = s.diagnostic.answers || {};
  const coding = a.coding === "pro" || a.coding === "solid";
  const concepts = a.concepts === "good" || a.concepts === "ok";
  const device = a.device || "browser";
  const lines = [];
  if (!s.goal) lines.push("先选一个方向（大模型 / 具身 / 研究），课程会按目标排序。");
  if (!concepts) lines.push("从《从输入到输出：模型做了什么》开始，配合 Prompt 实验室建立变量意识。");
  if (!coding && device !== "browser") lines.push("建议先完成《Python 实验环境》，再跑真实推理。");
  if (concepts && coding) lines.push("可以直接进入 RAG / Agent 课程，用实验室诊断代替阅读入门。");
  if (device === "browser") lines.push("当前只能用浏览器：实验将运行规则演示与词项检索；真实模型/训练实验需要本地后端与 Python。");
  else if (device === "python") lines.push("已具备 CPU 环境：可运行 SmolLM2 真实推理、BC 训练与 RAG embedding 全部实验。");
  else lines.push("有 GPU 时可额外探索原教材微调 Notebook；平台实验全部 CPU 可完成。");
  const time = a.time || "normal";
  lines.push(`按每周 ${time === "light" ? "3 小时以内" : time === "normal" ? "3-8 小时" : "8 小时+"} 投入，公共基础约需 3-5 周。`);
  return `<h3>你的推荐起点</h3><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><button class="text-button" data-page="map">在学习地图里看完整路径 ${icon("arrow")}</button>`;
}

export function bind(root) {
  const form = root.querySelector('[data-form="diagnostic"]');
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const answers = {};
    for (const q of QUESTIONS) {
      const v = data.get(q.id);
      if (v && v !== "skip") answers[q.id] = v;
    }
    const goal = data.get("goal");
    S.saveDiagnostic(answers);
    if (goal && goal !== S.getState().goal) S.setGoal(goal);
    import("../ui.js").then(({ toast }) => toast("诊断已保存，起点推荐已更新"));
    go("home");
  });
  form.querySelector('[data-action="diag-skip"]')?.addEventListener("click", () => go("routes"));
}
