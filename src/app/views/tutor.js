// AI 助教：真实模型 + 当前课程/实验上下文 + 引用可定位 + 不知即说。
// 上下文只发送课程结构文本（不发送用户本机文件）。
import * as S from "../state.js";
import { esc, icon, button, details, loading, errorBox, pill, md } from "../ui.js";
import { hasBackend, modelChat, providers } from "../api.js";
import { getCourse } from "../../content/index.js";
import { go } from "../router.js";

let history = []; // {role, content, refs[]}
const MAX_TURNS = 8;

const SYSTEM = `你是 AI Learning 学习实验室的助教。规则：
1. 只基于“当前课程上下文”和公认的领域知识回答；上下文里没有的课程事实要明确说“课程资料未包含，以下基于通用知识”。
2. 不确定时明确表达不确定性；不编造实验结果、运行数据或论文结论。
3. 回答使用中文，给出“为什么”而不只是“答案”；关键术语首次出现时解释。
4. 如果学生的问题涉及调试，先要证据（错误信息、复现步骤），再给假设。
5. 不代替学生完成评价题，但可以按量规点评他们已写的回答。
6. 回答末尾标注引用：[课程:课程ID·步骤N] 或 [通用知识]。`;

function courseContext(courseId) {
  const c = getCourse(courseId);
  if (!c) return "（未指定课程；回答时请说明这一点并询问学生在学什么）";
  const sections = (c.steps || []).map((s, i) => `步骤${i + 1}《${s.title}》：${s.body}`).join("\n");
  return `课程《${c.title}》（方向 ${c.track}）：
学习成果：${c.outcome}
${sections}
结论与局限：${c.steps?.at(-1)?.limits || "见课程页"}`;
}

export function render(route) {
  const s = S.getState();
  const ready = hasBackend() && providers().some((p) => p.configured);
  const courseId = route.id || S.continuePoint().course.id;
  const quizId = route.extra;
  const suggestions = [
    "用一句话解释这个课里最核心的机制",
    "我的实验失败了，误差一直是 3 左右，怎么办？",
    "给我一个修改任务，等我做完再检查",
    "按评分量规点评我的回答：……（粘贴回答）",
  ];
  return `
<button class="text-button back" data-page="home">← 返回首页</button>
<div class="page-heading"><div><span class="eyebrow">AI TUTOR</span><h1>AI 助教</h1><p>连接当前课程上下文的助教：公式/代码解释、逐级提示、排错与结论追问。不知道时会说不知道。</p></div></div>
<div class="experiment-info">
  <span class="pill">${ready ? `已连接 · ${providers().filter((p) => p.configured).map((p) => `${p.label}/${p.model}`).join("、")}` : "需要本地后端与密钥"}</span>
  <span>发送的内容：课程结构文本 + 你的提问。本机文件与笔记默认不发送</span>
</div>
<div class="experiment-layout">
  <section class="panel experiment-controls">
    <span class="eyebrow">01 / CONTEXT</span>
    <h2>当前上下文</h2>
    <label for="t-course">绑定课程</label>
    <select id="t-course">
      ${s.runs.length || courseId ? "" : ""}
      ${["foundation", "tokens", "attention", "sampling", "ch02", "rag", "agent", "ch01", "ch05", "space", "policy", "tensor", "vector", "autograd", "probopt", "pyexp", "ch03", "ch04", "ch08", "jailbreak", "stega", "ch10", "agent-safety", "ch11"].map((id) => {
        const c = getCourse(id);
        return c ? `<option value="${id}" ${id === courseId ? "selected" : ""}>${esc(c.title)}</option>` : "";
      }).join("")}
    </select>
    ${details("查看将发送的上下文", `<pre>${esc(courseContext(courseId).slice(0, 1200))}…</pre>`)}
    <span class="eyebrow">02 / ASK</span>
    <h2>提问</h2>
    <div class="suggestion-row">${suggestions.map((t) => `<button class="tab" data-suggest="${esc(t)}">${esc(t)}</button>`).join("")}</div>
    <label for="t-input">你的问题</label>
    <textarea id="t-input" rows="4" placeholder="把报错、你的预测或评价题回答贴进来…"></textarea>
    <div class="stack">
      ${button("发送（真实模型）", "tutor-send", "primary full")}
      ${button("清空对话", "tutor-clear", "secondary full")}
    </div>
    <p class="caption">助教输出不构成事实保证；关键结论请在实验室验证。对话仅保存在本页会话。</p>
  </section>
  <section class="panel experiment-output">
    <div class="section-title"><h2>对话与引用</h2><span class="live-label">引用可定位到课程步骤</span></div>
    <div id="output" aria-live="polite">${history.length ? historyHtml() : `<div class="output-empty">${icon("lab")}<h3>从一个问题开始。</h3>${quizId ? `<p>已带入评价题 <code>${esc(quizId)}</code> 的上下文。</p>` : ""}</div>`}</div>
  </section>
</div>`;
}

function historyHtml() {
  return history.map((h) => `
    <article class="tutor-turn ${h.role}">
      <span class="pill">${h.role === "user" ? "你" : "助教"}</span>
      <div class="tutor-body">${md(h.content)}</div>
      ${h.refs?.length ? `<div class="citation-strip">${h.refs.map((r) => pill(r, "dark")).join(" ")}</div>` : ""}
    </article>`).join("");
}

export function send(root) {
  const input = root.querySelector("#t-input");
  const text = input.value.trim();
  if (!text) return;
  const courseId = root.querySelector("#t-course").value;
  const out = root.querySelector("#output");
  history.push({ role: "user", content: text });
  out.innerHTML = historyHtml() + loading("助教思考中…");
  input.value = "";
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "system", content: `当前课程上下文：\n${courseContext(courseId)}` },
    ...history.slice(-MAX_TURNS * 2).map((h) => ({ role: h.role, content: h.content })),
  ];
  modelChat({ messages, sampling: { temperature: 0.4, maxTokens: 800 } })
    .then((res) => {
      const refs = [...res.text.matchAll(/\[(课程:[\w-]+·[^@\]]+|通用知识)\]/g)].map((m) => m[1]);
      history.push({ role: "assistant", content: res.text, refs });
      out.innerHTML = historyHtml();
      out.insertAdjacentHTML("beforeend", `<small class="muted">${res.model} · ${res.elapsedMs}ms · ${res.usage?.total_tokens ?? "?"} tokens</small>`);
    })
    .catch((error) => {
      out.innerHTML = historyHtml() + errorBox(error.message, error.code);
    });
}

export function bind(root) {
  root.querySelector('[data-action="tutor-send"]')?.addEventListener("click", () => send(root));
  root.querySelector("#t-input")?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send(root);
  });
  root.querySelector('[data-action="tutor-clear"]')?.addEventListener("click", () => {
    history = [];
    root.querySelector("#output").innerHTML = '<div class="output-empty">对话已清空。</div>';
  });
  root.querySelectorAll("[data-suggest]").forEach((b) =>
    b.addEventListener("click", () => {
      const input = root.querySelector("#t-input");
      input.value = b.dataset.suggest;
      input.focus();
    }),
  );
  root.querySelector("#t-course")?.addEventListener("change", () => rerender());
}

function rerender() {
  import("../app.js").then(({ rerender }) => rerender());
}
