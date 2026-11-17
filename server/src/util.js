// 通用工具：JSON 读写、请求体解析、ID、安全路径。
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";

export const uuid = () => randomUUID();
export const newToken = () => randomBytes(24).toString("hex");

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}
export function verifyPassword(password, { salt, hash }) {
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function readJson(req, limit = 2 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("payload too large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export function send(res, status, data, headers = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

export async function ensureJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    if (fallback !== undefined) {
      await mkdir(resolve(path, ".."), { recursive: true });
      await writeFile(path, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    return null;
  }
}

export async function writeJson(path, data) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
  return true;
}

export function withinRoot(root, candidate) {
  const abs = resolve(root, candidate);
  return abs === root || abs.startsWith(root + sep) ? abs : null;
}

export const nowIso = () => new Date().toISOString();
