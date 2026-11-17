// 课程引用链接可达性核对（一次性验收脚本；结果写入 docs/ACCEPTANCE.md 附录）。
import { courses } from "../src/content/index.js";
import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const urls = new Map();
for (const c of courses)
  for (const r of c.references || []) if (!urls.has(r.url)) urls.set(r.url, c.id);

const results = [];
for (const [url, cid] of urls) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    results.push({ cid, url, status: res.status, final: res.url });
  } catch (error) {
    // Node undici 对部分站点的 TLS/HTTP2 限制：回退到系统 curl 复核
    const viaCurl = await curlStatus(url);
    results.push({ cid, url, status: viaCurl ?? "ERR:" + String(error.message).slice(0, 40), via: viaCurl ? "curl" : "fetch" });
  }
}

function curlStatus(url) {
  return new Promise((resolve) => {
    const proc = spawn("curl", ["-s", "-o", "nul", "-w", "%{http_code}", "-L", "--max-time", "25", url], { shell: true });
    let out = "";
    proc.stdout?.on?.("data", (d) => (out += d));
    proc.on("close", () => {
      const code = parseInt(String(out).trim(), 10);
      resolve(Number.isFinite(code) ? code : null);
    });
    proc.on("error", () => resolve(null));
  });
}
const ok = (s) => [200, 301, 302, 303].includes(s);
const bad = results.filter((r) => !ok(r.status));
const lines = [
  `# 链接核对结果（${new Date().toISOString().slice(0, 10)}）`,
  ``,
  `共核对 ${results.length} 个唯一链接；可达 ${results.length - bad.length} 个；异常 ${bad.length} 个。`,
  ``,
  ...results.map((r) => `- [${ok(r.status) ? "OK" : "异常"}] ${r.status} · ${r.cid} · ${r.url}`),
];
writeFileSync("artifacts/logs/link-check.txt", lines.join("\n"));
console.log(`checked ${results.length}, bad ${bad.length}`);
for (const b of bad) console.log("BAD", b.status, b.cid, b.url.slice(0, 100));
