import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { seedFirstReview } from "../../examples/vite-react/first-review";
import { parseMarkdown } from "../../src/markdown/parse";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("renders every guide example as unchecked tasks with visible instructions", async () => {
  const guide = await readFile("skills/qraft-review/SKILL.md", "utf8");
  const examples = [...guide.matchAll(/```md\n([\s\S]*?)```/gu)];
  expect(examples.length).toBeGreaterThan(0);

  for (const example of examples) {
    const { document, source } = parseMarkdown(example[1]!);
    expect(source).toBe(example[1]);
    expect(document.diagnostics).toEqual([]);
    const tasks = document.sections.flatMap((section) => section.tasks);
    expect(tasks.length).toBeGreaterThan(0);

    for (const task of tasks) {
      expect(task.status).toBe("open");
      expect(task.instructions?.trim().length).toBeGreaterThan(0);
      expect(task.notes).toEqual([]);
    }
  }
});

it.each(["README.md", "docs/creating-checklists.md"])(
  "keeps the first task's instructions visible when copied from %s",
  async (path) => {
    const text = await readFile(path, "utf8");
    const example = text.match(/```md\n([\s\S]*?)```/u);
    expect(example).not.toBeNull();
    const { document } = parseMarkdown(example![1]!);
    expect(document.diagnostics).toEqual([]);
    expect(document.sections[0]?.tasks[0]?.instructions?.trim().length).toBeGreaterThan(0);
  },
);

it("seeds five usable checks once and preserves review bytes on restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "qraft-first-review-"));
  roots.push(root);
  await copyFile("examples/vite-react/first-review.md", join(root, "first-review.md"));
  await seedFirstReview(root);
  const initial = await readFile(join(root, "review.local.md"), "utf8");
  const { document } = parseMarkdown(initial);
  expect(document.diagnostics).toEqual([]);
  const tasks = document.sections.flatMap((section) => section.tasks);
  expect(tasks).toHaveLength(5);
  expect(tasks.every((task) => task.status === "open" && task.instructions)).toBe(true);

  const reviewed = Buffer.from("\uFEFF# My review\r\n\r\n- [x] Keep this\r\n  - Note: Feedback");
  await writeFile(join(root, "review.local.md"), reviewed);
  await Promise.all([seedFirstReview(root), seedFirstReview(root)]);
  expect(await readFile(join(root, "review.local.md"))).toEqual(reviewed);
  expect((await readdir(root)).sort()).toEqual(["first-review.md", "review.local.md"]);
});

it("reports a missing seed instead of silently creating an empty review", async () => {
  const root = await mkdtemp(join(tmpdir(), "qraft-missing-seed-"));
  roots.push(root);
  await expect(seedFirstReview(root)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readdir(root)).toEqual([]);
});
