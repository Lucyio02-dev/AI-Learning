// 具身实验室：参考系/执行误差诊断（浏览器）+ 故障注入 + 轨迹回放 +
// 真实 Python 仿真/训练任务（本地后端任务执行器）。
import * as S from "../state.js";
import { esc, icon, button, details, table, loading, errorBox, pill } from "../ui.js";
import { hasBackend, createTask, waitForTask, taskDetail, listTasks } from "../api.js";
import { runEpisode, FAULTS, faultProfiles, motion, rng } from "../../labs/kinematics.js";
import { trainQLearning, qGridSvg, GRID } from "../../labs/qlearning.js";
import { recordRun } from "../record.js";
import { go } from "../router.js";

export function render() {
  const ready = hasBackend();
  return `
<button class="text-button back" data-page="labs">← 返回实验室</button>
<div class="page-heading"><div><span class="eyebrow">EXPERIMENT WORKBENCH</span><h1>空间与动作实验室</h1><p>转动参考系，观察执行轨迹。二维数学正确不等于整个具身模块。</p></div></div>
<div class="experiment-info">
  <span class="pill">二维运动学 + 故障注入 + 轨迹回放${ready ? " + 本地仿真/BC 训练" : ""}</span>
  <span>无动力学与三维姿态；不代表真实设备安全性</span>
  <button class="text-button" data-course="space">补学相关原理 ↗</button>
</div>
<div class="experiment-layout">
  <section class="panel experiment-controls">
    <span class="eyebrow">01 / TRANSFORM</span>
    <h2>世界里的目标，机体里的动作</h2>
    <p>机器人在原点，目标在世界坐标 (3, 2)。动作接口接收机体坐标位移。</p>
    <label for="m-angle">机器人朝向（度）</label>
    <input id="m-angle" type="range" min="0" max="180" step="15" value="90">
    <output id="angle-value">90°</output>
    <label class="check-row"><input id="m-correct" type="checkbox">先把世界位移转换到机体坐标</label>
    <label for="m-predict">预测：需要先修复什么？</label>
    <select id="m-predict">
      <option value="frame">坐标转换</option>
      <option value="verify">转换已启用，检查实际误差</option>
    </select>
    ${button("执行并查看轨迹", "run-motion", "primary full")}
    <span class="eyebrow">02 / EPISODE</span>
    <h2>多步闭环与故障</h2>
    <label for="m-fault">注入故障</label>
    <select id="m-fault">${Object.entries(FAULTS).map(([k, v]) => `<option value="${k}" ${k === "none" ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
    <div class="control-pair">
      <div><label for="m-noise">执行噪声</label><select id="m-noise"><option>0</option><option selected>0.02</option><option>0.08</option><option>0.2</option></select></div>
      <div><label for="m-seed">随机种子</label><input id="m-seed" type="number" value="7" min="1"></div>
    </div>
    ${button("运行闭环 episode", "run-episode", "secondary full")}
    ${button("生成全部故障的特征对照表", "run-profiles", "secondary full")}
    <span class="eyebrow">04 / RL BASICS</span>
    <h2>强化学习基础：表格型 Q-learning</h2>
    <p>5×5 网格、10% 执行噪声：观察奖励驱动的策略如何收敛，与模仿学习（BC）对比。</p>
    <div class="control-pair">
      <div><label for="q-eps">探索率 ε</label><select id="q-eps"><option>0</option><option selected>0.2</option><option>0.5</option></select></div>
      <div><label for="q-eps2">训练轮数</label><select id="q-eps2"><option>100</option><option selected>300</option><option>800</option></select></div>
    </div>
    ${button("训练 Q-learning 并查看策略", "run-qlearn", "secondary full")}
    <span class="eyebrow">03 / REAL RUN</span>
    <h2>本地仿真与 BC 训练${ready ? "" : "（需后端）"}</h2>
    <div class="stack">
      ${ready
        ? `${button("采集专家轨迹（100 条）", "emb-collect", "secondary full")}
           ${button("训练 BC 策略（CPU，约 2 秒）", "emb-train", "secondary full")}
           ${button("闭环评测（训练分布 / 新分布）", "emb-eval", "secondary full")}`
        : `<p class="caption">启动本地后端（npm run server）后，可在此真实运行采集/训练/评测；产物与日志在服务端归档。</p>`}
    </div>
    <div id="emb-task-status" aria-live="polite"></div>
  </section>
  <section class="panel experiment-output">
    <div class="section-title"><h2>观察与证据</h2><span class="live-label">同一时间轴：观察 / 状态 / 指令 / 动作 / 误差</span></div>
    <div id="output" aria-live="polite"><div class="output-empty">${icon("lab")}<h3>先预测，再执行。</h3><p>轨迹图与逐帧时间轴会在这里展示。</p></div></div>
    <div id="replay-panel"></div>
  </section>
</div>
<div class="panel history" id="emb-runs">${runsHistory()}</div>`;
}

function runsHistory() {
  const runs = S.getState().runs.filter((r) => r.lab === "embodied").slice(-8).reverse();
  if (!runs.length) return "<h2>本实验的运行记录</h2><p class='muted'>还没有记录。</p>";
  return `<h2>本实验的运行记录</h2>${runs.map((r) => details(
    `<span class="pill ${r.passed ? "success" : ""}">${r.passed ? "通过" : "记录"}</span> ${esc(r.summary || "")}`,
    `<pre>${esc(typeof r.evidence === "string" ? r.evidence : JSON.stringify(r.evidence, null, 2))}</pre>`,
  )).join("")}`;
}

// ---------- 单步演示（兼容课程页） ----------
export function runMotion(root) {
  const angle = Number(root.querySelector("#m-angle").value);
  const correct = root.querySelector("#m-correct").checked;
  const r = motion(angle, correct);
  const predict = root.querySelector("#m-predict").value;
  const passed = correct && r.error < 0.01 && predict === "verify";
  const sx = (x) => 220 + x * 32, sy = (y) => 190 - y * 32;
  root.querySelector("#output").innerHTML = `
    <svg class="motion-plot" viewBox="0 0 440 380" role="img" aria-label="目标与实际位置轨迹，误差 ${r.error.toFixed(2)}">
      <defs><pattern id="grid" width="55" height="55" patternUnits="userSpaceOnUse"><path d="M55 0H0V55" fill="none" stroke="#e0e6e2"/></pattern></defs>
      <rect width="440" height="380" fill="url(#grid)"/>
      <path d="M220 20V350M30 190H410" stroke="#7b8c85" fill="none"/>
      <path d="M220 190L${sx(r.actual.x)} ${sy(r.actual.y)}" stroke="#397b68" stroke-width="3" stroke-dasharray="7 5"/>
      <circle cx="${sx(r.target.x)}" cy="${sy(r.target.y)}" r="9" fill="#ce8b42"/>
      <circle cx="${sx(r.actual.x)}" cy="${sy(r.actual.y)}" r="6" fill="#205947"/>
      <circle cx="220" cy="190" r="8" fill="#203e35"/>
      <text x="230" y="215">起点 (0,0)</text>
      <text x="${sx(3) + 12}" y="${sy(2) - 12}">目标 (3,2)</text>
      <text x="375" y="215">世界 x</text>
    </svg>
    <div class="metric-strip">
      <div><span>机体动作</span><strong>(${r.body.x.toFixed(2)}, ${r.body.y.toFixed(2)})</strong></div>
      <div><span>实际位置</span><strong>(${r.actual.x.toFixed(2)}, ${r.actual.y.toFixed(2)})</strong></div>
      <div><span>位置误差</span><strong>${r.error.toFixed(3)}</strong></div>
    </div>
    <div class="feedback ${passed ? "pass" : ""}"><strong>${passed ? "变换与验证通过" : "观察参考系与误差"}</strong><p>${correct ? "世界位移已先转换为机体动作，再由执行系统旋转回世界坐标。" : "世界位移被当成机体位移执行，朝向非零时偏离目标。朝向为零的成功不能证明转换正确——多朝向验证。"}</p></div>`;
  recordRun({
    lab: "embodied", mode: "rule",
    summary: passed ? "正确转换坐标并核验误差" : "观察到一次坐标执行结果", passed,
    evidence: { angle, correct, body: r.body, actual: r.actual, error: r.error },
    config: { angle, correct },
    statuses: { diagnosed: passed, verified: passed },
  });
  refreshHistory(root);
}

// ---------- 多步闭环 ----------
export function runEpisodeView(root) {
  const fault = root.querySelector("#m-fault").value;
  const noise = Number(root.querySelector("#m-noise").value);
  const seed = Number(root.querySelector("#m-seed").value) || 7;
  const correct = fault !== "frame";
  const result = runEpisode({ fault, noise, seed });
  root.querySelector("#output").innerHTML = `
    <h3>闭环 episode（${esc(FAULTS[fault])}，噪声 ${noise}，种子 ${seed}）</h3>
    ${trajectorySvg(result)}
    <div class="metric-strip">
      <div><span>成功</span><strong>${result.success ? "是" : "否"}</strong></div>
      <div><span>最终误差</span><strong>${result.finalError}</strong></div>
      <div><span>步数</span><strong>${result.steps}</strong></div>
    </div>
    <div class="feedback ${result.success && fault === "none" ? "pass" : ""}"><strong>${result.success ? "收敛" : "未收敛"} · 故障特征</strong><p>${faultSignature(fault, result)}</p></div>
    <div id="replay-slot">${replayControls(result)}</div>`;
  bindReplay(root.querySelector("#replay-panel"), result);
  recordRun({
    lab: "embodied", mode: "rule", summary: `闭环：${FAULTS[fault]} → ${result.success ? "收敛" : `误差 ${result.finalError}`}`,
    passed: fault === "none" && result.success,
    evidence: { fault, noise, seed, success: result.success, finalError: result.finalError, frames: result.frames },
    config: { fault, noise, seed }, metrics: { finalError: result.finalError, steps: result.steps },
    statuses: { diagnosed: fault !== "none" ? true : result.success, verified: fault === "none" && result.success },
  });
  refreshHistory(root);
}

function faultSignature(fault, r) {
  const map = {
    frame: "世界位移被当作机体位移：误差随朝向变化；0° 时侥幸成功，不能证明转换正确。",
    actionLimit: "单步位移被限幅：远离目标时步长恒为上限，需要更多步。",
    drift: "系统性漂移：即使指向正确也停不住，检查执行器标定。",
    occlusion: "遮挡期间使用旧观测：观测恢复时才修正，误差呈锯齿状。",
    timeSkew: "动作滞后一个控制周期：起步慢一拍，稳态影响小。",
    unit: "单位错误：度/弧度混用导致量纲错误。",
    none: r.success ? "无故障：在容差内收敛。" : "无故障但未收敛：检查噪声与容差设置。",
  };
  return map[fault] || "";
}

export function runQlearn(root) {
  const epsilon = Number(root.querySelector("#q-eps")?.value ?? 0.2);
  const episodes = Number(root.querySelector("#q-eps2")?.value ?? 300);
  const { qTable, history, greedyPath: path } = trainQLearning({ episodes, epsilon });
  const curve = history.map((h) => `${h.episode}集:成功率${Math.round(h.successRate * 100)}%`).join(" · ");
  root.querySelector("#output").innerHTML = `
    <h3>Q-learning 策略（ε=${epsilon}，${episodes} 轮）</h3>
    ${qGridSvg(qTable, path.path, path.reached)}
    <div class="metric-strip">
      <div><span>贪心路径到达目标</span><strong>${path.reached ? "是" : "否"}</strong></div>
      <div><span>末段成功率</span><strong>${Math.round((history.at(-1)?.successRate || 0) * 100)}%</strong></div>
      <div><span>步数</span><strong>${path.path.length}</strong></div>
    </div>
    <p class="caption">成功率曲线：${esc(curve)}</p>
    <div class="callout"><strong>与 BC 的对比</strong><p>Q-learning 用奖励试错自己学（需要探索，调 ε 观察探索-利用权衡）；BC 从专家数据模仿（没有奖励信号，受数据分布限制）。两种范式适用于不同条件。</p></div>`;
  recordRun({
    lab: "embodied", mode: "rule", summary: `Q-learning ${episodes} 轮：末段成功率 ${Math.round((history.at(-1)?.successRate || 0) * 100)}%，贪心${path.reached ? "到达" : "未到达"}目标`,
    passed: path.reached,
    evidence: { history, path: path.path, reached: path.reached, epsilon, episodes },
    config: { epsilon, episodes, grid: GRID },
    statuses: { diagnosed: false, verified: path.reached },
  });
  refreshHistory(root);
}

export function runProfiles(root) {  const profiles = faultProfiles(7);
  root.querySelector("#output").innerHTML = `
    <h3>故障特征对照（同一种子同目标）</h3>
    ${table(["故障", "成功", "最终误差", "步数", "特征"], Object.entries(profiles).map(([k, v]) => `<tr><td>${esc(FAULTS[k])}</td><td>${v.success ? "✓" : "✗"}</td><td>${v.finalError}</td><td>${v.steps}</td><td><small>${esc(v.signature)}</small></td></tr>`))}
    <div class="callout"><strong>诊断方法</strong><p>给一条失败轨迹做归因：先看误差曲线形状（限幅=阶梯、漂移=恒定偏差、遮挡=锯齿），再对照本表确认。</p></div>`;
  recordRun({
    lab: "embodied", mode: "rule", summary: "生成全部故障特征对照表", passed: true,
    evidence: profiles, config: { seed: 7 },
    statuses: { diagnosed: true, verified: false },
  });
  refreshHistory(root);
}

// ---------- 轨迹 SVG ----------
function trajectorySvg(result, frameIdx = -1) {
  const initialTarget = result.target;
  const sx = (x) => 220 + x * 40, sy = (y) => 190 - y * 40;
  const pts = result.frames.filter((f) => f.pose).map((f) => `${sx(f.pose[0])},${sy(f.pose[1])}`);
  const lastIdx = frameIdx >= 0 ? result.frames.findIndex((_, i) => i === frameIdx) : -1;
  const shown = frameIdx >= 0 ? result.frames.slice(0, lastIdx + 1).filter((f) => f.pose) : result.frames.filter((f) => f.pose);
  const shownPts = shown.map((f) => `${sx(f.pose[0])},${sy(f.pose[1])}`).join(" ");
  const cur = frameIdx >= 0 ? shown.at(-1) : result.frames.at(-1);
  const target = cur?.target || result.finalTarget || initialTarget;
  const observed = cur?.observed;
  const moved = target[0] !== initialTarget[0] || target[1] !== initialTarget[1];
  return `<svg class="motion-plot" viewBox="0 0 440 380" role="img" aria-label="轨迹图，最终误差 ${result.finalError}">
    <defs><pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e0e6e2"/></pattern></defs>
    <rect width="440" height="380" fill="url(#grid2)"/>
    <path d="M220 20V350M30 190H410" stroke="#7b8c85" fill="none"/>
    ${moved ? `<circle cx="${sx(initialTarget[0])}" cy="${sy(initialTarget[1])}" r="6" fill="#8d9a93"/><text x="${sx(initialTarget[0]) + 10}" y="${sy(initialTarget[1]) + 18}">旧目标</text>` : ""}
    <circle cx="${sx(target[0])}" cy="${sy(target[1])}" r="9" fill="#ce8b42"/>
    <text x="${sx(target[0]) + 12}" y="${sy(target[1]) - 12}">目标 (${target[0]}, ${target[1]})</text>
    ${observed && moved ? `<circle cx="${sx(observed[0])}" cy="${sy(observed[1])}" r="4" fill="#397baf"/><text x="${sx(observed[0]) + 8}" y="${sy(observed[1]) - 5}">当前观测</text>` : ""}
    ${shownPts ? `<polyline points="${shownPts}" fill="none" stroke="#397b68" stroke-width="2.5" stroke-dasharray="6 4"/>` : ""}
    ${cur ? `<circle cx="${sx(cur.pose[0])}" cy="${sy(cur.pose[1])}" r="6" fill="#205947"/>` : ""}
    <circle cx="220" cy="190" r="7" fill="#203e35"/>
    <text x="230" y="210">起点</text>
    <text x="360" y="212">世界 x</text>
  </svg>`;
}

// ---------- 轨迹回放 ----------
function replayControls(result) {
  return `<div class="replay-controls" data-replay>
    <button class="icon-button" data-action="replay-play" aria-label="播放">${icon("play")}</button>
    <button class="icon-button" data-action="replay-step" aria-label="单步">步 ▸</button>
    <input type="range" min="0" max="${result.frames.length - 1}" value="0" aria-label="帧选择" data-replay-range>
    <output data-replay-frame>帧 0</output>
  </div>`;
}

function bindReplay(panel, result) {
  if (!panel) return;
  const slot = panel.querySelector("[data-replay]") || document.querySelector("#replay-slot [data-replay]");
  if (!slot) return;
  let idx = 0;
  const range = slot.querySelector("[data-replay-range]");
  const frameOut = slot.querySelector("[data-replay-frame]");
  const frameTable = (i) => {
    const f = result.frames[i];
    return `<table class="frame-table"><tbody>
      <tr><th>时间</th><td>t=${f.t} (${f.dt}s)</td></tr>
      <tr><th>真实目标</th><td>${JSON.stringify(f.target || result.target)}</td></tr>
      <tr><th>观察</th><td>目标 ${JSON.stringify(f.observed)}${f.note ? ` · ${esc(f.note)}` : ""}</td></tr>
      <tr><th>状态</th><td>位姿 (${f.pose.map((x) => (typeof x === "number" ? +x.toFixed(2) : x)).join(", ")})</td></tr>
      <tr><th>指令(机体系)</th><td>${JSON.stringify(f.planned || f.action || null)}</td></tr>
      <tr><th>实际动作</th><td>${JSON.stringify(f.action)}</td></tr>
      <tr><th>误差</th><td>${f.error ?? "—"}</td></tr>
    </tbody></table>`;
  };
  const draw = () => {
    const svgHost = slot.closest(".experiment-output")?.querySelector(".motion-plot");
    if (svgHost) {
      const tmp = document.createElement("div");
      tmp.innerHTML = trajectorySvg(result, idx);
      svgHost.replaceWith(tmp.querySelector(".motion-plot"));
    }
    frameOut.textContent = `帧 ${idx}`;
    const info = document.querySelector("#replay-frame-info");
    if (info) info.innerHTML = frameTable(idx);
  };
  slot.querySelector('[data-action="replay-play"]')?.addEventListener("click", () => {
    clearInterval(slot.timer);
    slot.timer = setInterval(() => {
      idx = (idx + 1) % result.frames.length;
      range.value = idx;
      draw();
    }, 400);
  });
  slot.querySelector('[data-action="replay-step"]')?.addEventListener("click", () => {
    clearInterval(slot.timer);
    idx = Math.min(result.frames.length - 1, idx + 1);
    range.value = idx;
    draw();
  });
  range?.addEventListener("input", () => {
    clearInterval(slot.timer);
    idx = Number(range.value);
    draw();
  });
  document.querySelector("#output").insertAdjacentHTML(
    "beforeend",
    `<h3>帧数据（同一时间轴）</h3><div id="replay-frame-info">${frameTable(0)}</div>`,
  );
}

// ---------- 真实任务（后端） ----------
async function launchTask(root, { script, args, label, after }) {
  const status = root.querySelector("#emb-task-status");
  const out = root.querySelector("#output");
  try {
    status.innerHTML = loading(`提交任务：${label}…`);
    const task = await createTask({ script, args, label, config: { label } });
    status.innerHTML = `<small class="muted">任务 ${task.id.slice(0, 8)} 已排队</small>`;
    const finished = await waitForTask(task.id, { onUpdate: (t) => (status.innerHTML = loading(`${label} · ${t.status}`)) });
    if (finished.status !== "succeeded") {
      status.innerHTML = errorBox(`${label}未完成（${finished.status}），查看任务日志确认原因。`, "E_TASK_FAILED");
      recordRun({
        lab: "embodied", mode: "train", summary: `${label}失败（${finished.status}）`, passed: false,
        evidence: { taskId: finished.id, status: finished.status, exitCode: finished.exitCode, log: (finished.log || "").slice(-2000) },
        statuses: { diagnosed: false, verified: false },
      });
      refreshHistory(root);
      return;
    }
    status.innerHTML = `<small>${pill(finished.status === "succeeded" ? "完成" : finished.status, finished.status === "succeeded" ? "success" : "")} ${label} · ${finished.elapsedMs ?? 0}ms</small> ${details("查看日志", `<pre>${esc((finished.log || "").slice(-4000))}</pre>`)}`;
    after?.(finished, out);
  } catch (error) {
    status.innerHTML = errorBox(error.message, error.code);
  }
}

export function collect(root) {
  launchTask(root, {
    script: "experiments/embodied/collect.py",
    args: ["--episodes", "100", "--noise", "0.1", "--out", "embodied/demo100.jsonl"],
    label: "采集专家轨迹",
    after: (t, out) => out.insertAdjacentHTML("afterbegin", `<div class="feedback pass"><strong>轨迹采集完成</strong><pre>${esc((t.log || "").slice(-500))}</pre></div>`),
  });
}

export function train(root) {
  launchTask(root, {
    script: "experiments/embodied/bc_train.py",
    args: ["--data", "embodied/demo100.jsonl", "--out", "embodied/bc-model", "--json-out", "embodied/bc-train.json", "--epochs", "400"],
    label: "BC 训练（自己训练）",
    after: (t, out) => {
      out.insertAdjacentHTML("afterbegin", `<div class="feedback pass"><strong>BC 训练完成（kind=own-training）</strong><pre>${esc((t.log || "").slice(-500))}</pre></div>`);
      recordRun({
        lab: "embodied", mode: "train", summary: "BC 策略训练完成", passed: t.status === "succeeded",
        evidence: { taskId: t.id, log: (t.log || "").slice(-1000) },
        config: { script: t.script, epochs: 400 },
        statuses: { diagnosed: false, verified: false },
      });
      refreshHistory(root);
    },
  });
}

export async function evaluate(root) {
  const out = root.querySelector("#output");
  const status = root.querySelector("#emb-task-status");
  try {
    status.innerHTML = loading("闭环评测（训练分布 + 新分布）…");
    const results = [];
    for (const dist of ["train", "new"]) {
      const task = await createTask({
        script: "experiments/embodied/evaluate.py",
        args: ["--model", "embodied/bc-model/policy.pt", "--episodes", "50", "--target-dist", dist, "--json-out", `embodied/bc-eval-${dist}.json`],
        label: `闭环评测 ${dist}`,
      });
      const finished = await waitForTask(task.id, { onUpdate: (t) => (status.innerHTML = loading(`评测 ${dist} · ${t.status}`)) });
      if (finished.status !== "succeeded") {
        recordRun({
          lab: "embodied", mode: "train", summary: `闭环评测失败（${dist}：${finished.status}）`, passed: false,
          evidence: { taskId: finished.id, status: finished.status, exitCode: finished.exitCode, log: (finished.log || "").slice(-2000) },
          statuses: { diagnosed: false, verified: false },
        });
        refreshHistory(root);
        status.innerHTML = errorBox(`评测 ${dist} 失败（${finished.status}），已停止后续评测。`, "E_TASK_FAILED");
        return;
      }
      results.push({ dist, finished });
    }
    status.innerHTML = "<small>评测完成</small>";
    const parse = (t) => {
      try { return JSON.parse((t.log || "").match(/\{.*\}/s)?.[0] || "{}"); } catch { return {}; }
    };
    const rows = results.map(({ dist, finished }) => {
      const m = parse(finished);
      return `<tr><td>${dist === "train" ? "训练分布" : "新分布（更远目标）"}</td><td><strong>${m.successRate ?? "?"}</strong></td><td>${m.meanFinalError ?? "?"}</td><td>${m.meanSteps ?? "?"}</td></tr>`;
    });
    out.insertAdjacentHTML("afterbegin", `
      <h3>闭环评测结果（真实运行）</h3>
      ${table(["目标分布", "成功率", "平均误差", "平均步数"], rows)}
      <div class="callout"><strong>读数指南</strong><p>新分布成功率下降 = 分布偏移的证据。改进方向见课程页：更多样数据（DAgger 思想）、控制反馈。请区分“运行已有策略”与“自己训练”——本次是平台内真实训练的 BC 策略。</p></div>`);
    const trainResult = parse(results[0].finished);
    recordRun({
      lab: "embodied", mode: "train", summary: `闭环评测：训练分布 ${trainResult.successRate} / 新分布 ${parse(results[1].finished).successRate}`,
      passed: Number(trainResult.successRate) >= 0.9,
      evidence: results.map(({ dist, finished }) => ({ dist, log: (finished.log || "").slice(-400) })),
      config: { episodes: 50, model: "bc-model/policy.pt" },
      metrics: { trainSuccess: trainResult.successRate, newSuccess: parse(results[1].finished).successRate },
      statuses: { diagnosed: true, verified: Number(trainResult.successRate) >= 0.9 },
    });
    refreshHistory(root);
  } catch (error) {
    status.innerHTML = errorBox(error.message, error.code);
  }
}

function refreshHistory(root) {
  const el = root.querySelector("#emb-runs");
  if (el) el.innerHTML = runsHistory();
}

export function bind(root) {
  root.querySelector("#m-angle")?.addEventListener("input", (e) => {
    root.querySelector("#angle-value").textContent = `${e.target.value}°`;
  });
  root.querySelector('[data-action="run-motion"]')?.addEventListener("click", () => runMotion(root));
  root.querySelector('[data-action="run-episode"]')?.addEventListener("click", () => runEpisodeView(root));
  root.querySelector('[data-action="run-profiles"]')?.addEventListener("click", () => runProfiles(root));
  root.querySelector('[data-action="run-qlearn"]')?.addEventListener("click", () => runQlearn(root));
  root.querySelector('[data-action="emb-collect"]')?.addEventListener("click", () => collect(root));
  root.querySelector('[data-action="emb-train"]')?.addEventListener("click", () => train(root));
  root.querySelector('[data-action="emb-eval"]')?.addEventListener("click", () => evaluate(root));
  root.querySelector('[data-course="space"]')?.addEventListener("click", () => go("course", "space", "0"));
}
