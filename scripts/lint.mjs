import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const failures = [];
async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await visit(child);
    else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      const text = await readFile(child, "utf8");
      if (text.includes("dangerouslySetInnerHTML")) failures.push(`${child}: raw HTML rendering is forbidden`);
      if (/from ["'](?:node:)?(?:fs|path|crypto)["']/.test(text) && child.startsWith("src/client")) {
        failures.push(`${child}: browser code imports a server module`);
      }
    }
  }
}
await visit("src");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
