// 模型代理：密钥只存在于服务器环境变量。前端只拿到响应与用量。
// 支持 OpenAI 兼容协议（DeepSeek / GLM）。
import { nowIso, uuid } from "./util.js";

export const PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    base: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    keyEnv: "DEEPSEEK_API_KEY",
    // 估算用公开定价常数（元/百万 token），仅作量级参考，标记为 estimate。
    pricing: { input: 2, output: 8 },
  },
  glm: {
    label: "GLM",
    base: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash",
    keyEnv: "GLM_API_KEY",
    pricing: { input: 0, output: 0 },
  },
};

export function providerStatus() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    model: p.model,
    configured: !!process.env[p.keyEnv],
  }));
}

export function costEstimate(providerId, usage) {
  const p = PROVIDERS[providerId];
  if (!p || !usage) return null;
  const cny =
    ((usage.prompt_tokens || 0) * p.pricing.input +
      (usage.completion_tokens || 0) * p.pricing.output) /
    1e6;
  return { currency: "CNY", amount: Number(cny.toFixed(6)), basis: "estimate" };
}

export async function chat({ messages, sampling = {}, provider = "deepseek", seed = null }) {
  const p = PROVIDERS[provider] || PROVIDERS.deepseek;
  const key = process.env[p.keyEnv];
  if (!key) {
    const error = new Error(`服务器未配置 ${p.keyEnv}`);
    error.code = "E_MODEL_NO_KEY";
    throw error;
  }
  const started = Date.now();
  const body = {
    model: p.model,
    messages,
    temperature: sampling.temperature ?? 0,
    max_tokens: Math.min(sampling.maxTokens ?? 512, 2048),
    stream: false,
  };
  if (seed !== null && provider === "deepseek") body.seed = seed;
  let res;
  try {
    res = await fetch(p.base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    const wrapped = new Error(`模型服务不可达：${error.message}`);
    wrapped.code = "E_MODEL_HTTP";
    throw wrapped;
  }
  const elapsedMs = Date.now() - started;
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload) {
    const wrapped = new Error(
      `模型服务返回 ${res.status}：${payload?.error?.message || res.statusText}`,
    );
    wrapped.code = "E_MODEL_HTTP";
    throw wrapped;
  }
  const choice = payload.choices?.[0]?.message?.content ?? "";
  return {
    id: uuid(),
    time: nowIso(),
    provider: provider === "glm" ? "glm" : "deepseek",
    providerLabel: p.label,
    model: payload.model || p.model,
    text: choice,
    finishReason: payload.choices?.[0]?.finish_reason || null,
    usage: payload.usage || null,
    costEstimate: costEstimate(provider, payload.usage),
    sampling: { ...sampling, seed: seed ?? undefined },
    elapsedMs,
  };
}
