import { access, readFile, readdir } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { release } from "../src/app/release.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, process.argv[2] ?? "dist");
if (target !== resolve(root, "dist") || !target.startsWith(`${root}${sep}`)) {
  throw new Error("Release verification only accepts the repository's dist directory.");
}

const errors = [];
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const info = JSON.parse(await readFile(resolve(target, "release.json"), "utf8"));

if (pkg.version !== release.version) errors.push(`package.json ${pkg.version} != app ${release.version}`);
if (info.version !== release.version) errors.push(`release.json ${info.version} != app ${release.version}`);
if (info.baseline !== release.baseline) errors.push("release baseline does not match the application");
if (info.canonicalUrl !== release.canonicalUrl) errors.push("release canonical URL does not match the application");
if (!/^releases\/[0-9A-Za-z._-]+-[0-9a-f]{12}$/.test(info.assetDirectory ?? "")) {
  errors.push("assetDirectory must be a content-addressed releases/<version>-<hash> path");
} else if (!info.assetDirectory.startsWith(`releases/${info.version}-`)) {
  errors.push("assetDirectory version prefix does not match release.json");
}
if (!info.commit || !/^[0-9a-f]{40}$/.test(info.commit)) errors.push("commit must be a full 40-character SHA");
if (Number.isNaN(Date.parse(info.builtAt))) errors.push("builtAt must be an ISO timestamp");

if (process.env.GITHUB_SHA && info.commit !== process.env.GITHUB_SHA) {
  errors.push(`release commit ${info.commit} != workflow SHA ${process.env.GITHUB_SHA}`);
}
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== `v${info.version}`) {
  errors.push(`tag ${process.env.GITHUB_REF_NAME} != v${info.version}`);
}

const index = await readFile(resolve(target, "index.html"), "utf8");
const script = index.match(/<script[^>]+src="([^"]+)"/)?.[1];
const style = index.match(/href="([^"]+\/styles\.css)"/)?.[1];
if (script !== `./${info.assetDirectory}/app.js`) errors.push("index.html does not load the release app entry");
if (style !== `./${info.assetDirectory}/styles.css`) errors.push("index.html does not load the release stylesheet");

for (const file of ["app.js", "styles.css"]) {
  try {
    await access(resolve(target, info.assetDirectory, file));
  } catch {
    errors.push(`missing release asset: ${info.assetDirectory}/${file}`);
  }
}
for (const file of [".nojekyll", "service-worker.js", "site.webmanifest"]) {
  try {
    await access(resolve(target, file));
  } catch {
    errors.push(`missing root release file: ${file}`);
  }
}

const published = await readdir(target);
for (const forbidden of ["server", "experiments", ".git", ".env", "node_modules", "docs"]) {
  if (published.includes(forbidden)) errors.push(`forbidden static entry: ${forbidden}`);
}

if (errors.length) {
  console.error(`Release verification failed for ${target}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Release OK: ${info.version} ${info.commit} (${info.assetDirectory})`);
}
