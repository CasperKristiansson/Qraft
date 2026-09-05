# Product requirements

Qraft is an internal, local development review tool for Vite React apps. A tester selects a Markdown checklist, checks the running app, and leaves notes for a coding agent in that same file.

## Owner-approved workflow — 2026-09-05

1. Choose a project Markdown file. Remember that choice per project in the browser; there is no implicit QA.md selection.
2. Review sections and tasks. Change a task to not completed, completed, or skipped directly in the checklist, or open its details.
3. Write multiple notes from an always-visible composer. Enter submits; Shift+Enter inserts a line break, normalized on save. Notes can be edited later.
4. Optionally select a host element to attach identifying context to the current note, preserving the draft through picker selection/cancellation.
5. Mark a task completed or skipped independently of its notes. Stay on the selected task; navigate back explicitly. No findings, child completion checkboxes, blocking pass rule, automatic advance, or completion celebration remain.
6. External edits appear live. Conflicts and failures preserve drafts and require an explicit retry.

## Required behavior

- A compact vertical edge tab contains a six-dot grip, QA, and completed/total count, rotated 90 degrees clockwise. Dragging moves it vertically along the right edge; the position survives reload and is clamped to the viewport. Keyboard arrows/Home/End provide equivalent repositioning.
- The drawer overlays the host without moving layout or locking body scroll. Checklist progress stays near the top; detail replaces the header identity with a large back button and omits progress.
- Each task row has separate status and detail controls. Single activation cycles open → completed → skipped → open. A pointer double-click skips directly. Skipped tasks use a strike-through and explicit text.
- Progress counts completed tasks over all tasks; skipped count is shown separately. Skipped is never counted as passed.
- Each task shows its total note count. Notes have no open/resolved state.
- Notes can include bounded element identity: route pathname, component, repository-relative source/line/column, React Grab selector, tag, selected identifying attributes, a short visible text excerpt, a bounded ancestor description, and up to five relevant React component/source locations. No screenshots, values from inputs, full HTML, styles, Fiber dumps, or arbitrary page capture.
- Always preserve unknown Markdown and legacy finding bytes. Legacy nested checkbox findings render as notes, without exposing their checkbox as a workflow state.
- Empty state explains how to ask a coding agent to create H2 sections and task checkboxes, offers file selection, and allows adding sections after a file is selected.
- File selection lists server-discovered project Markdown files. Browser requests use opaque file IDs, never arbitrary filesystem paths or complete replacement documents. A trusted plugin file option can restrict the chooser to one file, including a missing file; it is not auto-selected.

## Scope and limits

Vite only; React 19; one private root package; local development only; desktop pointer and keyboard at 768 CSS px and wider. No hosted service, accounts, database, MCP, AI, remote integrations, screenshots/video, mobile support, general Markdown editor, task deletion/reordering, or automatic agent execution. Notes are handoff context, not a second issue tracker.

Canonical ownership: [design](design.md), [architecture](architecture.md), [Markdown](markdown-storage.md), [protocol](dev-server-protocol.md), and [acceptance](testing-and-acceptance.md). The owner feedback above supersedes the original findings workflow and the affected visual baseline surfaces.
