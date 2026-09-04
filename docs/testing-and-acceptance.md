# Testing and acceptance

This document owns verification obligations and the definition of v0.1 completion. Passing one evidence tier does not imply another: unit, integration, built-package, browser, and clean-consumer results must be reported separately.

Every implementation milestone also requires a hands-on pass through the actual `@Browser` surface. Playwright is the repeatable automated browser tier; `@Browser` is the agent-inspected integrated tier. Record source revision, URL, viewport, journey, outcome, and screenshot path when the rendered interface changed.

## Test layers

### Unit: domain and Markdown

Required coverage:

- Parse H1/H2, tasks, notes, findings, metadata, IDs, LF, and CRLF.
- Accept `[x]` and `[X]` while touching only the requested marker.
- Preserve unknown headings, paragraphs, comments, lists, fences, spacing, and final newline.
- Diagnose invalid nesting, mixed newlines, and duplicate IDs.
- Create session-local locators without writing.
- Add stable IDs only when legacy content is first mutated.
- Normalize and validate text by Unicode code-point length.
- Escape titles and metadata without creating unintended Markdown.
- Normalize source paths and reject/omit paths outside the Vite root.
- Calculate progress and deterministic next-task ordering.
- Reject passing a task with unresolved findings.
- Prove resolving/reopening does not mutate related state implicitly.

Every Markdown mutation test compares the entire before/after file byte-for-byte. Parsed-model assertions alone are insufficient.

### Integration: store and Vite protocol

Required coverage:

- Missing-file read and first-write creation.
- Every command through the real store queue.
- Exact SHA-256 revisions.
- Stale `baseRevision` conflict without write.
- External edit between initial read and commit check without overwrite.
- Concurrent browser commands serialize correctly.
- Atomic replacement preserves original mode and newline behavior.
- Temp files are cleaned after simulated failures.
- Document GET and every command response status.
- Method, origin, JSON content type, body limit, and schema checks.
- Duplicate command-ID behavior.
- SSE initial connection, heartbeat, invalidation, cleanup, and reconnect semantics.
- Watcher add/change/unlink and revision coalescing.
- `vite build` and preview expose no Qraft middleware.

Use temporary directories and fixture copies. Never point tests at a developer's checklist.

### Package build

Required coverage:

- Type declarations and JavaScript build cleanly.
- `.` exposes only supported client API.
- `./vite` exposes only supported plugin API.
- Server/filesystem modules are not reachable from the browser entry.
- A clean example consumer resolves peer dependencies and starts.
- A production consumer build succeeds with the documented development guard.

### End-to-end: Playwright

Run supported flows in Chromium, Firefox, and WebKit at desktop size unless a browser-specific limitation is documented and accepted.

Required coverage:

- Open/close drawer without changing host bounding box or scroll position.
- Render checklist and progress from a fixture.
- Select task, pass/reopen, block pass with an open finding, and auto-advance.
- Add section, task, note, and finding and verify the exact resulting file.
- Reflect an external edit without page reload.
- Preserve form draft across a non-destructive refetch.
- Recover visibly from revision conflict, disconnect, and write failure.
- Picker ignores Qraft UI, highlights host elements, and suppresses host click.
- Picker cancels on `Escape` without a write.
- Picker saves only approved element fields.
- Element context failure still permits a plain finding.
- Open source requests the normalized file and line and reports failure safely.
- Keyboard navigation, focus return/trap, live messages, and 768 px layout.

Screenshots can aid test diagnosis but are not a shipped Qraft feature.

## Required root checks

Once Milestone 1 creates `package.json`, it is the exact command authority. It must expose scripts that cover:

1. format or lint validation;
2. TypeScript typecheck;
3. unit and integration tests;
4. package build;
5. Playwright E2E tests.

Agents must report the exact commands and results they ran. “Specified,” “implemented,” and “verified” are distinct states.

## v0.1 acceptance criteria

v0.1 is complete only when all statements are true:

1. A Vite React app can install the package and add `qraft()` plus `<QA />` using the documented integration.
2. The drawer overlays rather than resizes the host application.
3. An existing compatible `QA.md` renders without being rewritten on startup.
4. Passing or reopening a task changes only the intended checkbox marker plus a lazy ID when required.
5. Adding a section, task, note, or finding produces canonical readable Markdown with stable IDs.
6. A task with an unresolved finding cannot be passed in UI or command/store layers.
7. External file edits appear in the drawer without a page reload.
8. A stale browser revision cannot overwrite an external edit.
9. Element selection ignores Qraft UI and does not trigger the selected host control.
10. A saved attachment contains at most route pathname, component, repository-relative source/line/column, and selector.
11. `Open source` uses the stored normalized path and fails safely.
12. Unknown Markdown outside Qraft-owned lines survives every mutation byte-for-byte.
13. Vite production builds and preview servers expose no Qraft filesystem endpoint.
14. Format/lint, typecheck, unit/integration, package build, and three-browser Playwright checks pass from a clean checkout.
15. The repository contains the required React Grab notice and contains no Agentation source, assets, bundles, or copied styling.
16. Every completed milestone has current `@Browser` evidence, and final user-visible surfaces match the locked visual direction or have an explicit owner-approved update.

## Milestone evidence

For each milestone, record in the implementation PR or handoff:

- scope delivered;
- files and contracts changed;
- exact tests run and outcomes;
- known unverified behavior;
- deviations from the plan and the canonical documentation updated to reflect them.

Do not mark a milestone complete based only on code inspection or a narrower test tier than its exit condition requires.

## Definition of done for a change

A change is done when:

- behavior matches the owning canonical document;
- tests cover it at the lowest useful layer and relevant higher layer;
- Markdown mutations have full-file golden fixtures;
- failure paths keep the source file intact;
- the example app demonstrates user-facing behavior where applicable;
- user-visible errors state the recovery action;
- relevant root checks pass;
- the diff contains no unrelated framework, hosted-service, or deferred work;
- documentation changes accompany intentional contract changes.

## Definition of done for v0.1

All six implementation milestones are complete, all 16 acceptance criteria pass from a clean checkout, internal consumer installation has been exercised, and remaining limitations are documented without being misrepresented as verified capabilities.
