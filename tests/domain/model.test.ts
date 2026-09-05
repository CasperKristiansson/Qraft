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
        { id: "one", title: "One", checked: false, status: "open", notes: [] },
        { id: "two", title: "Two", checked: true, status: "completed", notes: [] },
        { id: "three", title: "Three", checked: false, status: "open", notes: [] },
      ],
    },
  ],
};

describe("read model helpers", () => {
  it("calculates top-level task progress", () => {
    expect(getProgress(document)).toEqual({ passed: 1, total: 3, skipped: 0 });
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

it("keeps skipped tasks separate from completed progress", () => {
  const copy = structuredClone(document); copy.sections[0]!.tasks[2]!.status = "skipped";
  expect(getProgress(copy)).toEqual({ passed: 1, total: 3, skipped: 1 });
  expect(getNextOpenTaskId(copy, "one")).toBe("one");
});
