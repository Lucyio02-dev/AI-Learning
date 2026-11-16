// Prompt 实验室：规则演示（入门）+ 真实模型对照。
// 版本化变体、单变量差异、批量运行、多次采样、结构校验、失败样例保留。
import * as S from "../state.js";
import { esc, icon, button, details, table, loading, errorBox, pill } from "../ui.js";
import { hasBackend, modelChat, providers } from "../api.js";
import { promptDemo, buildVariants, checkJson } from "../../labs/prompt.js";
import { evalSet as promptEvalSet } from "../../labs/term.js";
import { recordRun } from "../record.js";

// 内置任务：退选截止时间（事实缺失/补齐/格式/冲突四变体）
const TASK = {
  question: "本学期退选课程的截止时间是什么时候？",
  material: "当前学期选课指南：退选截止时间为开课后第一周周五 17:00。",
};

export function render() {
  const hasModel = hasBackend() && providers().some((p) => p.configured);
  return `
<button class="text-button back" data-page="labs">← 返回实验室</button>
<div class="page-heading"><div><span class="eyebrow">EXPERIMENT WORKBENCH</span><h1>Prompt 对照实验室</h1><p>先判断缺的是什么，再改输入。规则演示入门，真实模型验证。</p></div></div>
<div class="experiment-info">
  <span class="pill">${hasModel ? "真实模型已就绪" : "规则模式（完整模式未就绪）"}</span>
  <span>规则演示不调用模型；真实模式经本地后端代理，密钥不出服务器</span>
  <button class="text-button" data-course="ch02">补学相关原理 ↗</button>
</div>
<div class="experiment-layout">
  <section class="panel experiment-controls">
    <span class="eyebrow">01 / CONFIGURE</span>
    <h2>同一个问题，改变输入</h2>
    <div class="callout"><strong>任务</strong><p>${esc(TASK.question)}</p><label for="p-material">事实材料（可为空 = 证据缺失）</label><textarea id="p-material" rows="2">${esc(TASK.material)}</textarea></div>
    <div class="control-pair">
      <label class="check-row"><input id="p-evidence" type="checkbox">补充事实材料到上下文</label>
      <label class="check-row"><input id="p-format" type="checkbox">要求 JSON 输出</label>
      <label class="check-row"><input id="p-conflict" type="checkbox">加入互相冲突的输出要求</label>
    </div>
    <label for="p-predict">预测：当前最需要解决什么？</label>
    <select id="p-predict">
      <option value="evidence">缺少事实证据</option>
      <option value="conflict">指令冲突</option>
      <option value="ready">证据已具备，核验输出</option>
    </select>
    <div class="stack">
      ${button("运行规则演示", "run-prompt-rule", "primary full")}
      ${hasModel
        ? `${button("真实模型对照（4 变体 × 2 样例）", "run-prompt-real", "secondary full")}
           ${button("批量评测（5 题 × 当前配置）", "run-prompt-eval", "secondary full")}`
        : `<p class="caption">真实模型对照需要本地后端与密钥：npm run server 后刷新本页。规则演示先用于理解变量。</p>`}
    </div>
    <label for="p-provider">模型（真实模式）</label>
    <select id="p-provider">${providers().filter((p) => p.configured).map((p) => `<option value="${p.id}">${p.label} · ${p.model}</option>`).join("") || "<option value=\"\">不可用</option>"}</select>
    <label class="check-row"><input id="p-jsoncheck" type="checkbox" checked>自动校验 JSON 结构</label>
    <p class="caption">这是固定规则示例与真实调用并列的教学环境；单次输出更好不构成结论，请用批量与未见样例。</p>
  </section>
  <section class="panel experiment-output">
    <div class="section-title"><h2>观察与证据</h2><span class="live-label">输入 · 实际请求 · 输出全部可查看</span></div>
    <div id="output" aria-live="polite"><div class="output-empty">${icon("lab")}<h3>先做预测，再运行实验。</h3><p>运行后，这里会展示变体、请求、输出、校验与对照。</p></div></div>
  </section>
</div>
<div class="panel history" id="prompt-runs">${runsHistory()}</div>`;
}

function runsHistory() {
  const runs = S.getState().runs.filter((r) => r.lab === "prompt").slice(-8).reverse();
  if (!runs.length) return "<h2>本实验的运行记录</h2><p class='muted'>还没有记录。第一次运行会出现在这里。</p>";
  return `<h2>本实验的运行记录</h2>${runs.map((r) => details(
    `<span class="pill ${r.passed ? "success" : ""}">${r.passed ? "通过" : "保留"}</span> ${esc(r.summary || "")} <small class="muted">${esc(r.time.slice(0, 16).replace("T", " "))}</small>`,
    `<pre>${esc(typeof r.evidence === "string" ? r.evidence : JSON.stringify(r.evidence, null, 2))}</pre>`,
  )).join("")}`;
}

// ---------- 规则演示 ----------
export function runRule(root) {
  const options = {
    evidence: root.querySelector("#p-evidence").checked,
    format: root.querySelector("#p-format").checked,
    conflict: root.querySelector("#p-conflict").checked,
  };
  const material = root.querySelector("#p-material").value.trim() || TASK.material;
  const r = promptDemo(options);
  const passed = root.querySelector("#p-predict").value === r.diagnosis;
  setOutput(root, `
    <span class="pill">规则演示结果</span>
    <pre>${esc(r.answer)}</pre>
    <h3>${passed ? "预测与现象一致" : "对比你的预测"}</h3>
    <p>${esc(r.reason)}</p>
    <div class="callout">规则演示展示变量之间的逻辑关系；真实模型行为请在下方运行对照。</div>`);
  recordRun({
    lab: "prompt", mode: "rule", summary: passed ? "正确识别输入中的关键问题" : "保留了一次输入对照",
    passed,
    evidence: { kind: "rule-demo", options, ...r },
    statuses: { diagnosed: passed, verified: false },
    config: { options, materialUsed: !!options.evidence },
  });
  refreshHistory(root);
}

// ---------- 真实模型对照 ----------
export async function runReal(root) {
  const out = root.querySelector("#output");
  out.innerHTML = loading("正在调用真实模型（4 个变体 × 2 次采样）…");
  const evidence = root.querySelector("#p-evidence").checked;
  const format = root.querySelector("#p-format").checked;
  const conflict = root.querySelector("#p-conflict").checked;
  const material = root.querySelector("#p-material").value.trim() || TASK.material;
  const provider = root.querySelector("#p-provider").value || undefined;
  const doJson = root.querySelector("#p-jsoncheck").checked;

  // 变体构造：单变量差异
  const variants = [];
  variants.push({ id: "A-无证据", diff: "无", messages: [{ role: "user", content: `任务：${TASK.question}\n请回答。` }] });
  if (evidence)
    variants.push({ id: "B-补充证据", diff: "+事实材料", messages: [{ role: "user", content: `以下是学校规定：${material}\n\n任务：${TASK.question}\n只使用给出的规定作答，并注明来源。若规定未覆盖问题，回答“资料未覆盖”。` }] });
  if (format && evidence)
    variants.push({ id: "C-证据+JSON", diff: "+格式要求", messages: [{ role: "user", content: `以下是学校规定：${material}\n\n任务：${TASK.question}\n只使用给出的规定作答。输出 JSON：{"deadline": string|null, "source": string}` }] });
  if (conflict)
    variants.push({ id: "D-冲突指令", diff: "+格式冲突", messages: [{ role: "user", content: `以下是学校规定：${material}\n\n任务：${TASK.question}\n只返回 JSON。\n同时：只返回一段自然语言，不要 JSON。` }] });
  if (variants.length === 1)
    variants.push({ id: "A2-仅格式", diff: "+格式要求（仍无证据）", messages: [{ role: "user", content: `任务：${TASK.question}\n输出 JSON：{"deadline": string|null, "source": string}` }] });

  const samples = 2;
  const temperature = 0.7;
  const results = [];
  try {
    for (const v of variants) {
      for (let i = 0; i < samples; i++) {
        const res = await modelChat({ messages: v.messages, sampling: { temperature, maxTokens: 200 }, provider, seed: 100 + i });
        results.push({ variant: v.id, diff: v.diff, request: v.messages[0].content, sample: i + 1, ...res });
      }
    }
  } catch (error) {
    out.innerHTML = errorBox(error.message, error.code);
    recordRun({ lab: "prompt", mode: "model", summary: `真实调用失败：${error.message}`, passed: false, evidence: { error: error.message, code: error.code } });
    refreshHistory(root);
    return;
  }
  const rows = results.map((r) => {
    const jsonCheck = doJson && /JSON/.test(r.request) ? checkJson(r.text) : null;
    return `<tr>
      <td><strong>${esc(r.variant)}</strong><small class="muted">${esc(r.diff)}</small></td>
      <td><small>样例 ${r.sample}</small></td>
      <td class="pre-cell">${esc(r.text.slice(0, 220))}</td>
      <td>${jsonCheck ? (jsonCheck.valid ? pill("JSON 合法", "success") : pill(`JSON 缺字段 ${jsonCheck.missing.join(",")}`, "")) : pill(`tok ${r.usage?.completion_tokens ?? "?"}`)}</td>
      <td><small class="muted">${r.elapsedMs}ms · ${r.model}</small></td>
    </tr>`;
  });
  const jsonFailures = results.filter((r) => doJson && /JSON/.test(r.request) && !checkJson(r.text).valid);
  setOutput(root, `
    <h3>对照结果（温度 ${temperature} × ${samples} 次采样）</h3>
    ${table(["变体", "采样", "模型输出", "结构校验", "用量"], rows)}
    <div class="callout"><strong>读表指南</strong>
      <ul>
        <li>无证据的变体：模型要么编一个日期，要么说不知道——同一变体两次输出是否一致？</li>
        <li>补充证据后：回答是否与材料一致？来源是否被注明？</li>
        <li>冲突指令：JSON 校验失败的样例就是冲突的代价。</li>
      </ul>
    </div>
    ${jsonFailures.length ? `<div class="feedback"><strong>保留失败样例（${jsonFailures.length} 条）</strong><pre>${esc(jsonFailures.map((f) => `[${f.variant}#${f.sample}] ${f.text.slice(0, 150)}`).join("\n"))}</pre></div>` : ""}
    <details class="fold"><summary>查看完整请求与响应</summary><div class="fold-body"><pre>${esc(JSON.stringify(results.map(({ request, text, sampling, model, usage, elapsedMs }) => ({ request, text, sampling, model, usage, elapsedMs })), null, 2))}</pre></div></details>`);
  const allTexts = results.map((r) => r.text).join(" ");
  recordRun({
    lab: "prompt", mode: "model",
    summary: `真实对照：${variants.length} 变体 × ${samples} 采样${jsonFailures.length ? `，${jsonFailures.length} 条格式失败` : ""}`,
    passed: null, evidence: { provider, temperature, samples, variants: variants.map((v) => v.id), results: results.map(({ variant, sample, text, usage, elapsedMs }) => ({ variant, sample, text, usage, elapsedMs })) },
    config: { provider, temperature, samples },
    metrics: { jsonFailures: jsonFailures.length },
  });
  refreshHistory(root);
}

// ---------- 批量评测（含未见样例） ----------
export async function runEval(root) {
  const out = root.querySelector("#output");
  out.innerHTML = loading("正在批量评测（含未见样例）…");
  const evidence = root.querySelector("#p-evidence").checked;
  const material = root.querySelector("#p-material").value.trim() || TASK.material;
  const provider = root.querySelector("#p-provider").value || undefined;
  const prompt = (q) =>
    evidence
      ? `以下是学校规定：${material}\n\n任务：${q}\n只使用给出的规定作答，并注明来源。若规定未覆盖问题，回答“资料未覆盖”。`
      : `任务：${q}\n请回答。`;
  const results = [];
  try {
    for (const item of promptEvalSet) {
      const res = await modelChat({ messages: [{ role: "user", content: prompt(item.question) }], sampling: { temperature: 0, maxTokens: 200 }, provider });
      const refused = /资料未覆盖|无法确定|没有找到/.test(res.text);
      const ok = item.expect
        ? res.text.includes(item.expect.split(/[\s，、]/)[0])
        : refused;
      results.push({ ...item, text: res.text, ok, unseen: item.unseen, usage: res.usage });
    }
  } catch (error) {
    out.innerHTML = errorBox(error.message, error.code);
    return;
  }
  const seen = results.filter((r) => !r.unseen);
  const unseen = results.filter((r) => r.unseen);
  const rate = (arr) => (arr.length ? Math.round((arr.filter((r) => r.ok).length / arr.length) * 100) : 0);
  setOutput(root, `
    <h3>批量评测：调试样例 vs 未见样例</h3>
    ${table(["问题", "类型", "判定", "输出摘要"], results.map((r) => `<tr><td>${esc(r.question)}</td><td>${r.unseen ? pill("未见", "dark") : pill("调试")}</td><td>${r.ok ? pill("通过", "success") : pill("未通过")}</td><td class="pre-cell">${esc(r.text.slice(0, 120))}</td></tr>`))}
    <div class="metric-strip">
      <div><span>调试样例通过率</span><strong>${rate(seen)}%</strong></div>
      <div><span>未见样例通过率</span><strong>${rate(unseen)}%</strong></div>
    </div>
    <div class="callout"><strong>结论纪律</strong><p>只在调试样例上变好不算提升——比较两列通过率，差距大说明 Prompt 过拟合了调试样例。失败样例已保留在运行记录。</p></div>`);
  recordRun({
    lab: "prompt", mode: "model",
    summary: `批量评测：调试 ${rate(seen)}% / 未见 ${rate(unseen)}%`,
    passed: rate(seen) >= 60 && rate(unseen) >= 60,
    evidence: { results: results.map(({ question, text, ok, unseen }) => ({ question, text: text.slice(0, 300), ok, unseen })) },
    config: { provider, evidence, temperature: 0 },
    metrics: { seenRate: rate(seen), unseenRate: rate(unseen) },
    statuses: { diagnosed: rate(unseen) >= 60, verified: rate(unseen) >= 60 },
  });
  refreshHistory(root);
}

function setOutput(root, html) {
  root.querySelector("#output").innerHTML = html;
}
function refreshHistory(root) {
  const el = root.querySelector("#prompt-runs");
  if (el) el.innerHTML = runsHistory();
}

export function bind(root) {
  root.querySelector('[data-action="run-prompt-rule"]')?.addEventListener("click", () => runRule(root));
  root.querySelector('[data-action="run-prompt-real"]')?.addEventListener("click", () => runReal(root));
  root.querySelector('[data-action="run-prompt-eval"]')?.addEventListener("click", () => runEval(root));
  root.querySelector('[data-course="ch02"]')?.addEventListener("click", () => go("course", "ch02", "0"));
}
import { go } from "../router.js";
