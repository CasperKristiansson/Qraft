import { readFile, readdir } from "node:fs/promises";
import { builtinModules } from "node:module";
import { dirname, extname, join, resolve } from "node:path";

const failures = [];
const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

function inspectImport(file, specifier) {
  const resolved = resolve(dirname(file), specifier);
  const serverImport = specifier.startsWith("node:") || builtins.has(specifier);
  if (
    file.startsWith("src/client/") &&
    (serverImport || /\/src\/(markdown|server|setup)\//u.test(resolved))
  ) {
    failures.push(`${file}: browser code imports server module ${specifier}`);
  }
  if (
    file.startsWith("src/domain/") &&
    (serverImport ||
      /^(react|react-dom|vite|next)(\/|$)/u.test(specifier) ||
      /\/src\/(client|markdown|server|setup)\//u.test(resolved))
  ) {
    failures.push(`${file}: domain code imports platform module ${specifier}`);
  }
}

async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
      continue;
    }
    if (![".ts", ".tsx"].includes(extname(file))) continue;

    const text = await readFile(file, "utf8");
    if (/\bdangerouslySetInnerHTML\b/u.test(text))
      failures.push(`${file}: raw HTML rendering is forbidden`);
    // Scan static imports/re-exports and literal dynamic imports. Typescript checks
    // syntax; this deliberately small gate enforces Qraft's layer ownership.
    const imports = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/gu;
    for (const match of text.matchAll(imports)) inspectImport(file, match[1]);
  }
}

await visit("src");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
