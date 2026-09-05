import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["src", "tests", "examples", "docs"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css", ".html"]);
const failures = [];

async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await visit(child);
    else if (extensions.has(extname(entry.name))) {
      const text = await readFile(child, "utf8");
      if (/[^\S\r\n]+$/mu.test(text)) failures.push(`${child}: trailing whitespace`);
      if (text.includes("\r\n") && extname(entry.name) !== ".md") failures.push(`${child}: unexpected CRLF`);
    }
  }
}

for (const root of roots) await visit(root);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
