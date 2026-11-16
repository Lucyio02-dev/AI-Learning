// 后端 API 客户端：探测完整模式，封装模型/任务/RAG/账户调用。
// 全部失败降级为本地模式，不假装成功。
const base = "";
let backendAvailable = null; // null=未探测 false=本地模式 true=完整模式
let providerCache = null;
const tokenKey = "ai-learning-auth-token";

export function hasBackend() {
  return backendAvailable === true;
}
export function backendProbed() {
  return backendAvailable !== null;
}

export async function probe() {
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    backendAvailable = true;
    providerCache = data.providers || [];
    return { ok: true, providers: providerCache };
  } catch {
    backendAvailable = false;
    providerCache = null;
    return { ok: false, providers: [] };
  }
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  if (!hasBackend()) throw apiError("E_MODEL_NO_BACKEND");
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem(tokenKey);
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(auth ? 10000 : 180000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearToken();
    const error = new Error(data.error || `HTTP ${res.status}`);
    error.code = data.code || "E_SYNC_HTTP";
    error.payload = data;
    error.statusCode = res.status;
    throw error;
  }
  return data;
}

function apiError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

export const providers = () => providerCache || [];

export const modelChat = ({ messages, sampling, provider, seed }) =>
  request("/api/model/chat", { method: "POST", body: { messages, sampling, provider, seed } });

export const createTask = (payload) =>
  request("/api/tasks", { method: "POST", body: payload });
export const listTasks = () => request("/api/tasks");
export const taskDetail = (id) => request(`/api/tasks/${id}`);
export const cancelTask = (id) => request(`/api/tasks/${id}/cancel`, { method: "POST" });

export const ragQuery = (payload) =>
  request("/api/rag/query", { method: "POST", body: payload });

export const register = (username, password) =>
  request("/api/accounts/register", { method: "POST", body: { username, password } });
export const login = (username, password) => {
  const result = request("/api/accounts/login", { method: "POST", body: { username, password } });
  return result.then((data) => {
    localStorage.setItem(tokenKey, data.token);
    return data;
  });
};
export const logout = () =>
  request("/api/accounts/logout", { method: "POST" }).finally(() => clearToken());
export const clearToken = () => localStorage.removeItem(tokenKey);
export const hasToken = () => !!localStorage.getItem(tokenKey);

export const syncPull = () => request("/api/sync/pull", { auth: true });
export const syncPush = (state, baseRevision, strategy) =>
  request("/api/sync/push", { method: "POST", body: { state, baseRevision, strategy } });

// 任务轮询直到终态（超时保护）。
export async function waitForTask(id, { onUpdate, maxMs = 900000, intervalMs = 1200 } = {}) {
  const deadline = Date.now() + maxMs;
  let last = null;
  while (Date.now() < deadline) {
    const task = await taskDetail(id);
    last = task;
    onUpdate?.(task);
    if (["succeeded", "failed", "cancelled", "timeout"].includes(task.status)) return task;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}
