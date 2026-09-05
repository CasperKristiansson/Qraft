import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { afterEach, describe, expect, it } from "vitest";
import type { QACommand } from "../../src/domain/commands";
import { QraftError } from "../../src/domain/validation";
import { EMPTY_REVISION, sha256 } from "../../src/markdown/parse";
import { MarkdownDocumentStore, type StoreConflict } from "../../src/markdown/store";

const directories: string[] = [];

async function temporaryFile(initial?: string) {
  const directory = await mkdtemp(join(tmpdir(), "qraft-store-"));
  directories.push(directory);
  const file = join(directory, "QA.md");
  if (initial !== undefined) await writeFile(file, initial, "utf8");
  return { directory, file };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function deterministicIds() {
  let count = 0;
  return (kind: "section" | "task" | "note" | "finding") => {
    count += 1;
    return `${kind}_00000000-0000-4000-8000-${String(count).padStart(12, "0")}`;
  };
}

describe("MarkdownDocumentStore", () => {
  it("reads a missing file as empty without creating it, then executes every command through the real queue", async () => {
    const { file, directory } = await temporaryFile();
    const store = new MarkdownDocumentStore(file, directory, { idFactory: deterministicIds() });
    const empty = await store.read();
    expect(empty.revision).toBe(EMPTY_REVISION);
    await expect(stat(file)).rejects.toMatchObject({ code: "ENOENT" });

    let document = await store.execute({ type: "createSection", title: "Main" }, empty.revision);
    const section = document.sections[0]!;
    document = await store.execute({ type: "createTask", sectionId: section.id, title: "Task" }, document.revision);
    const task = document.sections[0]!.tasks[0]!;
    document = await store.execute({ type: "addNote", taskId: task.id, body: "Note" }, document.revision);
    document = await store.execute(
      { type: "addFinding", taskId: task.id, body: "Finding", element: null },
      document.revision,
    );
    const finding = document.sections[0]!.tasks[0]!.findings[0]!;
    document = await store.execute(
      { type: "setFindingChecked", findingId: finding.id, checked: true },
      document.revision,
    );
    document = await store.execute({ type: "setTaskChecked", taskId: task.id, checked: true }, document.revision);
    document = await store.execute({ type: "setTaskChecked", taskId: task.id, checked: false }, document.revision);

    const exact = await readFile(file);
    expect(document.revision).toBe(sha256(exact));
    expect(exact.toString("utf8")).toBe(
      "## Main <!-- qraft:id=section_00000000-0000-4000-8000-000000000001 -->\n" +
        "- [ ] Task <!-- qraft:id=task_00000000-0000-4000-8000-000000000002 -->\n" +
        "  - Note: Note <!-- qraft:id=note_00000000-0000-4000-8000-000000000003 -->\n" +
        "  - [x] Finding <!-- qraft:id=finding_00000000-0000-4000-8000-000000000004 -->",
    );
  });

  it("rejects a stale base revision without writing and includes the latest document", async () => {
    const initial = "# QA\n\n## Main\n";
    const { file, directory } = await temporaryFile(initial);
    const store = new MarkdownDocumentStore(file, directory, { idFactory: deterministicIds() });
    let caught: StoreConflict | undefined;
    try {
      await store.execute({ type: "createSection", title: "Nope" }, EMPTY_REVISION);
    } catch (error) {
      caught = error as StoreConflict;
    }
    expect(caught).toMatchObject({ code: "conflict", retryable: true });
    expect(caught?.document?.revision).toBe(sha256(initial));
    expect(await readFile(file, "utf8")).toBe(initial);
  });

  it("detects an external edit immediately before commit and preserves it", async () => {
    const initial = "# QA\n";
    const external = "# QA\n\nExternal editor text.\n";
    const { file, directory } = await temporaryFile(initial);
    const store = new MarkdownDocumentStore(file, directory, {
      idFactory: deterministicIds(),
      beforeCommitCheck: () => writeFile(file, external, "utf8"),
    });
    await expect(store.execute({ type: "createSection", title: "Nope" }, sha256(initial))).rejects.toMatchObject({
      code: "conflict",
    });
    expect(await readFile(file, "utf8")).toBe(external);
  });

  it("serializes concurrent same-revision commands so one succeeds and one conflicts without lost data", async () => {
    const initial = "# QA\n";
    const { file, directory } = await temporaryFile(initial);
    const store = new MarkdownDocumentStore(file, directory, { idFactory: deterministicIds() });
    const commands: QACommand[] = [
      { type: "createSection", title: "First" },
      { type: "createSection", title: "Second" },
    ];
    const results = await Promise.allSettled(commands.map((command) => store.execute(command, sha256(initial))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const source = await readFile(file, "utf8");
    expect(source).toContain("## First");
    expect(source).not.toContain("## Second");
  });

  it("preserves file mode through the pinned atomic adapter", async () => {
    const initial = "# QA\n";
    const { file, directory } = await temporaryFile(initial);
    await chmod(file, 0o640);
    const store = new MarkdownDocumentStore(file, directory, { idFactory: deterministicIds() });
    await store.execute({ type: "createSection", title: "Main" }, sha256(initial));
    expect((await stat(file)).mode & 0o777).toBe(0o640);
  });

  it("leaves the original intact when the atomic adapter fails", async () => {
    const initial = "# QA\n";
    const { file, directory } = await temporaryFile(initial);
    const store = new MarkdownDocumentStore(file, directory, {
      idFactory: deterministicIds(),
      atomicWrite: async () => {
        throw new Error("injected write failure");
      },
    });
    await expect(store.execute({ type: "createSection", title: "Main" }, sha256(initial))).rejects.toEqual(
      new QraftError("io", "Qraft could not save the QA file. The original was left unchanged.", true),
    );
    expect(await readFile(file, "utf8")).toBe(initial);
  });

  it("proves the pinned adapter removes a sibling temp file after an injected failure", async () => {
    const initial = "original";
    const { file, directory } = await temporaryFile(initial);
    await expect(
      writeFileAtomic(file, "replacement", {
        tmpfileCreated() {
          throw new Error("injected after temp creation");
        },
      }),
    ).rejects.toThrow("injected after temp creation");
    expect(await readFile(file, "utf8")).toBe(initial);
    expect(await readdir(directory)).toEqual(["QA.md"]);
  });

  it("rejects duplicate targets and invalid command shapes without writing", async () => {
    const duplicate =
      "## Main <!-- qraft:id=section_11111111-1111-4111-8111-111111111111 -->\n" +
      "- [ ] A <!-- qraft:id=task_22222222-2222-4222-8222-222222222222 -->\n" +
      "- [ ] B <!-- qraft:id=task_22222222-2222-4222-8222-222222222222 -->\n";
    const { file, directory } = await temporaryFile(duplicate);
    const store = new MarkdownDocumentStore(file, directory);
    await expect(
      store.execute(
        { type: "setTaskChecked", taskId: "task_22222222-2222-4222-8222-222222222222", checked: true },
        sha256(duplicate),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      store.execute({ type: "createSection", title: "" }, sha256(duplicate)),
    ).rejects.toMatchObject({ code: "validation" });
    expect(await readFile(file, "utf8")).toBe(duplicate);
  });
});
