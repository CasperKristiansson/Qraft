import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { QACommand } from "../../src/domain/commands";
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
  const allocated: string[] = [];
  expect(patchMarkdown(parseMarkdown(before), command, { idFactory: (kind) => { const id = idFactory(kind); allocated.push(id); return id; }, root: "/project" })).toBe(after);
  for (const newline of ["\n", "\r\n"]) for (const final of [true, false]) {
    const variant = (source: string) => (final ? source : source.replace(/\n$/u, "")).replaceAll("\n", newline);
    expect(patchMarkdown(parseMarkdown(variant(before)), command, { idFactory: ids(...allocated), root: "/project" })).toBe(variant(after));
  }
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

  it("adds an attached note with only normalized approved metadata", () =>
    expectGolden(
      "stable.before.md",
      "add-attached-note.after.md",
      {
        type: "addNote",
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
      ids(created.note),
    ));

  it("edits a legacy checkbox note without changing its marker", () =>
    expectGolden(
      "stable.before.md",
      "edit-legacy-note.after.md",
      { type: "editNote", noteId: stable.finding, body: "Edited legacy observation" },
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
      "add an attached note to a legacy task",
      "legacy.before.md",
      "legacy-add-attached-note.after.md",
      { type: "addNote", taskId: "TARGET_TASK", body: "Added finding", element: null } as QACommand,
      [created.lazyTask, created.note],
    ],
    [
      "edit a legacy checkbox note",
      "legacy.before.md",
      "legacy-edit-note.after.md",
      { type: "editNote", noteId: "TARGET_FINDING", body: "Edited legacy observation" } as QACommand,
      [created.lazyFinding],
    ],
  ])("assigns a stable ID only when asked to %s", async (_label, beforeName, afterName, command, allocated) => {
    const before = await golden(beforeName);
    const parsed = parseMarkdown(before);
    const targetTask = parsed.document.sections[0]?.tasks[0];
    const targetFinding = targetTask?.notes[0];
    const resolvedCommand =
      command.type === "createTask"
        ? { ...command, sectionId: parsed.document.sections[0]?.id ?? "" }
        : command.type === "editNote"
          ? { ...command, noteId: targetFinding?.id ?? "" }
          : "taskId" in command
            ? { ...command, taskId: targetTask?.id ?? "" }
            : command;
    expect(patchMarkdown(parsed, resolvedCommand, { idFactory: ids(...allocated), root: "/project" })).toBe(
      await golden(afterName),
    );
  });

  it("completes a task independently of legacy note markers", async () => {
    const before = await golden("stable.before.md");
    expect(patchMarkdown(parseMarkdown(before), { type: "setTaskStatus", taskId: stable.task, status: "completed" })).toBe(before.replace("- [ ] Task", "- [x] Task"));
  });

  it("omits a source path outside the project root and preserves final-newline style", () => {
    const before = "## Main <!-- qraft:id=section_11111111-1111-4111-8111-111111111111 -->\r\n\r\n- [ ] Task <!-- qraft:id=task_22222222-2222-4222-8222-222222222222 -->";
    const result = patchMarkdown(
      parseMarkdown(before),
      {
        type: "addNote",
        taskId: stable.task,
        body: "Outside source",
        element: { route: "/route?query", component: null, source: "../secret.ts", line: 1, column: 2, selector: null },
      },
      { idFactory: ids(created.note), root: "/project" },
    );
    expect(result).not.toContain("secret.ts");
    expect(result).toContain("\r\n  - Note: Outside source");
    expect(result.endsWith("\r\n")).toBe(false);
  });
  it("uses the first newline for insertions and preserves all existing mixed bytes", () => {
    const before = "## Main\n\n- [ ] Task\r\n\r\nUnknown owner text.\r\n";
    expect(patchMarkdown(parseMarkdown(before), { type: "createSection", title: "More" }, { idFactory: ids(created.section) })).toBe(
      before + "\n## More <!-- qraft:id=" + created.section + " -->\n",
    );
  });

  it("does not expose tasks inside longer fences and rejects ambiguous identity", () => {
    const before = "## Main\n````md\n```\n- [ ] Example\n````\n- [ ] Real\n";
    const parsed = parseMarkdown(before);
    expect(parsed.document.sections[0]?.tasks.map((task) => task.title)).toEqual(["Real"]);
    const task = parsed.document.sections[0]!.tasks[0]!;
    expect(patchMarkdown(parsed, { type: "setTaskChecked", taskId: task.id, checked: true }, { idFactory: ids(created.task) })).toBe(
      "## Main\n````md\n```\n- [ ] Example\n````\n- [x] Real <!-- qraft:id=" + created.task + " -->\n",
    );
    const ambiguous = parseMarkdown("## Main\n- [ ] Task <!-- qraft:id=" + stable.task + " --> <!-- qraft:id=" + created.task + " -->\n");
    expect(() => patchMarkdown(ambiguous, { type: "setTaskChecked", taskId: ambiguous.document.sections[0]!.tasks[0]!.id, checked: true })).toThrow("duplicate ID");
  });

});

it.each(["\n", "\r\n"])("skips and reopens by one marker, preserving all bytes with %j", (newline) => {
  for (const final of ["", newline]) {
    const before = "\uFEFF## Main" + newline + "- [X] Task <!-- qraft:id=" + stable.task + " -->" + newline + "  - [ ] Legacy child" + newline + "    - Unknown: `stay`" + final;
    const skipped = patchMarkdown(parseMarkdown(before), { type: "setTaskStatus", taskId: stable.task, status: "skipped" });
    expect(skipped).toBe(before.replace("- [X] Task", "- [-] Task"));
    expect(parseMarkdown(skipped).document.sections[0]!.tasks[0]!.status).toBe("skipped");
    expect(patchMarkdown(parseMarkdown(skipped), { type: "setTaskStatus", taskId: stable.task, status: "open" })).toBe(before.replace("- [X] Task", "- [ ] Task"));
  }
});

it.each(["\n", "\r\n"])("edits only a note body and preserves attachment and unknown bytes with %j", (newline) => {
  for (const final of ["", newline]) for (const prefix of ["  - Note: ", "  - [X] "]) {
    const noteId = prefix.includes("Note") ? created.note : stable.finding;
    const before = ["\uFEFF## Main", "- [ ] Task", prefix + "Original body  <!-- qraft:id=" + noteId + " -->  ", "    - Source: `src/App.tsx:12:3`", "    - Context: `{" + '"tag":"button","attributes":{"data-testid":"save"},"text":"Save","ancestors":["form#cart"]' + "}`", "    - Owner: `preserve this`", "", "<!-- untouched -->"].join(newline) + final;
    const after = patchMarkdown(parseMarkdown(before), { type: "editNote", noteId, body: "  Edited\n observation  " });
    expect(after).toBe(before.replace("Original body", "Edited observation"));
    expect(parseMarkdown(after).document.sections[0]!.tasks[0]!.notes[0]!.element?.context?.attributes).toEqual({ "data-testid": "save" });
  }
});

it("adds bounded identifying context to a canonical note with an exact full-file patch", () => {
  const before = "## Main\n- [ ] Task <!-- qraft:id=" + stable.task + " -->\n\nOwner text.\n";
  const element = { route: "/cart?private=yes", component: null, source: null, line: null, column: null, selector: "#save", context: { tag: "button", attributes: { id: "save" }, text: "Save", ancestors: ["form#cart"] } };
  const after = patchMarkdown(parseMarkdown(before), { type: "addNote", taskId: stable.task, body: "Move this", element }, { idFactory: ids(created.note) });
  expect(after).toBe(before + "  - Note: Move this <!-- qraft:id=" + created.note + " -->\n    - Route: `/cart`\n    - Selector: `#save`\n    - Context: `" + JSON.stringify(element.context) + "`\n");
});

it.each(["\n", "\r\n"])("round-trips source trails and edits only note text with %j", (newline) => {
  for (const final of [true, false]) {
    const context = { tag: "button", attributes: { id: "save" }, text: "Save", ancestors: ["form#cart"], sourceTrail: [{ component: "Checkout", source: "src/Checkout.tsx", line: 18, column: 3 }] };
    const before = ["\uFEFF# Review", "## Cart", "- [ ] Task <!-- qraft:id=" + stable.task + " -->", "", "Owner text with `unknown` bytes."].join(newline) + (final ? newline : "");
    const element = { route: "/cart", component: null, source: null, line: null, column: null, selector: "#save", context: { ...context, sourceTrail: [{ ...context.sourceTrail[0]!, source: "/project/src/Checkout.tsx?private=yes" }] } };
    const appended = ["  - Note: Move this <!-- qraft:id=" + created.note + " -->", "    - Route: `/cart`", "    - Selector: `#save`", "    - Context: `" + JSON.stringify(context) + "`"].join(newline);
    const after = patchMarkdown(parseMarkdown(before), { type: "addNote", taskId: stable.task, body: "Move this", element }, { idFactory: ids(created.note), root: "/project" });
    expect(after).toBe(before + (final ? "" : newline) + appended + (final ? newline : ""));
    expect(parseMarkdown(after).document.sections[0]!.tasks[0]!.notes[0]!.element?.context).toEqual(context);
    expect(patchMarkdown(parseMarkdown(after), { type: "editNote", noteId: created.note, body: "Move this left" })).toBe(after.replace("Note: Move this <!--", "Note: Move this left <!--"));
  }
});
