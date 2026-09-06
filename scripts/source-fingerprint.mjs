import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Generated outputs, local data and credentials are not source inputs.
const excluded = new Set([
  "node_modules",
  "dist",
  ".git",
  ".agents",
  ".codex",
  "artifacts",
  "test-results",
  "playwright-report",
  "coverage",
  ".pnpm-store",
  "QA.local.md",
  "review.local.md",
  ".DS_Store",
]);
export async function sourceFingerprint(root = process.cwd()) {
  const files = [];
  async function visit(directory = "") {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.name.startsWith(".env") || excluded.has(entry.name)) continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && !/\.(tgz|tsbuildinfo)$/u.test(path)) {
        const bytes = await readFile(join(root, path));
        files.push({
          path,
          mode: (await stat(join(root, path))).mode & 0o777,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  }
  await visit();
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { fingerprint: createHash("sha256").update(JSON.stringify(files)).digest("hex"), files };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await sourceFingerprint(), null, 2));
