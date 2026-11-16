// 前端语法检查：遍历 src/app 与 src 下所有模块（npm run check 使用）。
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const roots = ["src/core", "src/content", "src/labs", "src/app"];
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".js")) files.push(full);
  }
}
for (const r of roots) walk(r);

let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (res.status !== 0) {
    failed++;
    console.error(`FAIL ${file}\n${res.stderr}`);
  }
}
console.log(`checked ${files.length} frontend modules`);
process.exit(failed ? 1 : 0);
