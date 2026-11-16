// Agent 故障实验室核心：工具注册、参数/权限校验、故障注入、
// 幂等写入、检查点与恢复。全部确定性，可持久化、可回放。
export const ERR = {
  OK: "ok",
  INVALID_PARAMS: "参数校验失败",
  PERMISSION_DENIED: "权限不足",
  TIMEOUT_READ: "读取超时",
  TIMEOUT_WRITE: "写入超时（结果未知）",
  EMPTY_RESULT: "空结果",
  STALE_DATA: "数据已过期",
  UNKNOWN_WRITE: "写入结果不明",
};

const now = () =>
  (globalThis.crypto?.randomUUID?.() || `t-${Date.now()}-${Math.random()}`) 
    .toString().slice(0, 12);

export const TOOL_SPECS = {
  query_slots: {
    name: "query_slots",
    desc: "查询实验室空位（只读）",
    sideEffect: "read",
    permission: "student",
    schema: {
      day: { type: "enum", values: ["friday", "saturday"], required: true },
    },
    faults: ["timeout_read", "empty", "stale"],
  },
  book_lab: {
    name: "book_lab",
    desc: "预约实验室时段（写入，幂等）",
    sideEffect: "write",
    permission: "student",
    schema: {
      slot: {
        type: "enum",
        values: ["friday-14", "friday-15", "saturday-10"],
        required: true,
      },
      capacity: { type: "int", min: 1, max: 4, required: true },
      request_id: { type: "string", required: false },
    },
    faults: ["timeout_write", "permission", "invalid"],
  },
  verify_booking: {
    name: "verify_booking",
    desc: "按请求标识核验预约结果（只读）",
    sideEffect: "read",
    permission: "student",
    schema: {
      request_id: { type: "string", required: true, minLen: 6 },
    },
    faults: [],
  },
  cancel_booking: {
    name: "cancel_booking",
    desc: "补偿：取消一条预约（写入，幂等）",
    sideEffect: "write",
    permission: "student",
    schema: {
      booking_id: { type: "string", required: true, minLen: 6 },
    },
    faults: [],
  },
};

// 参数校验：返回 {ok, errors[]}，错误按语义分类。
export function validateParams(tool, params) {
  const spec = TOOL_SPECS[tool];
  if (!spec) return { ok: false, errors: [{ code: "UNKNOWN_TOOL" }] };
  const errors = [];
  for (const [key, rule] of Object.entries(spec.schema)) {
    const v = params[key];
    if (rule.required && (v === undefined || v === null || v === "")) {
      errors.push({ code: "MISSING", field: key });
      continue;
    }
    if (v === undefined || v === null || v === "") continue;
    if (rule.type === "enum" && !rule.values.includes(v))
      errors.push({ code: "ENUM", field: key });
    if (rule.type === "int") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < (rule.min ?? -Infinity) || n > (rule.max ?? Infinity))
        errors.push({ code: "RANGE", field: key });
    }
    if (rule.type === "string" && rule.minLen && String(v).length < rule.minLen)
      errors.push({ code: "MINLEN", field: key });
  }
  for (const key of Object.keys(params))
    if (!(key in spec.schema)) errors.push({ code: "EXTRA", field: key });
  return { ok: errors.length === 0, errors };
}

export const newWorld = () => ({
  bookings: [], // {id, slot, requestId, createdAt}
  requests: {}, // requestId -> {status:"committed"|"none", bookingId}
  clock: 0,
});

// 模拟服务端：所有副作用在这里发生。注入的故障决定客户端看到什么。
export function serverCall(world, tool, params, fault) {
  const spec = TOOL_SPECS[tool];
  const step = (log) => {
    world.clock++;
    return { worldClock: world.clock, ...log };
  };
  if (fault === "permission" && tool === "book_lab")
    return step({ error: ERR.PERMISSION_DENIED });
  if (fault === "timeout_read")
    return step({ error: ERR.TIMEOUT_READ });
  if (fault === "empty")
    return step({ result: { slots: [] } });

  if (tool === "query_slots") {
    if (fault === "stale")
      return step({ result: { slots: ["friday-14"], asOf: "第 3 周（已过期）" } });
    const booked = new Set(world.bookings.map((b) => b.slot));
    return step({
      result: {
        slots: ["friday-14", "friday-15", "saturday-10"].filter((s) => !booked.has(s)),
        asOf: `时钟 ${world.clock}`,
      },
    });
  }

  if (tool === "book_lab") {
    const v = validateParams(tool, params);
    if (!v.ok) return step({ error: ERR.INVALID_PARAMS, detail: v.errors });
    const requestId = params.request_id || now();
    // 幂等：同一 request_id 只产生一条预约（真实副作用不重复）。
    if (world.requests[requestId]?.status === "committed")
      return step({
        result: { bookingId: world.requests[requestId].bookingId, requestId, deduped: true },
        hidden: true,
      });
    const bookingId = now();
    world.bookings.push({ id: bookingId, slot: params.slot, requestId, createdAt: world.clock });
    world.requests[requestId] = { status: "committed", bookingId };
    if (fault === "timeout_write")
      return step({ error: ERR.TIMEOUT_WRITE, requestHint: requestId, hidden: true });
    return step({ result: { bookingId, requestId } });
  }

  if (tool === "verify_booking") {
    const r = world.requests[params.request_id];
    return step({
      result: r
        ? { status: "confirmed", bookingId: r.bookingId, requestId: params.request_id }
        : { status: "none", requestId: params.request_id },
    });
  }

  if (tool === "cancel_booking") {
    const idx = world.bookings.findIndex((b) => b.id === params.booking_id);
    if (idx === -1) return step({ result: { cancelled: false, reason: ERR.EMPTY_RESULT } });
    world.bookings.splice(idx, 1);
    return step({ result: { cancelled: true } });
  }

  return step({ error: ERR.UNKNOWN_WRITE });
}

export const newAgentRun = (goal = "预约周五下午的实验室， capacities 不超过 4") => ({
  id: now(),
  goal,
  phase: "idle", // idle|acting|interrupted|recovering|done
  requestId: "",
  world: newWorld(),
  trace: [], // {t, kind, tool, params, maskedParams, result|error, note}
  writes: 0,
  reads: 0,
  done: false,
  passed: false,
  failure: "",
  retries: [],
  faultPlan: [],
  checkpoint: null,
});

// 隐藏敏感字段：trace 里不落完整 request_id，只留前 4 位。
const mask = (params = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(params))
    out[k] = k.toLowerCase().includes("request") ? String(v).slice(0, 4) + "…" : v;
  return out;
};

function pushTrace(run, entry) {
  run.trace.push({ t: run.world.clock, ...entry, masked: mask(entry.params) });
  if (run.trace.length > 200) run.trace.splice(0, run.trace.length - 200);
}

// 读取类调用（可安全重试）。
export function callRead(run, tool, params, fault = null) {
  if (run.done) return run;
  const res = serverCall(run.world, tool, params, fault);
  if (res.error) {
    run.reads++;
    pushTrace(run, { kind: "read-error", tool, params, error: res.error });
    return run;
  }
  if (fault === "timeout_read") {
    run.reads++;
    pushTrace(run, { kind: "read-error", tool, params, error: ERR.TIMEOUT_READ });
    return run;
  }
  run.reads++;
  pushTrace(run, { kind: "read", tool, params, result: res.result });
  return run;
}

// 写入类调用：真实副作用在 serverCall 内发生（含故障注入时）。
export function callWrite(run, tool, params, fault = null) {
  if (run.done) return run;
  const spec = TOOL_SPECS[tool];
  const v = validateParams(tool, params);
  if (!v.ok) {
    pushTrace(run, { kind: "rejected", tool, params, errors: v.errors });
    run.failure = ERR.INVALID_PARAMS;
    return run;
  }
  if (spec.permission !== "student") {
    pushTrace(run, { kind: "rejected", tool, params, error: ERR.PERMISSION_DENIED });
    run.failure = ERR.PERMISSION_DENIED;
    return run;
  }
  if (!params.request_id && tool === "book_lab")
    params.request_id = run.requestId || (run.requestId = now());
  const res = serverCall(run.world, tool, params, fault);
  run.writes++;
  if (fault === "timeout_write") {
    run.phase = "interrupted";
    run.checkpoint = {
      stage: "write-unknown",
      requestId: params.request_id,
      note: "写入已发出，结果未知；恢复前必须核验",
      savedAt: new Date().toISOString(),
    };
    pushTrace(run, {
      kind: "write-unknown",
      tool,
      params,
      error: ERR.TIMEOUT_WRITE,
      note: "检查点已保存（写入结果未知）",
    });
    return run;
  }
  if (res.error) {
    pushTrace(run, { kind: "write-error", tool, params, error: res.error });
    return run;
  }
  run.phase = "acting";
  pushTrace(run, { kind: "write", tool, params, result: res.result });
  return run;
}

// 恢复：核验 request_id 的实际状态；已完成则不再写入。
export function recover(run) {
  if (run.phase !== "interrupted" || !run.checkpoint) return run;
  const requestId = run.checkpoint.requestId;
  const res = serverCall(run.world, "verify_booking", { request_id: requestId });
  run.reads++;
  const status = res.result?.status || "none";
  pushTrace(run, {
    kind: "verify",
    tool: "verify_booking",
    params: { request_id: requestId },
    result: res.result,
    note: status === "confirmed" ? "服务端已生效，无需重写" : "未生效，可安全重试",
  });
  run.phase = status === "confirmed" ? "verified" : "recovering";
  run.recoveredStatus = status;
  return run;
}

// 目标核验：不只看状态码，看事实（恰好一条有效预约）。
export function finish(run) {
  const valid = run.world.bookings.filter((b) => b.requestId === run.requestId);
  run.done = true;
  run.passed = valid.length === 1 && run.failure !== ERR.PERMISSION_DENIED;
  run.failure = run.passed ? "" : valid.length > 1 ? "重复预约" : run.failure || "目标未达成";
  pushTrace(run, {
    kind: "finish",
    note: `目标核验：${valid.length} 条有效预约 → ${run.passed ? "通过" : "未通过"}`,
  });
  return run;
}

// 兼容旧 API（课程页与测试沿用）。
export const newAgent = () => ({ ...newAgentRun(), log: [] });
export function agentStep(state, action) {
  const s = structuredClone(state);
  s.log = s.log || [];
  if (s.done) return s;
  if (action === "start") {
    callWrite(s, "book_lab", { slot: "friday-14", capacity: 2 }, "timeout_write");
    s.log.push(
      "① 查询可用预约 → 成功",
      "② 写入预约 → 服务端已提交，但客户端收到超时",
      "检查点：写入结果未知；已发生一次写入（request_id 已留存）",
    );
    s.phase = "interrupted";
    return s;
  }
  if (s.phase === "interrupted" && action === "retry") {
    callWrite(s, "book_lab", { slot: "friday-14", capacity: 2 });
    s.writes = s.world.bookings.length || s.writes;
    s.done = true;
    s.passed = false;
    s.log = [
      ...(s.log || []),
      "③ 原样重试写入 → 重复预约（服务端出现第二条记录）",
      "验证失败：同一目标两条预约。应先按请求标识核验。",
    ];
    return s;
  }
  if (s.phase === "interrupted" && action === "verify") {
    recover(s);
    s.log = [
      ...(s.log || []),
      "③ 按请求标识核验 → 找到已生效预约，状态 confirmed（不重复提交）",
    ];
    s.phase = "checked";
    return s;
  }
  if ((s.phase === "checked" || s.phase === "verified") && action === "finish") {
    finish(s);
    s.log = [
      ...(s.log || []),
      "④ 目标核验：服务端恰好一条有效预约 → 通过",
    ];
    s.passed = s.world.bookings.filter((b) => b.requestId === s.requestId).length === 1;
    return s;
  }
  return s;
}
