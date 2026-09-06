# Troubleshooting and limits

Start with `pnpm exec qraft doctor` from your application directory. It prints read-only diagnostics,
including common integration and writer-lock problems. `pnpm exec qraft setup` prints the expected
framework integration. Neither command changes your files or establishes that runtime behavior works.

## The drawer or file is missing

- Start the development server, with Qraft's plugin or route and the guarded client mount from
  [installation](getting-started.md). Production builds intentionally do not offer Qraft.
- Open the QA edge tab. A hidden drawer returns after reload. **Change file** is at the bottom
  of the checklist; **Refresh files** reloads the chooser after creating a new Markdown file.
- Files must be inside the configured project root. Discovery ignores hidden folders, dependencies,
  build/output folders and symlinks. It stops at 2,000 files or 10,000 entries. In a large project,
  configure a specific project-relative `file` instead of expanding the discovery bounds.
- No filename is selected automatically. A saved choice needs browser local storage; without it,
  choose a file for the current session. Configure the trusted root explicitly for a monorepo.
- On Next.js, use App Router with the Node runtime. Keep local development auth/proxy middleware
  from redirecting the Qraft route. A configured `basePath` belongs in the client endpoint only.
  For a trusted local gateway, set its exact browser `origin`; forwarded headers do not grant access.

## The file appears but tasks or instructions do not

Use top-level `- [ ]` checkboxes and optional H2 section headings. Put plain instructions directly
below the task, indented by two spaces. Keep them before notes. Background prose, nested lists,
tables and fenced examples do not become task instructions. Files are limited to 2 MiB of UTF-8.
Duplicate IDs and ambiguous targets require correction rather than a guessed write. See the
[grammar](markdown-storage.md) and [checklist guide](creating-checklists.md).

## A save fails or conflicts with an editor

Qraft retains drafts and surfaces an explicit recovery action. Read the latest file and compare
the affected task or note before retrying. Do not remove IDs, reset the entire file, or clear your
saved session to resolve a filesystem conflict. Back up important reviews using your normal Git
workflow. Coordinate a pause if an agent will edit the same active review.

Qraft serializes its own writers using a sibling lock and checks revisions before replacing a file
atomically. Arbitrary external editors do not participate in that lock, so a final check-to-rename
race remains possible. It is not a version-control system. After a crashed writer, inspect the lock
and process information printed by `doctor`; remove a stale lock only after confirming no owner is
still writing. Qraft does not steal locks automatically.

## A note, draft or preference seems lost

Saved notes live in the selected Markdown file. Drafts, selected task, collapsed sections and scroll
use tab-isolated session storage; reloads and HMR can restore them, but closing a tab can end the
session. File choice, edge position and layout preferences use per-project local storage. A changed
origin or project identity can have a different saved session. Browser storage failures are visible.

**Settings → Clear saved session** explicitly clears saved review state in the browser; it does
not erase Markdown. Copy important unsaved text before clearing state. Shared files travel through
Git or your editor workflow; Qraft does not synchronize review sessions across teammates' machines.

## Element or source context is incomplete

React Grab and source maps provide best-effort identification. Use Parent/Child or the arrow keys
while picking to choose a meaningful container; held targets can be resumed explicitly. Open Shadow
DOM and same-origin frames are supported; closed shadow roots and cross-origin frames are not.

Notes retain bounded identifying attributes, selected visible text, ancestors and up to five relevant
component/source locations. They exclude form values, full HTML, arbitrary styles and screenshots.
Query strings and hashes are stripped from capture routes. Inspect feedback before sharing it:
visible text and project-relative paths can still contain project information.

Selectors and source locations can become stale as code changes. Keep a readable observation as
well as an attachment. Plain notes work when source context is unavailable. Vite's **Open source**
depends on its local editor integration; a failed open keeps the path visible. Next.js uses manual
source navigation. Qraft does not fall back to uploading context to an external editor service.

## The drawer covers something I need to test

Pin keeps it open during host interaction. **Settings → Push page content** reserves the measured
drawer width on viewports at least 1024 CSS pixels wide; smaller viewports keep the overlay. Host
elements fixed to the viewport may still overlap. On narrow screens, collapse details to the task
strip, interact with the app, then expand to write feedback. Supported responsive widths start at
360 CSS pixels. Use browser responsive mode locally; physical-phone network access is outside scope.

## Report a reproducible problem

Use the [bug form](https://github.com/CasperKristiansson/Qraft/issues/new?template=bug_report.yml).
Include Qraft/framework/Node/browser versions, a small sanitized example, steps, expected behavior
and actual behavior. Strip private notes, source paths and customer information. Follow
[the security policy](../SECURITY.md) for a possible vulnerability instead of a public issue.
