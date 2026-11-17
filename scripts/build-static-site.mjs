import { cp, mkdir, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { release } from "../src/app/release.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
if (output !== resolve(root, "dist") || !output.startsWith(`${root}${sep}`)) {
  throw new Error("Static output must remain in the repository's dist directory.");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (pkg.version !== release.version) throw new Error("Package and application release versions must match.");

// 整个模块图放在同一个内容版本目录中，静态/动态相对 import 都保持原样。
// 旧页面也不会把新的入口和旧的子模块拼在一起。
const files = ["app.js", "styles.css"];
async function collect(dir) {
  const entries = await readdir(resolve(root, dir), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await collect(name);
    else files.push(name);
  }
}
await collect("src");
const hash = createHash("sha256");
for (const name of files) hash.update(name).update("\0").update(await readFile(resolve(root, name))).update("\0");
const assetDirectory = `releases/${release.version}-${hash.digest("hex").slice(0, 12)}`;
const assetRoot = resolve(output, assetDirectory);
await mkdir(assetRoot, { recursive: true });
for (const name of files) {
  await mkdir(dirname(resolve(assetRoot, name)), { recursive: true });
  await cp(resolve(root, name), resolve(assetRoot, name));
}
for (const file of [".nojekyll", "service-worker.js", "site.webmanifest"]) {
  await cp(resolve(root, file), resolve(output, file));
}
const index = (await readFile(resolve(root, "index.html"), "utf8"))
  .replace('href="./styles.css"', `href="./${assetDirectory}/styles.css"`)
  .replace('src="./app.js"', `src="./${assetDirectory}/app.js"`);
await writeFile(resolve(output, "index.html"), index);
let commit = process.env.GITHUB_SHA || "";
if (!commit) {
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); }
  catch { /* Source archives can be built without a .git directory. */ }
}
await writeFile(resolve(output, "release.json"), JSON.stringify({
  ...release,
  commit,
  assetDirectory,
  builtAt: new Date().toISOString(),
}, null, 2) + "\n");
console.log(`Static site ${release.version} prepared: ${output}\nAssets: ${assetDirectory}`);
