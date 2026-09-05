import { describe, expect, it } from "vitest";
import { qaCommandSchema } from "../../src/domain/commands";
import { parseMarkdown } from "../../src/markdown/parse";
import { patchMarkdown } from "../../src/markdown/patch";

const taskId = "task_11111111-1111-4111-8111-111111111111";
const noteId = "note_22222222-2222-4222-8222-222222222222";
const before =
  "# Review\n\n- [ ] Try keyboard\n  Press Tab, then Enter.\n  Check the focus ring.\n\n## Later\n\nKeep this paragraph.\n";
const observation = {
  route: "/checkout?private=yes#secret",
  viewport: { width: 390, height: 844 },
};

describe("ordinary review checklists", () => {
  it("reads instructions without treating fenced or nested checks as tasks", () => {
    const source =
      before +
      "\n- [ ] More\n  Do this first.\n\n  Then this.\n    - [ ] Nested\n\n```md\n- [ ] Example\n```\n";
    const parsed = parseMarkdown(source);
    expect(parsed.source).toBe(source);
    expect(parsed.document.sections[0]?.tasks[0]?.instructions).toBe(
      "Press Tab, then Enter.\nCheck the focus ring.",
    );
    expect(parsed.document.sections[1]?.tasks).toHaveLength(1);
    expect(parsed.document.sections[1]?.tasks[0]?.instructions).toBe(
      "Do this first.\n\nThen this.",
    );
    expect(parsed.document.diagnostics.map((item) => item.code)).toEqual(["invalid-nesting"]);
  });

  for (const newline of ["\n", "\r\n"]) {
    for (const bom of ["", "\uFEFF"]) {
      for (const final of [true, false]) {
        const variant = (value: string) =>
          bom + (final ? value : value.replace(/\n$/u, "")).replaceAll("\n", newline);
        it(`preserves the full file for implicit-section mutations (${JSON.stringify({ newline, bom, final })})`, () => {
          const source = variant(before);
          const parsed = parseMarkdown(source);
          const task = parsed.document.sections[0]!.tasks[0]!;
          const marked = patchMarkdown(
            parsed,
            { type: "setTaskStatus", taskId: task.id, status: "skipped" },
            { idFactory: () => taskId },
          );
          expect(marked).toBe(
            variant(
              `# Review\n\n- [-] Try keyboard <!-- qraft:id=${taskId} -->\n  Press Tab, then Enter.\n  Check the focus ring.\n\n## Later\n\nKeep this paragraph.\n`,
            ),
          );

          const addedTask = patchMarkdown(
            parsed,
            { type: "createTask", sectionId: "implicit:section", title: "Another check" },
            { idFactory: () => taskId },
          );
          expect(addedTask).toBe(
            variant(
              `# Review\n\n- [ ] Try keyboard\n  Press Tab, then Enter.\n  Check the focus ring.\n- [ ] Another check <!-- qraft:id=${taskId} -->\n\n## Later\n\nKeep this paragraph.\n`,
            ),
          );

          const ids = [taskId, noteId];
          const addedNote = patchMarkdown(
            parsed,
            { type: "addNote", taskId: task.id, body: "Focus overlaps", observation },
            { idFactory: () => ids.shift()! },
          );
          const after = `# Review\n\n- [ ] Try keyboard <!-- qraft:id=${taskId} -->\n  Press Tab, then Enter.\n  Check the focus ring.\n  - Note: Focus overlaps <!-- qraft:id=${noteId} -->\n    - Observation: \`{"route":"/checkout","viewport":{"width":390,"height":844}}\`\n\n## Later\n\nKeep this paragraph.\n`;
          expect(addedNote).toBe(variant(after));
          const read = parseMarkdown(addedNote);
          expect(read.document.sections[0]?.tasks[0]?.notes[0]).toMatchObject({
            element: null,
            observation: { ...observation, route: "/checkout" },
          });
          expect(patchMarkdown(read, { type: "editNote", noteId, body: "Focus is clipped" })).toBe(
            variant(after.replace("Focus overlaps", "Focus is clipped")),
          );
        });
      }
    }
  }

  it("rejects invalid observation dimensions and unknown capture fields", () => {
    const command = { type: "addNote", taskId, body: "Note", observation };
    expect(qaCommandSchema.safeParse(command).success).toBe(true);
    expect(
      qaCommandSchema.safeParse({
        ...command,
        observation: { ...observation, screenshot: "data:" },
      }).success,
    ).toBe(false);
    expect(
      qaCommandSchema.safeParse({
        ...command,
        observation: { ...observation, viewport: { width: 0, height: 844 } },
      }).success,
    ).toBe(false);
  });
});
