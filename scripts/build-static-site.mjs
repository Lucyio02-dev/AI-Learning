import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
if (output !== resolve(root, "dist") || !output.startsWith(`${root}${sep}`)) {
  throw new Error("Static output must remain in the repository's dist directory.");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of [".nojekyll", "index.html", "app.js", "styles.css", "site.webmanifest"]) {
  await cp(resolve(root, file), resolve(output, file));
}
await cp(resolve(root, "src"), resolve(output, "src"), { recursive: true });
console.log(`Static site prepared: ${output}`);
