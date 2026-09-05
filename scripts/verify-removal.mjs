import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/** Remove Qraft only in a fresh copy of our generated consumer fixture. */
export async function verifyRemoval(consumer, framework, run) {
  const root = await mkdtemp(join(tmpdir(), `qraft-remove-${framework}-`));
  const excluded = new Set(["node_modules", "dist", ".next", "pnpm-lock.yaml"]);
  await cp(consumer, root, {
    recursive: true,
    filter: (path) => !excluded.has(basename(path)) && !path.endsWith(".tgz"),
  });
  const before = await readFile(join(root, "QA.md"));
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  delete manifest.dependencies["@qraft/qa"];
  await writeFile(join(root, "package.json"), JSON.stringify(manifest, null, 2) + "\n");

  if (framework === "vite") {
    const config = join(root, "vite.config.ts");
    await writeFile(
      config,
      (await readFile(config, "utf8"))
        .replace('import { qraft } from "@qraft/qa/vite";\n', "")
        .replace(", qraft()", ""),
    );
    const entry = join(root, "src/main.tsx");
    await writeFile(
      entry,
      (await readFile(entry, "utf8"))
        .replace('import { QA } from "@qraft/qa";\n', "")
        .replace("{import.meta.env.DEV ? <QA /> : null}", ""),
    );
  } else {
    await rm(join(root, "app/api/qraft"), { recursive: true });
    const layout = join(root, "app/layout.tsx");
    await writeFile(
      layout,
      (await readFile(layout, "utf8"))
        .replace(/^  const QA = .*\n/mu, "")
        .replace('{QA ? <QA endpoint="/review/api/qraft" editor="manual" /> : null}', ""),
    );
  }
  run(["install"], root);
  run(
    framework === "vite"
      ? ["build"]
      : [
          "exec",
          "next",
          "build",
          ...(manifest.dependencies.next.startsWith("16.") ? ["--webpack"] : []),
        ],
    root,
  );
  if (!(await readFile(join(root, "QA.md"))).equals(before))
    throw new Error("Removal changed review Markdown.");
  try {
    await readFile(join(root, "node_modules/@qraft/qa/package.json"));
    throw new Error("Removal retained the Qraft dependency.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { root, dependencyAbsent: true, build: true, markdownPreserved: true };
}
