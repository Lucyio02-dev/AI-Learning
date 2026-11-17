// 旧 Sites 仅作为统一入口与原域名数据导出页；源文件随主仓库管理。
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist-legacy");
if (!output.startsWith(`${root}${sep}`) || output !== resolve(root, "dist-legacy")) throw new Error("Invalid legacy output directory.");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "hosting/legacy-sites"), output, { recursive: true });
await cp(resolve(root, "src/core"), resolve(output, "src/core"), { recursive: true });
await mkdir(resolve(output, "src/app"), { recursive: true });
await cp(resolve(root, "src/app/release.js"), resolve(output, "src/app/release.js"));
await cp(resolve(root, "service-worker.js"), resolve(output, "service-worker.js"));
console.log(`Legacy entrance prepared: ${output}`);
