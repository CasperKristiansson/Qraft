import { describe, expect, it } from "vitest";
import { qaCommandSchema } from "../../src/domain/commands";
import { parseMarkdown } from "../../src/markdown/parse";
import { patchMarkdown } from "../../src/markdown/patch";

const sectionId = "section_11111111-1111-4111-8111-111111111111";
const taskId = "task_22222222-2222-4222-8222-222222222222";
const noteId = "note_33333333-3333-4333-8333-333333333333";
const description = "Use the seeded cart.\n\nIncrease quantity. The total should update.";

describe("task descriptions", () => {
  for (const newline of ["\n", "\r\n"]) {
    for (const bom of ["", "\uFEFF"]) {
      for (const final of [true, false]) {
        it(`preserves the complete file and separates feedback (${JSON.stringify({ newline, bom, final })})`, () => {
          const variant = (text: string) =>
            bom + (final ? text : text.replace(/\n$/u, "")).replaceAll("\n", newline);
          const before = variant(
            "# Review\n\nKeep this prose.\n\n## Cart\n- [X] Existing  \n  - Note: Keep feedback.\n\n## Later\n\n<!-- untouched -->\n",
          );
          const parsed = parseMarkdown(before);
          const ids = [sectionId, taskId];
          const created = patchMarkdown(
            parsed,
            {
              type: "createTask",
              sectionId: parsed.document.sections[0]!.id,
              title: "Check the total",
              description,
            },
            { idFactory: () => ids.shift()! },
          );
          const expected = variant(
            `# Review\n\nKeep this prose.\n\n## Cart <!-- qraft:id=${sectionId} -->\n- [X] Existing  \n  - Note: Keep feedback.\n- [ ] Check the total <!-- qraft:id=${taskId} -->\n  Use the seeded cart.\n\n  Increase quantity. The total should update.\n\n## Later\n\n<!-- untouched -->\n`,
          );
          expect(created).toBe(expected);
          const task = parseMarkdown(created).document.sections[0]!.tasks[1]!;
          expect(task.instructions).toBe(description);
          expect(task.notes).toEqual([]);

          const completed = patchMarkdown(parseMarkdown(created), {
            type: "setTaskStatus",
            taskId,
            status: "completed",
          });
          expect(completed).toBe(
            expected.replace("- [ ] Check the total", "- [x] Check the total"),
          );
          const noted = patchMarkdown(
            parseMarkdown(completed),
            { type: "addNote", taskId, body: "The total stays unchanged." },
            { idFactory: () => noteId },
          );
          expect(noted).toBe(
            completed.replace(
              `${newline}${newline}## Later`,
              `${newline}  - Note: The total stays unchanged. <!-- qraft:id=${noteId} -->${newline}${newline}## Later`,
            ),
          );
          expect(parseMarkdown(noted).document.sections[0]!.tasks[1]!.instructions).toBe(
            description,
          );
        });
      }
    }
  }

  it("round-trips structure-like text as a description, never tasks or feedback", () => {
    const source = "- [ ] Existing\n";
    const description =
      "- Note: Not feedback\n1. First step\n# A heading\n```code\n~~~code\n> Quote\n<!-- qraft:id=bad -->\nC:\\path\\file";
    const result = patchMarkdown(
      parseMarkdown(source),
      { type: "createTask", sectionId: "implicit:section", title: "Review", description },
      { idFactory: () => taskId },
    );
    expect(result).toBe(
      source +
        `- [ ] Review <!-- qraft:id=${taskId} -->\n  \\- Note: Not feedback\n  1\\. First step\n  \\# A heading\n  \\` +
        "```code\n  \\~~~code\n  \\> Quote\n  \\<!-- qraft:id=bad --\\>\n  C:\\\\path\\\\file\n",
    );
    const parsed = parseMarkdown(result).document;
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.sections[0]!.tasks).toHaveLength(2);
    expect(parsed.sections[0]!.tasks[1]).toMatchObject({ instructions: description, notes: [] });
  });

  it("keeps descriptions optional, bounded and normalized without flattening paragraphs", () => {
    const command = { type: "createTask", sectionId: "implicit:section", title: "Review" };
    for (const description of [undefined, "", "  \r\n  "]) {
      const result = patchMarkdown(
        parseMarkdown("- [ ] Existing"),
        qaCommandSchema.parse({ ...command, description }),
        { idFactory: () => taskId },
      );
      expect(result).toBe(`- [ ] Existing\n- [ ] Review <!-- qraft:id=${taskId} -->`);
    }
    expect(
      qaCommandSchema.parse({ ...command, description: "  First.\r\n\r\n  Then.  " }),
    ).toMatchObject({
      description: "First.\n\nThen.",
    });
    expect(qaCommandSchema.safeParse({ ...command, description: "🧪".repeat(2_000) }).success).toBe(
      true,
    );
    for (const description of ["x".repeat(2_001), "Unsafe\u0000text", "Unsafe\u001btext"]) {
      expect(qaCommandSchema.safeParse({ ...command, description }).success).toBe(false);
      expect(() =>
        patchMarkdown(parseMarkdown("- [ ] Existing"), {
          ...command,
          type: "createTask",
          description,
        }),
      ).toThrow();
    }
  });
});
