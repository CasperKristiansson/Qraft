import { qaCommandSchema } from "../../src/domain/commands";
import { describe, expect, it } from "vitest";
import { getNextOpenTaskId, getProgress, type QADocument } from "../../src/domain/model";

const document: QADocument = {
  title: "QA",
  revision: "revision",
  diagnostics: [],
  sections: [
    {
      id: "section",
      title: "Section",
      tasks: [
        { id: "one", title: "One", checked: false, notes: [], findings: [] },
        { id: "two", title: "Two", checked: true, notes: [], findings: [] },
        { id: "three", title: "Three", checked: false, notes: [], findings: [] },
      ],
    },
  ],
};

describe("read model helpers", () => {
  it("calculates top-level task progress", () => {
    expect(getProgress(document)).toEqual({ passed: 1, total: 3 });
  });

  it("selects the next open task and wraps once", () => {
    expect(getNextOpenTaskId(document, "one")).toBe("three");
    expect(getNextOpenTaskId(document, "three")).toBe("one");
  });
});

 it("validates entity length by Unicode code points at the command boundary", () => {
  expect(qaCommandSchema.safeParse({ type: "createSection", title: "😀".repeat(2_000) }).success).toBe(true);
  expect(qaCommandSchema.safeParse({ type: "createSection", title: "😀".repeat(2_001) }).success).toBe(false);
  expect(qaCommandSchema.safeParse({ type: "createSection", title: "bad\0text" }).success).toBe(false);
});
