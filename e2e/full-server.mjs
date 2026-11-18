// E2E 完整模式：每次启动清空隔离数据目录，绝不读取 server/data。
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "e2e/.tmp-data");
await rm(dataDir, { recursive: true, force: true });
process.env.PORT = "8788";
process.env.AI_LEARNING_HOST = "127.0.0.1";
process.env.AI_LEARNING_DATA = dataDir;
await import("../server/index.js");
