import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_REVISION, parseMarkdown, sha256 } from "../../src/markdown/parse";

const fixture = (name: string) =>
  readFile(resolve(import.meta.dirname, "../fixtures", name), "utf8");

describe("parseMarkdown", () => {
  it("parses the canonical model and preserves the exact source", async () => {
    const source = await fixture("canonical.md");
    const parsed = parseMarkdown(source);
    expect(parsed.source).toBe(source);
    expect(parsed.document.title).toBe("Checkout QA");
    expect(parsed.document.sections).toHaveLength(1);
    expect(parsed.document.sections[0]?.tasks[0]).toMatchObject({
      title: "Change quantity",
      checked: true,
    });
    expect(parsed.document.sections[0]?.tasks[0]?.notes[0]?.body).toBe("Preserve a useful note.");
    expect(parsed.document.sections[0]?.tasks[0]?.notes[1]?.element).toEqual({
      route: "/checkout",
      component: "QuantitySelector",
      source: "src/QuantitySelector.tsx",
      line: 87,
      column: 5,
      selector: ".cart .quantity",
    });
    expect(parsed.document.revision).toBe(sha256(source));
  });

  it("creates deterministic legacy locators without rewriting", async () => {
    const source = await fixture("legacy.md");
    const first = parseMarkdown(source);
    const second = parseMarkdown(source);
    expect(first.document).toEqual(second.document);
    expect(first.document.sections[0]?.id).toMatch(/^legacy:section:/u);
    expect(first.source).toBe(source);
  });

  it("does not parse fenced examples and retains unknown content", async () => {
    const source = await fixture("unknown.md");
    const parsed = parseMarkdown(source);
    expect(parsed.document.sections).toHaveLength(1);
    expect(parsed.document.sections[0]?.title).toBe("Real section");
    expect(parsed.source).toBe(source);
  });

  it("accepts unsectioned tasks while keeping duplicate entities read-only", async () => {
    const parsed = parseMarkdown(await fixture("malformed.md"));
    expect(parsed.document.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["duplicate-id"]),
    );
    expect(parsed.document.sections[0]?.implicit).toBe(true);
    expect(parsed.document.sections[1]?.tasks.every((task) => task.readOnly)).toBe(true);
    expect(parseMarkdown("  - Note: Orphan\n").document.diagnostics[0]?.code).toBe(
      "invalid-nesting",
    );
  });

  it("recognizes LF, CRLF, mixed newlines, final-newline state, and empty revision", async () => {
    const lf = parseMarkdown(await fixture("line-endings-lf.md"));
    const crlf = parseMarkdown(await fixture("line-endings-crlf.md"));
    const mixed = parseMarkdown((await fixture("line-endings-mixed.md")).trimEnd());
    expect(lf.newline).toBe("\n");
    expect(crlf.newline).toBe("\r\n");
    expect(mixed.document.diagnostics).toContainEqual(
      expect.objectContaining({ code: "mixed-newlines" }),
    );
    expect(mixed.hasFinalNewline).toBe(false);
    expect(parseMarkdown("").document.revision).toBe(EMPTY_REVISION);
  });
});
