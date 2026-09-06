import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emptySession,
  isRecoverableForm,
  parseSession,
  reconcileSession,
} from "../../src/client/review-session";
import { createSessionStore } from "../../src/client/use-review-session";
import { parseMarkdown } from "../../src/markdown/parse";
import { patchMarkdown } from "../../src/markdown/patch";

afterEach(() => vi.unstubAllGlobals());

describe("review session recovery", () => {
  it("remaps all remaining drafts after our own legacy mutation changes source lines", () => {
    const parsed = parseMarkdown("## Main\n- [ ] First\n- [ ] Second\n");
    const [first, second] = parsed.document.sections[0]!.tasks;
    const state = {
      ...emptySession(),
      selectedTaskId: second!.id,
      notes: {
        [second!.id]: {
          body: "Keep this draft",
          element: null,
          revision: parsed.document.revision,
        },
      },
    };
    const after = parseMarkdown(
      patchMarkdown(parsed, { type: "addNote", taskId: first!.id, body: "Saved elsewhere" }),
    ).document;
    const remapped = reconcileSession(state, parsed.document, after);
    const nextId = after.sections[0]!.tasks[1]!.id;
    expect(remapped.selectedTaskId).toBe(nextId);
    expect(remapped.notes[nextId]?.body).toBe("Keep this draft");
    expect(remapped.notes[nextId]?.revision).toBe(after.revision);
    expect(Object.keys(remapped.notes)).toEqual([nextId]);
  });

  it("does not upgrade an ambiguous recovered draft to a new source revision", () => {
    const before = parseMarkdown("- [ ] Same title\n").document;
    const task = before.sections[0]!.tasks[0]!;
    const state = {
      ...emptySession(),
      notes: { [task.id]: { body: "Uncertain target", element: null, revision: "0".repeat(64) } },
    };
    const result = reconcileSession(state, before, before);
    expect(result.notes[task.id]?.revision).toBe("0".repeat(64));
  });

  it("retains a task-title draft when its legacy section identity becomes uncertain", () => {
    const before = parseMarkdown("## Main\n- [ ] First\n").document;
    const state = {
      ...emptySession(),
      titleDraft: "New task",
      descriptionDraft: "Check the seeded account.\nThe change should survive reload.",
      form: { kind: "task" as const, sectionId: before.sections[0]!.id, revision: before.revision },
    };
    const after = parseMarkdown("# Inserted externally\n## Main\n- [ ] First\n").document;
    expect(isRecoverableForm(state, before)).toBe(true);
    expect(isRecoverableForm(state, after)).toBe(false);
    expect(reconcileSession(state, after, after).form).toEqual(state.form);
    expect(parseSession(JSON.stringify(state))?.descriptionDraft).toBe(state.descriptionDraft);
    expect(reconcileSession(state, after, after).descriptionDraft).toBe(state.descriptionDraft);
  });

  it("restores earlier sessions without a description field without losing their drafts", () => {
    const { descriptionDraft: _description, ...legacy } = emptySession();
    const restored = parseSession(JSON.stringify({ ...legacy, titleDraft: "Existing draft" }));
    expect(restored?.titleDraft).toBe("Existing draft");
    expect(restored?.descriptionDraft).toBe("");
  });

  it("validates saved sessions and retains malformed stored data until explicit clear", () => {
    const map = new Map<string, string>([["review", "invalid JSON"]]);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => map.set(key, value),
      removeItem: (key: string) => map.delete(key),
    });
    const store = createSessionStore("review");
    expect(store.getSnapshot().warning).toContain("could not be restored");
    store.update((current) => ({ ...current, titleDraft: "test" }));
    expect(map.get("review")).toBe("invalid JSON");
    store.clear();
    store.update((current) => ({ ...current, titleDraft: "saved" }));
    expect(parseSession(map.get("review")!)?.titleDraft).toBe("saved");
    expect(parseSession(JSON.stringify({ ...emptySession(), version: 2 }))).toBeNull();
  });

  it("keeps in-memory work and reports failed browser persistence", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    const store = createSessionStore("review");
    store.update((current) => ({
      ...current,
      notes: { task: { body: "Keep me", element: null } },
    }));
    expect(store.getSnapshot().session.notes.task?.body).toBe("Keep me");
    expect(store.getSnapshot().warning).toContain("cannot be stored");
  });

  it("restores drafts and view state while discarding retired filters", () => {
    const current = {
      ...emptySession(),
      selectedTaskId: "task",
      scroll: 240,
      notes: { task: { body: "Keep this draft", element: null } },
    };
    const legacy = { ...current, query: "hidden task", statusFilter: "skipped", withNotes: true };
    expect(parseSession(JSON.stringify(legacy))).toEqual(current);
    expect(parseSession(JSON.stringify({ ...legacy, unexpected: true }))).toBeNull();
  });
});
