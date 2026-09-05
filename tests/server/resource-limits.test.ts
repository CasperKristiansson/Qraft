import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createProject } from "../../src/server/project";

const cleanups: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
  cleanups.length = 0;
});

it("evicts idle watchers and refuses more files while all 32 reviews are active", async () => {
  const root = await mkdtemp(join(tmpdir(), "qraft-limits-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 34 }, (_, i) => writeFile(join(root, `${i}.md`), "# QA\n")),
  );
  let watched = 0;
  let disposed = 0;
  const project = await createProject({
    root,
    watch: () => {
      watched++;
      return () => {
        disposed++;
      };
    },
  });
  cleanups.push(() => project.dispose());
  const get = (path: string) => project.handle(new Request(`http://localhost/__qraft/${path}`));
  const catalog = await (await get("files"))!.json();
  for (const file of catalog.files)
    expect((await get(`files/${file.id}/document`))!.status).toBe(200);
  expect(watched - disposed).toBe(32);
  for (const file of catalog.files.slice(0, 32)) {
    const response = await get(`files/${file.id}/events`);
    expect(response!.status).toBe(200);
    cleanups.push(() => response!.body!.cancel());
  }
  expect((await get(`files/${catalog.files[32].id}/document`))!.status).toBe(503);
});

it("invalidates failed reads and notifies when the same bytes become readable again", async () => {
  const root = await mkdtemp(join(tmpdir(), "qraft-watcher-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "QA.md");
  await writeFile(file, "# QA\n");
  let changed = () => {};
  const project = await createProject({
    root,
    file: "QA.md",
    watch: (_, callback) => {
      changed = callback;
      return () => {};
    },
  });
  cleanups.push(() => project.dispose());
  const get = (path: string) => project.handle(new Request(`http://localhost/__qraft/${path}`));
  const response = await get("events");
  const reader = response!.body!.getReader();
  await reader.read();
  const nextEvent = async () => {
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Missing invalidation")), 2000).unref(),
      ),
    ]);
    return new TextDecoder().decode(result.value);
  };
  changed();
  expect(await nextEvent()).toContain("document-changed");
  await writeFile(file, Buffer.from([0xff]));
  changed();
  expect(await nextEvent()).toContain("document-unavailable");
  expect((await get("document"))!.status).toBe(400);
  await writeFile(file, "# QA\n");
  changed();
  expect(await nextEvent()).toContain("document-changed");
  expect((await get("document"))!.status).toBe(200);
});
