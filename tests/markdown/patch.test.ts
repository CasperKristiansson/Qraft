import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { QACommand } from "../../src/domain/commands";
import { QraftError } from "../../src/domain/validation";
import type { IdFactory } from "../../src/markdown/ids";
import { patchMarkdown } from "../../src/markdown/patch";
import { parseMarkdown } from "../../src/markdown/parse";

const stable = {
  section: "section_11111111-1111-4111-8111-111111111111",
  task: "task_22222222-2222-4222-8222-222222222222",
  finding: "finding_33333333-3333-4333-8333-333333333333",
};

const created = {
  section: "section_44444444-4444-4444-8444-444444444444",
  task: "task_55555555-5555-4555-8555-555555555555",
  note: "note_66666666-6666-4666-8666-666666666666",
  finding: "finding_77777777-7777-4777-8777-777777777777",
  lazySection: "section_88888888-8888-4888-8888-888888888888",
  lazyTask: "task_99999999-9999-4999-8999-999999999999",
  lazyFinding: "finding_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

const golden = (name: string) => readFile(resolve(import.meta.dirname, "../fixtures/golden", name), "utf8");

function ids(...values: string[]): IdFactory {
  let index = 0;
  return () => {
    const id = values[index];
    if (!id) throw new Error("Unexpected ID allocation");
    index += 1;
    return id;
  };
}

async function expectGolden(
  beforeName: string,
  afterName: string,
  command: QACommand,
  idFactory: IdFactory,
): Promise<void> {
  const before = await golden(beforeName);
  const after = await golden(afterName);
  expect(patchMarkdown(parseMarkdown(before), command, { idFactory, root: "/project" })).toBe(after);
}

describe("minimal Markdown patches", () => {
  it("creates a section with escaped normalized text", () =>
    expectGolden(
      "stable.before.md",
      "create-section.after.md",
      { type: "createSection", title: "  Extra <section>  " },
      ids(created.section),
    ));

  it("creates a task at the section boundary", () =>
    expectGolden(
      "stable.before.md",
      "create-task.after.md",
      { type: "createTask", sectionId: stable.section, title: "Added task" },
      ids(created.task),
    ));

  it("reopens a task by touching only its marker", () =>
    expectGolden(
      "set-task.before.md",
      "set-task.after.md",
      { type: "setTaskChecked", taskId: stable.task, checked: false },
      ids(),
    ));

  it("adds a note at the task boundary", () =>
    expectGolden(
      "stable.before.md",
      "add-note.after.md",
      { type: "addNote", taskId: stable.task, body: "Added\n note" },
      ids(created.note),
    ));

  it("adds a finding with only normalized approved metadata", () =>
    expectGolden(
      "stable.before.md",
      "add-finding.after.md",
      {
        type: "addFinding",
        taskId: stable.task,
        body: "Alignment jumps",
        element: {
          route: "/checkout?secret=yes#hash",
          component: "Quantity`Selector",
          source: "src\\components\\Quantity.tsx",
          line: 8,
          column: 3,
          selector: ".quantity",
        },
      },
      ids(created.finding),
    ));

  it("resolves a finding by touching only its marker", () =>
    expectGolden(
      "stable.before.md",
      "set-finding.after.md",
      { type: "setFindingChecked", findingId: stable.finding, checked: true },
      ids(),
    ));

  it.each([
    [
      "create task in a legacy section",
      "legacy.before.md",
      "legacy-create-task.after.md",
      { type: "createTask", sectionId: "TARGET_SECTION", title: "Added task" } as QACommand,
      [created.lazySection, created.task],
    ],
    [
      "set a legacy task status",
      "legacy-set-task.before.md",
      "legacy-set-task.after.md",
      { type: "setTaskChecked", taskId: "TARGET_TASK", checked: false } as QACommand,
      [created.lazyTask],
    ],
    [
      "add a note to a legacy task",
      "legacy.before.md",
      "legacy-add-note.after.md",
      { type: "addNote", taskId: "TARGET_TASK", body: "Added note" } as QACommand,
      [created.lazyTask, created.note],
    ],
    [
      "add a finding to a legacy task",
      "legacy.before.md",
      "legacy-add-finding.after.md",
      { type: "addFinding", taskId: "TARGET_TASK", body: "Added finding", element: null } as QACommand,
      [created.lazyTask, created.finding],
    ],
    [
      "set a legacy finding status",
      "legacy.before.md",
      "legacy-set-finding.after.md",
      { type: "setFindingChecked", findingId: "TARGET_FINDING", checked: true } as QACommand,
      [created.lazyFinding],
    ],
  ])("assigns a stable ID only when asked to %s", async (_label, beforeName, afterName, command, allocated) => {
    const before = await golden(beforeName);
    const parsed = parseMarkdown(before);
    const targetTask = parsed.document.sections[0]?.tasks[0];
    const targetFinding = targetTask?.findings[0];
    const resolvedCommand =
      command.type === "createTask"
        ? { ...command, sectionId: parsed.document.sections[0]?.id ?? "" }
        : command.type === "setFindingChecked"
          ? { ...command, findingId: targetFinding?.id ?? "" }
          : "taskId" in command
            ? { ...command, taskId: targetTask?.id ?? "" }
            : command;
    expect(patchMarkdown(parsed, resolvedCommand, { idFactory: ids(...allocated), root: "/project" })).toBe(
      await golden(afterName),
    );
  });

  it("rejects passing a task with an unresolved finding", async () => {
    const parsed = parseMarkdown(await golden("stable.before.md"));
    expect(() => patchMarkdown(parsed, { type: "setTaskChecked", taskId: stable.task, checked: true })).toThrowError(
      new QraftError("validation", "Resolve outstanding findings before passing this task."),
    );
  });

  it("omits a source path outside the project root and preserves final-newline style", () => {
    const before = "## Main <!-- qraft:id=section_11111111-1111-4111-8111-111111111111 -->\r\n\r\n- [ ] Task <!-- qraft:id=task_22222222-2222-4222-8222-222222222222 -->";
    const result = patchMarkdown(
      parseMarkdown(before),
      {
        type: "addFinding",
        taskId: stable.task,
        body: "Outside source",
        element: { route: "/route?query", component: null, source: "../secret.ts", line: 1, column: 2, selector: null },
      },
      { idFactory: ids(created.finding), root: "/project" },
    );
    expect(result).not.toContain("secret.ts");
    expect(result).toContain("\r\n  - [ ] Outside source");
    expect(result.endsWith("\r\n")).toBe(false);
  });
});
