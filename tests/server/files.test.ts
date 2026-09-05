import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { it, expect } from "vitest";
import { FileCatalog } from "../../src/server/files";
import { MarkdownDocumentStore } from "../../src/markdown/store";
import { sha256 } from "../../src/markdown/parse";

it("excludes hidden/dependency/symlink paths and revalidates a replaced chosen file", async () => {
  const parent = await mkdtemp(join(tmpdir(), "qraft-files-"));
  try {
    const root = join(parent, "project");
    await mkdir(root);
    const outside = join(parent, "secret.md");
    await writeFile(outside, "outside bytes");
    for (const directory of ["docs", ".hidden", "node_modules", "dist"]) {
      await mkdir(join(root, directory));
      await writeFile(join(root, directory, "Review.md"), "## Section\n");
    }
    await symlink(outside, join(root, "link.md"));
    await symlink(parent, join(root, "linked-directory"));
    const catalog = new FileCatalog(root);
    const first = await catalog.list();
    expect(first.files.map((file) => file.label)).toEqual(["docs/Review.md"]);
    expect((await new FileCatalog(root).list()).files).toEqual(first.files);
    const chosen = catalog.paths.get(first.files[0]!.id)!;
    const store = new MarkdownDocumentStore(chosen, root);
    const initial = await store.read();
    await rm(chosen);
    await symlink(outside, chosen);
    await expect(store.read()).rejects.toMatchObject({ code: "io" });
    await expect(
      store.execute({ type: "createSection", title: "Escape" }, initial.revision),
    ).rejects.toMatchObject({ code: "io" });
    expect(await readFile(outside, "utf8")).toBe("outside bytes");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

it("rejects a symlink substitution at the final revision check", async () => {
  const root = await mkdtemp(join(tmpdir(), "qraft-path-race-"));
  try {
    const file = join(root, "Review.md");
    const victim = join(root, "Other.md");
    await writeFile(file, "# Review\n");
    await writeFile(victim, "owner data");
    const store = new MarkdownDocumentStore(file, root, {
      beforeCommitCheck: async () => {
        await rm(file);
        await symlink(victim, file);
      },
    });
    await expect(
      store.execute({ type: "createSection", title: "Added" }, sha256("# Review\n")),
    ).rejects.toMatchObject({ code: "io" });
    expect(await readFile(victim, "utf8")).toBe("owner data");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
