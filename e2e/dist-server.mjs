// E2E 生产构建：先构建 dist，再以只读静态服务加载真实发布产物。
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
execFileSync(process.execPath, ["scripts/build-static-site.mjs"], { cwd: root, stdio: "inherit" });
process.env.AI_LEARNING_STATIC_ROOT = resolve(root, "dist");
process.env.PORT = "4174";
await import("../scripts/serve.mjs");
