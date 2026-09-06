# Product requirements

Qraft is a local development review tool for Vite React and Next.js App Router apps. A tester selects a Markdown checklist, checks the running app, and leaves notes for a coding agent in that same file.

## Owner-approved workflow — 2026-09-05

1. Choose a project Markdown file. Remember that choice per project in the browser; there is no implicit QA.md selection.
2. Review sections and tasks. Change a task to not completed, completed, or skipped directly in the checklist, or open its details.
3. Write multiple notes from an always-visible composer. Enter submits; Shift+Enter inserts a line break, normalized on save. Notes can be edited later.
4. Optionally select a host element to attach identifying context to the current note, preserving the draft through picker selection/cancellation.
5. Mark a task completed or skipped independently of its notes. Ordinary status actions stay on the task. Previous and Next navigate without changing status; the separate Complete and next action confirms a completion before advancing. There are no findings, child completion checkboxes, blocking pass rules or completion celebrations.
6. External edits appear live. Conflicts and failures preserve drafts and require an explicit retry.

## Required behavior

- Pin keeps the drawer open while operating the host app, with nonmodal focus behavior. Remember pin preference per project. A dedicated Settings view groups layout, saved session and visibility controls. It can hide Qraft until reload and explicitly clear the saved review session without changing Markdown.
- Show sections and tasks directly, without search, filters, a document title or handoff controls. Retain collapsed sections, list scroll and selected task across reloads in the same browser tab.
- Versioned browser session storage isolates drafts by tab/project/file. Keep unsaved composer and edit drafts across reloads, HMR and dev-server restarts. Report unavailable/full storage. Ambiguous legacy targets and externally changed note bodies retain copyable recovery drafts rather than guessing. Closing a browser tab can end its saved session; no cross-tab draft synchronization is promised.
- At narrow widths a full-width note sheet can collapse to a current-task strip so the host remains operable. The strip has explicit complete, next, expand and hide actions.

- A compact vertical edge tab contains a six-dot grip, QA, and completed/total count, rotated 90 degrees clockwise. Dragging moves it vertically along the right edge; the position survives reload and is clamped to the viewport. Keyboard arrows/Home/End provide equivalent repositioning.
- The drawer defaults to an overlay without moving layout or locking body scroll. A saved Push page content setting reserves the drawer width on screens at least 1024 px wide and keeps it open during host interaction; smaller screens use the overlay. Checklist progress stays near the top; detail replaces the header identity with a large back button and omits progress.
- Each task row has separate status and detail controls. Task details reuse that circular status control beside the title instead of separate state buttons. Single activation cycles open → completed → skipped → open. A pointer double-click skips directly. Skipped tasks use a strike-through and explicit text.
- Progress counts completed tasks over all tasks; skipped count is shown separately. Skipped is never counted as passed.
- Each task shows its total note count. Notes have no open/resolved state.
- Notes can include bounded element identity: route pathname, component, repository-relative source/line/column, React Grab selector, tag, selected identifying attributes, a short visible text excerpt, a bounded ancestor description, and up to five relevant React component/source locations. No screenshots, values from inputs, full HTML, styles, Fiber dumps, or arbitrary page capture.
- Always preserve unknown Markdown and legacy finding bytes. Legacy nested checkbox findings render as notes, without exposing their checkbox as a workflow state.
- Existing top-level checklists work with or without H2 sections. Tasks have a short title and an optional plain-text description, shown separately from feedback notes in details. Add task offers both fields; existing descriptions are edited in the Markdown file. Unsupported nesting is explained rather than silently treated as reviewable tasks.
- Every new note records its capture pathname and CSS viewport dimensions, whether or not it has an element attachment. Query strings, hashes and input values remain excluded.
- Empty state explains how to ask a coding agent to create sections and task checkboxes, offers file selection, and allows adding sections after a file is selected.
- File selection lists server-discovered project Markdown files. Browser requests use opaque file IDs, never arbitrary filesystem paths or complete replacement documents. A trusted plugin file option can restrict the chooser to one file, including a missing file; it is not auto-selected.

## Scope and limits

The bundled qraft-review skill helps an external coding agent plan initial, regression, focused and
retest checklists. It follows explicit user scope, puts essential instructions inside visible tasks,
and preserves existing statuses, notes and metadata. A completed check records review progress,
not proof that its feedback is fixed. The skill does not execute reviews, change Qraft's grammar,
or mark notes resolved. Optional project preferences and explicit installation are documented in
[agent setup](agent-skill.md); the methodology is maintained only in the skill itself.

Vite and Next.js App Router (Node runtime); React 19; one root npm package; local development only; desktop and responsive browser review down to 360 CSS px. Physical-phone access over a network is outside the local-only boundary. No hosted service, accounts, database, MCP, AI, remote integrations, screenshots/video, general Markdown editor, task deletion/reordering, detached window, extension or automatic agent execution. Notes are handoff context, not a second issue tracker.

Canonical ownership: [design](design.md), [architecture](architecture.md), [Markdown](markdown-storage.md), [protocol](dev-server-protocol.md), and [acceptance](testing-and-acceptance.md). The owner feedback above supersedes the original findings workflow and the original visual mockup.
