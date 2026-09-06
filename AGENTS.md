# Qraft agent instructions

## Mission

Build Qraft as a small, development-only React QA drawer backed by a local Markdown file. Preserve the human-and-agent workflow: the browser and coding agents share `QA.md` as the source of QA state.

The product is internal-first. Prefer the smallest complete implementation over framework breadth or speculative infrastructure.

## Start here

Before editing code or documentation:

1. Read [README.md](README.md).
2. Read [docs/README.md](docs/README.md) and the documents it marks as required for the task.
3. Inspect `git status --short --branch` and retain unrelated user changes.
4. Inspect the relevant implementation and tests before proposing or making changes.

For initial implementation work, read all documents in the “Implementation reading order” in `docs/README.md`.

## Canonical document ownership

Do not create a second specification for the same concern.

- Product scope and behavior: `docs/product-requirements.md`
- Drawer and picker interaction: `docs/design.md`
- Modules, dependencies, and boundaries: `docs/architecture.md`
- Markdown grammar and file mutation: `docs/markdown-storage.md`
- HTTP/SSE interface and safeguards: `docs/dev-server-protocol.md`
- Test obligations and release acceptance: `docs/testing-and-acceptance.md`
- Third-party research and licensing boundaries: `docs/upstream-and-licensing.md`

If implementation requires changing an agreed contract, update its owning document in the same change. If two canonical documents conflict, stop and resolve the documentation conflict before implementing either interpretation.

## Supported implementation boundaries

- Support Vite and Next.js App Router with the Node runtime.
- Use one package at the repository root with `.`, `./vite`, and `./next` exports.
- Keep Qraft local-only and development-only.
- Store active QA state in one user-selected project Markdown file; no filename is selected implicitly.
- The browser sends typed commands; it never sends a filesystem path or complete replacement document.
- Patch the smallest recognized Markdown span and preserve all unknown Markdown byte-for-byte.
- Use stable hidden IDs and add IDs to legacy content only when that content is first mutated.
- Detect stale revisions before writing. Never overwrite an external edit.
- Use `react-grab/primitives` for element selection and source context.
- Treat `docs/design.md` as the current interaction and visual contract.
- Do not depend on, copy, or adapt Agentation implementation code, CSS, assets, or bundles.
- Do not add accounts, auth, cloud storage, a database, MCP, AI, screenshots, video, issue-tracker integrations, or additional framework adapters without an owner request.

## Architecture rules

- Keep domain types and command validation free of React, Vite, HTTP, and filesystem imports.
- Keep Markdown parsing and patching server-only.
- The React UI depends on `QAStorage`, not directly on Markdown or Vite.
- The Vite entry composes middleware, event delivery, watcher integration, and `MarkdownDocumentStore`; business rules remain outside the adapter.
- Render all QA content as text. Never inject Markdown as raw HTML.
- Mount UI styles inside a Shadow DOM. Default overlay mode must not change host layout. The owner-requested Push page content setting may reserve page space as specified in docs/design.md; restore owned host styles on exit.
- Avoid new dependencies when a small implementation or an existing platform/Vite capability is sufficient.

## Markdown safety rules

Markdown integrity is a merge condition.

- Every mutation needs a full-file before/after golden test.
- Preserve newline style, final-newline state, file mode, unknown content, and untouched whitespace.
- Do not use a Markdown AST serializer for writes.
- Do not expose a “replace document” operation.
- Reject duplicate IDs and ambiguous targets instead of guessing.
- Use atomic sibling-file replacement and a second revision check immediately before the rename.
- Tests must use temporary fixture copies and must never mutate a developer's real `QA.md`.

## Working method

- Finish one tested vertical slice at a time; prioritize the current user request.
- Use `@Browser` for each changed integrated surface to exercise the nearest integrated Qraft surface. Automated tests do not replace this interactive browser checkpoint.
- Record the URL, viewport, journey, result, and current source revision for each integrated browser pass.
- Finish one tested vertical slice before starting the next.
- Prefer narrow, reviewable changes.
- Add tests with behavior, not as a later cleanup.
- Diagnose failures from evidence; do not weaken a contract or test merely to make it pass.
- Do not hand-edit generated build output or commit transient artifacts. Internal consumers may commit a verified package archive with their dependency and lockfile.
- Do not commit, push, publish, release, or create external resources unless the user asks for that action.

## Open-source reuse

- Use only the exact repositories and roles allowlisted in `docs/upstream-and-licensing.md`.
- Prefer a maintained public package when it directly removes difficult accessibility, selection, validation, or atomic-write work.
- For structural references, study the named files, tests, lifecycle, and failure handling, then implement the smallest Qraft-owned equivalent. Do not copy whole components or subsystems.
- Record source repository, inspected commit, source paths, reused idea, and resulting Qraft files in the upstream document.
- Preserve required notices for copied or substantially adapted code. Dependencies alone still require license review in the final package audit.
- Do not add another component system, styling system, parser, watcher, transport, state library, or utility dependency without a demonstrated gap and a documented plan/architecture change.

## Expected verification

Once the package shell exists, root `package.json` scripts are the command authority. It must eventually provide scripts equivalent to:

- formatting/lint checks;
- TypeScript typecheck;
- unit and integration tests;
- package build;
- Playwright end-to-end tests.

Run the smallest relevant checks during iteration and all required checks from `docs/testing-and-acceptance.md` before claiming a package candidate complete. Report what actually ran and distinguish local test evidence from behavior merely specified in documents.

Every user-visible change also requires a hands-on `@Browser` pass. Playwright proves repeatability; `@Browser` proves that an agent inspected the actual rendered behavior and compared user-visible work with the written design contract.

## Documentation style

- Write decisions as testable statements.
- Link to the canonical document instead of duplicating its content.
- Keep active documentation focused on implemented behavior; propose future scope in the conversation.
- Record a new architecture decision in `docs/architecture.md` unless the decision becomes large enough to justify a dedicated ADR directory.
- Use repository-relative links.

## Git and repository hygiene

- Keep the default branch named `main`.
- Never discard or rewrite user-authored changes without explicit permission.
- Do not use destructive Git commands.
- Keep secrets, local QA working files, dependency folders, test reports, and build output out of Git.
- Do not add a public package license or publish configuration until the owner explicitly chooses a distribution model.
