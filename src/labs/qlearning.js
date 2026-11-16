// RL 基础实验：表格型 Q-learning（5×5 GridWorld）。
// 目的：建立"奖励、策略、探索与收敛"的最小直觉；不是深度强化学习。
export const GRID = { size: 5, start: [0, 0], goal: [4, 4], pits: [[2, 2]], stepReward: -0.04, goalReward: 1, pitReward: -1 };

export function newQTable(size = GRID.size) {
  // Q[state(y,x)][action(上右下左)] = 0
  return Array.from({ length: size * size }, () => [0, 0, 0, 0]);
}

const idx = (y, x, size = GRID.size) => y * size + x;
const ACTIONS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export function stepEnv(state, action, grid = GRID) {
  const [dy, dx] = ACTIONS[action];
  let y = Math.max(0, Math.min(grid.size - 1, state[0] + dy));
  let x = Math.max(0, Math.min(grid.size - 1, state[1] + dx));
  // 10% 随机滑动（执行噪声）
  if (Math.random() < 0.1) {
    const slip = ACTIONS[Math.floor(Math.random() * 4)];
    y = Math.max(0, Math.min(grid.size - 1, y + slip[0]));
    x = Math.max(0, Math.min(grid.size - 1, x + slip[1]));
  }
  let reward = grid.stepReward;
  let done = false;
  if (y === grid.goal[0] && x === grid.goal[1]) { reward = grid.goalReward; done = true; }
  else if (grid.pits.some(([py, px]) => py === y && px === x)) { reward = grid.pitReward; done = true; }
  return { next: [y, x], reward, done };
}

// 训练 N 个 episode，返回 {qTable, history, greedyPath, successRate}
export function trainQLearning({ episodes = 300, alpha = 0.5, gamma = 0.9, epsilon = 0.2, seed = 7 } = {}) {
  // 可复现伪随机
  let s = seed >>> 0;
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const q = newQTable();
  const history = [];
  let successes = 0;
  const window = 20;
  for (let ep = 0; ep < episodes; ep++) {
    let state = [...GRID.start];
    let total = 0;
    for (let t = 0; t < 60; t++) {
      const si = idx(state[0], state[1]);
      const action = rand() < epsilon
        ? Math.floor(rand() * 4)
        : q[si].indexOf(Math.max(...q[si]));
      const { next, reward, done } = stepEnv(state, action);
      const ni = idx(next[0], next[1]);
      q[si][action] += alpha * (reward + (done ? 0 : gamma * Math.max(...q[ni])) - q[si][action]);
      total += reward;
      state = next;
      if (done) break;
    }
    if (state[0] === GRID.goal[0] && state[1] === GRID.goal[1]) successes++;
    if ((ep + 1) % window === 0)
      history.push({ episode: ep + 1, successRate: successes / window, avgReturn: +(total).toFixed(2) });
    if ((ep + 1) % window === 0) successes = 0;
  }
  return { qTable: q, history, greedyPath: greedyPath(q) };
}

export function greedyPath(q, grid = GRID, maxLen = 25) {
  const path = [[...GRID.start]];
  const visited = new Set(["0,0"]);
  let state = [...GRID.start];
  for (let t = 0; t < maxLen; t++) {
    const si = idx(state[0], state[1], grid.size);
    const action = q[si].indexOf(Math.max(...q[si]));
    const [dy, dx] = ACTIONS[action];
    const next = [
      Math.max(0, Math.min(grid.size - 1, state[0] + dy)),
      Math.max(0, Math.min(grid.size - 1, state[1] + dx)),
    ];
    path.push(next);
    const key = next.join(",");
    if (next[0] === grid.goal[0] && next[1] === grid.goal[1]) return { path, reached: true };
    if (visited.has(key)) return { path, reached: false };
    visited.add(key);
    state = next;
  }
  return { path, reached: false };
}

export function qGridSvg(q, path, reached) {
  const n = GRID.size;
  const cell = 64;
  const pathSet = new Set(path.map((p) => p.join(",")));
  const cells = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const si = idx(y, x, n);
      const v = Math.max(...q[si]);
      const isPit = GRID.pits.some(([py, px]) => py === y && px === x);
      const isGoal = y === GRID.goal[0] && x === GRID.goal[1];
      const isStart = y === GRID.start[0] && x === GRID.start[1];
      const onPath = pathSet.has(`${y},${x}`);
      const intensity = Math.min(1, Math.abs(v));
      const color = v >= 0 ? `rgba(46,125,91,${0.12 + intensity * 0.55})` : `rgba(179,86,44,${0.1 + intensity * 0.4})`;
      cells.push(
        `<rect x="${x * cell}" y="${y * cell}" width="${cell - 3}" height="${cell - 3}" rx="8" fill="${isGoal ? "#2e7d5b" : isPit ? "#b3562c" : color}" opacity="${isGoal || isPit ? 0.9 : 1}"/>` +
        (onPath ? `<circle cx="${x * cell + cell / 2}" cy="${y * cell + cell / 2}" r="7" fill="#ce8b42"/>` : "") +
        (isStart ? `<text x="${x * cell + 8}" y="${y * cell + 20}" font-size="11">起</text>` : "") +
        (isGoal ? `<text x="${x * cell + 20}" y="${y * cell + 38}" font-size="12" fill="#fff">目标</text>` : "") +
        (isPit ? `<text x="${x * cell + 20}" y="${y * cell + 38}" font-size="12" fill="#fff">陷阱</text>` : "") +
        `<text x="${x * cell + cell / 2 - 10}" y="${y * cell + cell - 8}" font-size="10" fill="#33513f">${v.toFixed(2)}</text>`,
      );
    }
  return `<svg class="motion-plot" viewBox="0 0 ${n * cell} ${n * cell}" role="img" aria-label="Q 值网格与贪心路径，${reached ? "已到达目标" : "未到达目标"}">${cells.join("")}</svg>`;
}
