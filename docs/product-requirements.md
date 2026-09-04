# Product requirements

## Product definition

Qraft is a development-only React QA drawer backed by a local Markdown file. It lets a tester work through a checklist in the running application, record notes and actionable findings, attach a finding to a live UI element, and share the resulting state with a coding agent through the same `QA.md` file.

The v0.1 product is:

> React Grab's element-selection primitives + an original annotation workflow + a Markdown-backed QA checklist drawer.

Qraft is not a hosted service.

## Core workflow

```text
Tester in browser
       │
       │ pass task / add task / record finding
       ▼
Qraft drawer ──typed command──▶ local Vite plugin
       ▲                              │
       │ file-change notification     │ minimal file patch
       │                              ▼
       └──────────────────────────── QA.md
                                      ▲
                                      │ read and edit
                                 coding agent
```

The shared Markdown file is the product's central integration. A tester records what they observe; an agent can read and resolve outstanding findings; the tester sees those edits live and verifies the parent task.

## Goals

1. Render an existing `QA.md` as sections, QA tasks, notes, and findings.
2. Let a tester pass or reopen a QA task and automatically move to the next incomplete task.
3. Let a tester create a section or task while testing.
4. Let a tester add a plain note to a task.
5. Let a tester add an actionable checkbox finding to a task.
6. Let a tester select an element in the running React application and attach concise source context to a finding.
7. Persist every meaningful change as a small, human-readable Markdown diff.
8. Watch external edits to `QA.md` and update the drawer without a page reload.
9. Keep the integration development-only and local-only.
10. Preserve Markdown content Qraft does not understand.

## Non-goals for v0.1

- Next.js, Webpack, or framework-neutral server adapters; Vite is the only host.
- Cloud or database storage.
- Accounts, authentication, permissions, teams, or concurrent remote testers.
- MCP, agent callbacks, webhooks, or automatic agent execution.
- Screenshots, video, console logs, network traces, or arbitrary attachments.
- AI-authored tasks, summaries, or fixes.
- Linear, Jira, or GitHub Issues integration.
- Browser extensions or use outside a local dev server.
- Rich Markdown editing, drag-and-drop reordering, task deletion, or section renaming.
- Mobile or touch support.
- Copying Agentation source code, styles, assets, or package output.

## Required concepts

### QA task

A task is something the tester must verify. Its checkbox represents the human QA result.

```md
- [ ] Verify changing cart quantity
```

### Note

A note is useful context without a completion state.

```md
- [ ] Verify changing cart quantity
  - Note: Updating quantity triggers a full pricing refresh.
```

### Finding

A finding is actionable work and therefore has its own checkbox.

```md
- [ ] Verify changing cart quantity
  - [ ] Quantity control jumps at two digits.
```

The exact persisted grammar belongs to [Markdown storage](markdown-storage.md).

## Functional requirements

### Checklist navigation

- The closed tab displays passed top-level tasks over total top-level tasks.
- Opening the tab shows sections and tasks in document order.
- Selecting a task opens its detail view.
- Passing a task selects the next open task in document order, wrapping once.
- A task with unresolved findings cannot be passed.
- Reopening a task does not reopen its findings.
- Finding completion never automatically completes the parent task.

### Authoring

- A tester can append a section.
- A tester can append a task to an existing section.
- A tester can add a note or finding to a task.
- Titles and bodies must be non-empty after trimming and no longer than 2,000 Unicode code points.
- Embedded line breaks are collapsed to spaces in v0.1.
- Skipped state, deletion, renaming, and reordering are deferred.

### Element context

- A tester can enter picker mode from a selected task.
- The picker highlights selectable host-app elements but never Qraft's UI.
- Selecting an element must not trigger the host element's click behavior.
- A finding may store route pathname, component, repository-relative source location, and selector.
- Qraft must not persist page contents, HTML preview, computed styles, Fiber data, or component stacks.
- A finding remains valid when React source context is unavailable.
- When source exists, the tester can ask the dev server to open it in their editor.

### Live shared state

- External edits appear without a page reload.
- Unsaved form input survives a refresh when its parent task still exists.
- A stale browser state cannot overwrite a newer file.
- Missing or malformed files produce recoverable UI states, not silent data loss.

## Product-level decisions

| Area | v0.1 decision |
| --- | --- |
| Host | Vite development server only |
| Storage | One local Markdown file, default `./QA.md` |
| Task result | Open or passed only |
| Findings | Nested checkboxes |
| IDs | Hidden stable IDs; legacy IDs added lazily |
| Selection engine | Published `react-grab/primitives` APIs |
| UI isolation | Shadow DOM overlay |
| Production behavior | No server endpoints; consumer mounts UI only in development |

Implementation details belong to [Architecture](architecture.md), [Design](design.md), and [Dev-server protocol](dev-server-protocol.md).

## Product completion

The product is v0.1-complete only when every numbered criterion in [Testing and acceptance](testing-and-acceptance.md) is satisfied with current evidence.
