// 具身运动学内核：位姿、参考系、执行误差、故障注入与时间轴。
// 与 Python 仿真（experiments/embodied/sim.py）保持一致的数学。
export function rot2(thetaRad) {
  const c = Math.cos(thetaRad), s = Math.sin(thetaRad);
  return { xx: c, xy: -s, yx: s, yy: c };
}
export const apply = (R, p) => ({
  x: R.xx * p.x + R.xy * p.y,
  y: R.yx * p.x + R.yy * p.y,
});
const transpose = (R) => ({ xx: R.xx, xy: R.yx, yx: R.xy, yy: R.yy });

// 简单可复现伪随机（mulberry32）——浏览器与 Node 一致。
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FAULTS = {
  none: "无故障",
  frame: "参考系错误：世界位移被当作机体位移",
  actionLimit: "动作限幅：单步位移被截断",
  drift: "执行漂移：每步加入系统性偏差",
  occlusion: "遮挡：目标移动时观测缺失，控制器使用旧估计",
  timeSkew: "时间错位：动作滞后一个控制周期",
  unit: "单位错误：度被当弧度使用",
};

export const newPose = (x = 0, y = 0, thetaDeg = 0) => ({
  x, y, theta: (thetaDeg * Math.PI) / 180,
});

export function planBodyAction(pose, targetWorld, { correct = true, unitOk = true } = {}) {
  // 世界位移 → 机体位移：p_body = R(θ)ᵀ · (target − pose)
  const delta = { x: targetWorld.x - pose.x, y: targetWorld.y - pose.y };
  if (correct) return apply(transpose(rot2(pose.theta)), delta);
  return delta; // 故障：直接把世界位移当机体位移
}

export function executeAction(action, { fault = "none", noise = 0, rand = Math.random, dt = 0.2 } = {}) {
  let a = { ...action };
  if (fault === "actionLimit") {
    const mag = Math.hypot(a.x, a.y);
    const limit = 2.0;
    if (mag > limit) a = { x: (a.x / mag) * limit, y: (a.y / mag) * limit };
  }
  if (fault === "drift") a = { x: a.x + 0.15, y: a.y + 0.05 };
  if (fault === "unit") a = { x: a.x * 57.3 / 57.3, y: a.y }; // 单位故障体现在角度处理
  a = { x: a.x + (rand() * 2 - 1) * noise, y: a.y + (rand() * 2 - 1) * noise };
  return a;
}

// 多步闭环：每步重新观察（或遮挡时用旧估计），执行并记录时间轴。
export function runEpisode({
  start = newPose(0, 0, 90),
  target = { x: 3, y: 2 },
  correct = true,
  fault = "none",
  noise = 0.02,
  seed = 7,
  maxSteps = 12,
  tolerance = 0.15,
  dt = 0.2,
} = {}) {
  const rand = rng(seed);
  const pose = { ...start };
  const frames = [];
  let lastObservedTarget = { ...target };
  let currentTarget = { ...target };
  let success = false;
  for (let t = 0; t < maxSteps; t++) {
    const observed = fault === "occlusion" && t % 3 !== 0
      ? { ...lastObservedTarget }
      : { ...currentTarget };
    lastObservedTarget = observed;
    const plan = planBodyAction(pose, observed, { correct: correct && fault !== "frame" });
    const act = executeAction(plan, { fault, noise, rand });
    // 时间错位：动作实际在下一周期生效
    if (fault === "timeSkew" && t === 0) {
      frames.push({ t, pose: { ...pose }, observed, planned: plan, action: null, note: "动作延迟一个周期" });
      continue;
    }
    const move = apply(rot2(pose.theta), act);
    pose.x += move.x;
    pose.y += move.y;
    if (fault === "occlusion" && t === 0)
      currentTarget = { x: target.x + 0.8, y: target.y + 0.5 };
    const err = Math.hypot(pose.x - currentTarget.x, pose.y - currentTarget.y);
    frames.push({
      t,
      dt,
      pose: { x: +pose.x.toFixed(4), y: +pose.y.toFixed(4), theta: +(pose.theta * 180 / Math.PI).toFixed(1) },
      observed,
      target: { ...currentTarget },
      ...(fault === "occlusion" && t === 0 ? { note: "目标在本周期内移动，后续两次观测被遮挡" } : {}),
      planned: { x: +plan.x.toFixed(3), y: +plan.y.toFixed(3) },
      action: { x: +act.x.toFixed(3), y: +act.y.toFixed(3) },
      error: +err.toFixed(4),
    });
    if (err < tolerance) { success = true; break; }
  }
  const finalError = Math.hypot(pose.x - currentTarget.x, pose.y - currentTarget.y);
  return {
    frames,
    success,
    finalError: +finalError.toFixed(4),
    steps: frames.length,
    fault,
    noise,
    seed,
    target,
    finalTarget: currentTarget,
  };
}

// 兼容旧 API：单步演示（课程页与既有测试）。
export function motion(angle, correct = true, target = { x: 3, y: 2 }) {
  const t = (Number(angle) * Math.PI) / 180;
  const R = rot2(t);
  const body = correct ? apply(transpose(R), target) : { ...target };
  const actual = apply(R, body);
  return {
    body,
    actual,
    target,
    error: Math.hypot(actual.x - target.x, actual.y - target.y),
  };
}

// 故障特征对照（诊断学习用）。
export function faultProfiles(seed = 7, target = { x: 3, y: 2 }) {
  const out = {};
  for (const f of Object.keys(FAULTS)) {
    const r = runEpisode({ fault: f, seed, target, correct: f !== "frame" });
    out[f] = {
      success: r.success,
      finalError: r.finalError,
      steps: r.steps,
      signature:
        f === "frame"
          ? "误差随朝向变化，0° 时成功"
          : f === "actionLimit"
            ? "远距离目标卡在限幅半径，逐步逼近但变慢"
            : f === "drift"
              ? "恒定方向偏差，目标停不住"
              : f === "occlusion"
              ? "目标移动后短暂沿旧观测行动，观测恢复后再追踪新位置"
                : f === "timeSkew"
                  ? "起步迟一拍，其余正常"
                  : f === "unit"
                    ? "角度异常放大"
                    : "正常收敛",
    };
  }
  return out;
}
