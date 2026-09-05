import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { inspectProject, setupInstructions } from "../../src/setup/inspect";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
  roots.length = 0;
});

it("inspects a Next workspace and preserves configs, review bytes and locks", async () => {
  const root = await mkdtemp(join(tmpdir(), "qraft-doctor-"));
  roots.push(root);
  await mkdir(join(root, "src/app"), { recursive: true });
  const files = {
    "package.json": JSON.stringify({
      packageManager: "pnpm@11.25.0",
      dependencies: { next: "16.3.3" },
    }),
    "QA.md": "# Review\r\n",
    "QA.md.qraft.lock": JSON.stringify({ pid: process.pid }),
    "next.config.ts": "throw new Error('must not execute');\n",
  };
  for (const [name, body] of Object.entries(files)) await writeFile(join(root, name), body);
  await symlink("/etc", join(root, "outside"));
  const report = await inspectProject(root);
  expect(report.framework).toBe("next");
  expect(report.appDirectory).toBe("src/app");
  expect(report.checks.some((check) => check.message.includes(`PID ${process.pid}`))).toBe(true);
  expect(setupInstructions(report)).toContain("src/app/api/qraft/[...qraft]/route.ts");
  expect(setupInstructions(report)).toContain("process.env.NODE_ENV === 'development'");
  for (const [name, body] of Object.entries(files))
    expect(await readFile(join(root, name), "utf8")).toBe(body);
});

it("prints Vite setup/removal without changing host dependencies or choosing a file", async () => {
  const root = await mkdtemp(join(tmpdir(), "qraft-setup-"));
  roots.push(root);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ devDependencies: { vite: "7.3.6" } }),
  );
  const instructions = setupInstructions(await inspectProject(root));
  expect(instructions).toContain("import.meta.env.DEV");
  expect(instructions).toContain("Removal:");
  expect(instructions).toContain("never selects a filename implicitly");
  await expect(readFile(join(root, "QA.md"))).rejects.toMatchObject({ code: "ENOENT" });
});
