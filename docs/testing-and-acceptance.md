# Testing and acceptance

This document owns verification obligations and the definition of an internal package candidate completion. Passing one evidence tier does not imply another: unit, integration, built-package, browser, and clean-consumer results must be reported separately.

Every user-visible change also requires a hands-on pass through the actual `@Browser` surface. Playwright is the repeatable automated browser tier; `@Browser` is the agent-inspected integrated tier. Record source revision, URL, viewport, journey, outcome, and screenshot path when the rendered interface changed.

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
- Normalize source paths and reject/omit paths outside the project root.
- Calculate completed and skipped progress independently.
- Verify all three task states and independent notes.
- Prove status changes do not mutate notes or legacy child checkboxes.
- Create tasks with optional multiline descriptions. Prove full-file LF/CRLF, BOM and final-newline preservation; escape structure-like text so it cannot become notes or additional tasks. Descriptions stay separate from notes through later status/note changes. Restore both creation drafts after reload and retain them on conflicts or ambiguous section recovery.

Every Markdown mutation test compares the entire before/after file byte-for-byte. Parsed-model assertions alone are insufficient.

### Integration: store and framework protocol

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
- `./vite` exposes only supported plugin API; `./next` exposes only the server route factory.
- Server/filesystem modules are not reachable from the browser entry.
- A clean example consumer resolves peer dependencies and starts.
- A production consumer build succeeds with the documented development guard.

### End-to-end: Playwright

Run supported flows in Chromium, Firefox, and WebKit at desktop size unless a browser-specific limitation is documented and accepted.

Required coverage:

- Open/close the default overlay without changing host bounding box or scroll position. Opt-in page space must match drawer width, survive reload, preserve picker layout, and restore original styles on disable/close/hide/unmount or narrow resize.
- Render checklist and progress from a fixture.
- Change status from checklist and detail; single/double-click and keyboard; ordinary status actions stay put, explicit Complete and next advances only after a successful save, and no completion card appears.
- Add section, task, attached note, and edit note and verify the exact resulting file.
- Reflect an external edit without page reload.
- Preserve form draft across a non-destructive refetch.
- Recover visibly from revision conflict, disconnect, and write failure.
- Picker ignores Qraft UI, highlights host elements, and suppresses host click.
- Picker cancels on `Escape` without a write.
- Picker saves only approved element fields.
- Element context failure still permits a plain note.
- Open source requests the normalized file and line and reports failure safely.
- Keyboard navigation, focus return/trap, live messages, and 768 px layout.

Screenshots can aid test diagnosis but are not a shipped Qraft feature.

## Required root checks

`package.json` is the command authority. Run `check`, `test:browser`, `audit:release`, `verify:consumer` and `verify:next` on the final candidate. These cover:

1. format or lint validation;
2. TypeScript typecheck;
3. unit and integration tests;
4. package build;
5. Playwright E2E tests.

Agents must report the exact commands and results they ran. “Specified,” “implemented,” and “verified” are distinct states.

## Internal package acceptance criteria

An internal package candidate is complete only when all statements are true:

1. Vite React and Next.js App Router apps can install and use the packed package through the documented public exports.
2. The default drawer overlays the host; optional wide-screen page space is reversible and preserves host state.
3. An existing compatible `QA.md` renders without being rewritten on startup.
4. Completing, reopening, or skipping a task changes only the intended checkbox marker plus a lazy ID when required.
5. Adding a section, task, or attached note produces canonical readable Markdown with stable IDs.
6. Notes can be edited with minimal patches; all three task states are independent of notes and legacy findings.
7. External file edits appear in the drawer without a page reload.
8. A stale browser revision cannot overwrite an external edit.
9. Element selection ignores Qraft UI and does not trigger the selected host control.
10. Attachments contain only the bounded identifying context in architecture; no input values, full HTML, screenshots, or unrestricted page capture.
11. `Open source` uses the stored normalized path and fails safely.
12. Unknown Markdown outside Qraft-owned lines survives every mutation byte-for-byte.
13. Vite builds/preview and Next.js production builds/servers expose no active Qraft filesystem endpoint.
14. Format/lint, typecheck, unit/integration, package build, and three-browser Playwright checks pass from a clean checkout.
15. The repository contains the required React Grab notice and contains no Agentation source, assets, bundles, or copied styling.
16. Changed integrated surfaces have current browser evidence and satisfy the written design contract.

## Change evidence

For each change, record in the implementation PR or handoff:

- scope delivered;
- files and contracts changed;
- exact tests run and outcomes;
- known unverified behavior;
- intentional contract changes and the canonical documentation updated to reflect them.

Do not claim completion from code inspection or a narrower test tier than the changed boundary requires.

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

## Definition of done for an internal package candidate

All 16 acceptance criteria pass from a clean source copy, internal consumer installation has been exercised, and remaining limitations are documented without being misrepresented as verified capabilities.

## Owner feedback regression obligations

Verify compact tab geometry and concave joins; pointer and keyboard drag persistence/clamping; remembered per-project file choice, unknown ID/path/symlink rejection, two-file isolation, no startup write, and chooser recovery. Verify Enter/IME/Shift+Enter, multiple notes, editing and attachment preservation, note counts, retained drafts through navigation/picker/conflict, no detail progress or celebration, and long/narrow scrolling. Golden tests cover skipped markers, attached note metadata, body-only note edits, LF/CRLF/BOM/final-newline cases and legacy checkbox note preservation. Refresh Browser screenshots at 1440×900, 1366×650 and 768×900, then run check, test:browser, audit:release and verify:consumer on the final candidate.

Picker refinement regression obligations: lock a clicked target across delayed context and pointer movement; cancel pending selection; timeout to structural identity; suppress pointer/mouse activation; navigate parents/children and retain the held target; track animation/layout shifts and same-origin iframe scrolling, including dynamically inserted scaled frames. Validate optional guides, dimension labels and all three required viewports. Source-trail tests must bound/filter raw frames, normalize every path server-side, reject excessive/unknown fields, round-trip Context JSON and prove full-file add/edit preservation with BOM, LF/CRLF and final-newline variants.

## Execution discipline

Launch review coverage includes an ordinary unsectioned checklist with instructions and independent note Observation metadata; a 50-task collapse/navigation journey with sticky footer actions and single-row detail navigation; reload/HMR draft and selection recovery; independent drafts in two tabs; ambiguous legacy and external note-body recovery; pinning with host pointer/keyboard use; retired-filter session recovery without draft loss; and responsive sheet/strip/picker interaction at 390×844 and 360×640 in addition to the desktop/768 viewports. Verify session storage failure and explicit clearing, and include complete-file BOM/newline variants for the new grammar and metadata.

Use focused checks after relevant edits. Run the complete gates once on the final candidate; repeat only after a changed boundary or a recorded diagnostic hypothesis. Test with isolated fixture copies, including all uncommitted source, and a frozen dependency install. Never mutate a developer checklist for automated tests. Record source fingerprint, package digest, local URL, viewport, actions, results and screenshot paths for browser acceptance. Clean-consumer startup normally takes under 15 seconds; stop and diagnose at 60 seconds. Deployments and registry publication are outside internal verification.

## Compatibility and setup acceptance

The current profile exercises Node 24.19.0, React/React DOM 19.2.8, Vite 8.2.2/plugin-react 6.1.1 and Next.js 16.3.3. The maintenance profile uses Node 22.23.2 with Vite 7.3.6/plugin-react 5.2.0 and Next.js 15.5.25, retaining matching React 19.2.8. Run consumer scripts with `--maintenance` under that Node executable (including its directory in PATH). Record actual runtime, framework versions and archive digest per profile. These exact trials support the declared ranges; they do not prove every patch or platform combination.

Packed consumers must run `qraft doctor`, `qraft setup` and `qraft guide`, preserve host files during diagnostics, exercise development writes and production exclusion, and build after removing the Qraft integration/dependency in an isolated removal copy. No host framework upgrade is part of setup.

## Checklist skill and first-review acceptance

The packed guide must match the bundled SKILL.md byte-for-byte and run without a package.json in
the working directory. Verify explicit copy installation into isolated Codex and Claude Code project
layouts while preserving existing host instructions, QRAFT.md and review bytes. This proves file
installation, not activation in those agents. Validate frontmatter and parse every checklist example
with Qraft's real parser; all essential instructions must be visible in task details.

Evaluate the guide against six scenarios: a large new app, an unknown regression baseline, a focused
feature whose basics already work, retesting rich existing feedback, explicit user overrides, and an
incomplete or unsafe environment. Record the type of evaluation. A manual walkthrough is not a fresh
agent trial. Before claiming native agent behavior was tested, use separate fresh sessions for explicit
invocation and natural discovery, and inspect their generated files and preservation diffs.
Record the host version, fresh session IDs, exact skill digest, observed skill read/activation,
prompt, generated document, parser result and full preservation diff. Keep any unavailable host
explicitly unverified; an owner-accepted limitation is not a passing test.

The first-review example must start with five unchecked tasks and instructions, preserve all existing
review bytes across restarts, and use a different local file from automated fixture resets. Exercise
file selection, task instructions, an attached note, status changes, reload and narrow layout in the
integrated browser. Demo feedback must never mutate a developer's real review.

Hardening regression coverage includes competing OS processes, stale/replaced lock ownership, edits during staging, 2 MiB input/output bounds, invalid UTF-8 recovery with unchanged revision, bounded idle-file eviction, live stream limits, slow-reader cleanup, default Host/DNS-rebinding and Fetch Metadata rejection, trusted exact gateway origin, unavailable clipboard/session storage, and safe local request timeouts/HTML fallback diagnostics.
