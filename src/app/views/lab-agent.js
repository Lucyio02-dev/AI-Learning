// Agent 故障实验室：架构选择对照 + 工具契约 + 故障注入 + 幂等/检查点持久化。
// 中间状态与检查点写入 localStorage，刷新/重启后可安全恢复。
import * as S from "../state.js";
import { esc, icon, button, details, table, pill } from "../ui.js";
import { newAgentRun, TOOL_SPECS, validateParams, callRead, callWrite, recover, finish } from "../../labs/agent.js";
import { recordRun } from "../record.js";
import { go } from "../router.js";

const CKPT_KEY = "ai-learning-agent-checkpoint";

export function render() {
  const restored = loadCheckpoint();
  const run = restored || newAgentRun();
  return `
<button class="text-button back" data-page="labs">← 返回实验室</button>
<div class="page-heading"><div><span class="eyebrow">EXPERIMENT WORKBENCH</span><h1>Agent 故障实验室</h1><p>架构选择、工具契约与可靠恢复。中间状态与检查点已持久化。</p></div></div>
<div class="experiment-info">
  <span class="pill">确定性工具模拟器 + 检查点持久化</span>
  <span>不连接真实业务系统；工具调用语义按 OpenAPI/幂等惯例模拟</span>
  <button class="text-button" data-course="agent">补学相关原理 ↗</button>
</div>
<div class="experiment-layout">
  <section class="panel experiment-controls">
    <span class="eyebrow">01 / ARCHITECTURE</span>
    <h2>先选执行架构</h2>
    <div class="callout"><strong>任务</strong><p>“帮我预约周五下午的实验室（≤4 人）。”四种架构都可达目标，代价不同。</p></div>
    ${details("四种架构的取舍对照", table(
      ["架构", "质量", "成本/延迟", "可维护性", "适用"],
      [
        ["规则脚本", "确定性", "最低", "最好", "流程固定"],
        ["单次模型调用", "解析自然语言", "低", "好", "输入是自由文本"],
        ["工作流（分支/循环）", "可控 + 灵活", "中", "较好", "多步骤带校验"],
        ["Agent（动态决策）", "应对未知情况", "最高", "需护栏", "决策路径无法预知"],
      ],
    ))}
    <p class="caption">能用工作流就不用 Agent。本实验室以“工作流 + 写入超时”为主线演练恢复语义。</p>
    <span class="eyebrow">02 / FAULT INJECTION</span>
    <h2>注入故障并执行</h2>
    <label for="a-fault">注入故障（写入阶段）</label>
    <select id="a-fault">
      <option value="timeout_write" selected>写入超时（结果未知）</option>
      <option value="permission">权限不足</option>
      <option value="none">无故障（正常路径）</option>
    </select>
    <label for="a-strategy">恢复策略</label>
    <select id="a-strategy">
      <option value="verify" selected>先按 request_id 核验再决定</option>
      <option value="retry">原样重试写入</option>
    </select>
    <div class="stack">
      ${button("启动任务（工作流执行）", "agent-start", "primary full")}
      ${button("按策略恢复", "agent-recover", "secondary full")}
      ${button("目标核验并收尾", "agent-finish", "secondary full")}
      ${button("补偿：取消错误预约", "agent-compensate", "secondary full")}
    </div>
    <span class="eyebrow">03 / TOOLS</span>
    <h2>工具契约</h2>
    ${details("查看工具 schema", table(
      ["工具", "副作用", "幂等", "关键参数"],
      Object.values(TOOL_SPECS).map((t) => [
        esc(t.name),
        t.sideEffect === "write" ? pill("写入", "") : pill("只读", "success"),
        t.name === "book_lab" ? "request_id" : "—",
        esc(Object.entries(t.schema).map(([k, r]) => `${k}${r.required ? "*" : ""}:${r.type}`).join(", ")),
      ]),
    ))}
    <p class="caption">参数校验与权限校验在调用前执行；非法参数不会到达“服务端”。</p>
  </section>
  <section class="panel experiment-output">
    <div class="section-title"><h2>执行轨迹与证据</h2><span class="live-label">输入 · 决策说明 · 工具参数/返回 · 核验</span></div>
    <div id="output" aria-live="polite">${restored ? checkpointBanner(restored) : `<div class="output-empty">${icon("lab")}<h3>启动任务开始演练。</h3><p>轨迹、检查点与写入次数会在这里展示；刷新页面后可从检查点恢复。</p></div>`}</div>
    ${restored ? '<button class="secondary" data-action="agent-resume">从检查点恢复运行</button><button class="text-button" data-action="agent-discard">丢弃检查点</button>' : ""}
  </section>
</div>
<div class="panel history" id="agent-runs">${runsHistory()}</div>`;
}

function checkpointBanner(run) {
  return `<div class="callout warn"><strong>发现未完成检查点（${esc(run.checkpoint?.savedAt || "")}）</strong><p>阶段：${esc(run.checkpoint?.stage || "")} · request_id 前缀：${esc(String(run.checkpoint?.requestId || "").slice(0, 4))}…</p><p>恢复前必须核验服务端实际状态，不能直接重放写入。</p></div>${traceHtml(run)}`;
}

function runsHistory() {
  const runs = S.getState().runs.filter((r) => r.lab === "agent").slice(-8).reverse();
  if (!runs.length) return "<h2>本实验的运行记录</h2><p class='muted'>还没有记录。</p>";
  return `<h2>本实验的运行记录</h2>${runs.map((r) => details(
    `<span class="pill ${r.passed ? "success" : ""}">${r.passed ? "通过（writes=1）" : "失败/重复"}</span> ${esc(r.summary || "")}`,
    `<pre>${esc(typeof r.evidence === "string" ? r.evidence : JSON.stringify(r.evidence, null, 2))}</pre>`,
  )).join("")}`;
}

// ---------- 检查点持久化 ----------
function saveCheckpoint(run) {
  try {
    localStorage.setItem(CKPT_KEY, JSON.stringify({ run, savedAt: new Date().toISOString() }));
  } catch {}
}
export function loadCheckpoint() {
  try {
    const raw = localStorage.getItem(CKPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.run?.phase && !parsed.run.done ? parsed.run : null;
  } catch {
    return null;
  }
}
function clearCheckpoint() {
  localStorage.removeItem(CKPT_KEY);
}

// ---------- 执行 ----------
let activeRun = null;

function ensureRun(root) {
  if (!activeRun) activeRun = loadCheckpoint() || newAgentRun();
  return activeRun;
}

function traceHtml(run) {
  const rows = run.trace.map((t) => {
    const kindLabel = {
      read: "工具读取", "read-error": "读取失败", write: "写入成功",
      "write-unknown": "写入超时（结果未知）", "write-error": "写入失败",
      rejected: "校验拒绝", verify: "状态核验", finish: "目标核验",
    }[t.kind] || t.kind;
    const detail = t.error
      ? `<span class="error-inline">${esc(t.error)}</span>`
      : t.result
        ? `<code>${esc(JSON.stringify(t.result).slice(0, 120))}</code>`
        : t.errors
          ? `<code>${esc(JSON.stringify(t.errors))}</code>`
          : esc(t.note || "");
    return `<tr><td>t${t.t}</td><td>${esc(kindLabel)}</td><td><code>${esc(t.tool || "")}</code><small class="muted">${esc(JSON.stringify(t.masked || t.params || {}))}</small></td><td>${detail}</td></tr>`;
  }).join("");
  return `<h3>执行轨迹（敏感字段已脱敏）</h3>${table(["时间", "阶段", "工具与参数", "返回/错误"], rows)}
  <div class="metric-strip">
    <div><span>写入次数</span><strong>${run.writes}</strong></div>
    <div><span>读取次数</span><strong>${run.reads}</strong></div>
    <div><span>预约记录</span><strong>${run.world.bookings.length}</strong></div>
    <div><span>阶段</span><strong>${esc(run.phase)}</strong></div>
  </div>`;
}

function renderRun(root, run) {
  const out = root.querySelector("#output");
  const interrupt = run.phase === "interrupted";
  out.innerHTML = `
    <div class="callout"><strong>决策说明（非模型内部思维）</strong><p>策略选择：${esc(root.querySelector("#a-strategy")?.value || "")}。${interrupt ? "写入超时后客户端无法确定服务端状态——这是“结果未知”，不是“失败”。" : run.done ? `目标核验：${run.world.bookings.length} 条预约，${run.passed ? "恰好一条有效，通过。" : "存在重复或未达成。"}` : "按工具契约继续。"}</p></div>
    ${traceHtml(run)}
    ${run.checkpoint && interrupt ? `<div class="callout warn"><strong>检查点已保存</strong><p>刷新页面后可从检查点恢复；恢复时先核验，再决定是否重写。</p></div>` : ""}
    ${run.done ? `<div class="feedback ${run.passed ? "pass" : ""}"><strong>${run.passed ? "任务完成：一次写入，一条有效预约" : "任务终止：目标未达成"}</strong><p>${run.failure || "已核验服务端事实与用户目标，不只看工具状态码。"}</p></div>` : ""}`;
  // 按钮可用性
  const startBtn = root.querySelector('[data-action="agent-start"]');
  const recoverBtn = root.querySelector('[data-action="agent-recover"]');
  const finishBtn = root.querySelector('[data-action="agent-finish"]');
  if (startBtn) startBtn.textContent = run.done ? "重置并重新启动" : "启动任务（工作流执行）";
  if (recoverBtn) recoverBtn.disabled = run.done;
  if (finishBtn) finishBtn.disabled = run.done;
}

export function start(root) {
  const fault = root.querySelector("#a-fault")?.value || "timeout_write";
  const run = newAgentRun();
  activeRun = run;
  // 工作流：查询（读）→ 写入（可能注入故障）
  callRead(run, "query_slots", { day: "friday" });
  const permissionDenied = fault === "permission";
  if (permissionDenied) {
    callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 }, "permission");
    run.done = true;
    run.passed = false;
    run.failure = "权限不足：写入被拒绝。检查工具权限模型，不要静默降级。";
  } else {
    callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 }, fault === "timeout_write" ? "timeout_write" : null);
  }
  if (!run.done) saveCheckpoint(run);
  renderRun(root, run);
  if (run.done) finalize(root, run);
}

export function recoverStep(root) {
  const run = ensureRun(root);
  const strategy = root.querySelector("#a-strategy")?.value || "verify";
  if (run.done) {
    renderRun(root, run);
    return;
  }
  if (strategy === "retry") {
    // 原样重试：写入第二次（幂等键相同 → 服务端去重，但客户端不知道）
    callWrite(run, "book_lab", { slot: "friday-14", capacity: 2 });
    run.retries.push("retry-write");
  } else {
    recover(run);
  }
  if (run.phase === "verified" && run.recoveredStatus === "confirmed") {
    run.done = true;
  }
  saveCheckpoint(run);
  renderRun(root, run);
  if (run.done) finalize(root, run);
}

export function finishStep(root) {
  const run = ensureRun(root);
  finish(run);
  clearCheckpoint();
  renderRun(root, run);
  finalize(root, run);
}

export function compensate(root) {
  const run = ensureRun(root);
  const booking = run.world.bookings.at(-1);
  if (run.done && run.passed) {
    renderRun(root, run);
    import("../ui.js").then(({ toast }) => toast("没有需要补偿的预约。"));
    return;
  }
  if (booking) {
    callWrite(run, "cancel_booking", { booking_id: booking.id });
    run.trace.push({ t: run.world.clock, kind: "finish", tool: "cancel_booking", note: "补偿流程：已取消错误预约" });
  }
  renderRun(root, run);
}

function finalize(root, run) {
  recordRun({
    lab: "agent",
    mode: "rule",
    summary: run.passed ? `核验后恢复：写入 ${run.writes} 次，预约 1 条` : `失败终止：${run.failure}`,
    passed: run.passed,
    evidence: { trace: run.trace.map(({ t, kind, tool, masked, error, result, note }) => ({ t, kind, tool, masked, error, result, note })), writes: run.writes, bookings: run.world.bookings.length, strategy: root.querySelector("#a-strategy")?.value, fault: root.querySelector("#a-fault")?.value },
    config: { fault: root.querySelector("#a-fault")?.value, strategy: root.querySelector("#a-strategy")?.value },
    statuses: { diagnosed: !!run.failure || run.passed, verified: run.passed },
  });
  refreshHistory(root);
}

function refreshHistory(root) {
  const el = root.querySelector("#agent-runs");
  if (el) el.innerHTML = runsHistory();
}

export function bind(root) {
  root.querySelector('[data-action="agent-start"]')?.addEventListener("click", () => start(root));
  root.querySelector('[data-action="agent-recover"]')?.addEventListener("click", () => recoverStep(root));
  root.querySelector('[data-action="agent-finish"]')?.addEventListener("click", () => finishStep(root));
  root.querySelector('[data-action="agent-compensate"]')?.addEventListener("click", () => compensate(root));
  root.querySelector('[data-action="agent-resume"]')?.addEventListener("click", () => {
    activeRun = loadCheckpoint();
    if (activeRun) renderRun(root, activeRun);
  });
  root.querySelector('[data-action="agent-discard"]')?.addEventListener("click", () => {
    clearCheckpoint();
    activeRun = null;
    render();
    import("../app.js").then(({ rerender }) => rerender());
  });
  root.querySelector('[data-course="agent"]')?.addEventListener("click", () => go("course", "agent", "0"));
}
