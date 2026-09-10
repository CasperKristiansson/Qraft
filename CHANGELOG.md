# Changelog

## 0.4.0

- Add an explicit host-authorized shared Markdown backend and private deployed review mode.
- Select shared checklist files, synchronize saved notes and status through polling, and isolate browser drafts by authenticated session.
- Preserve local development-only adapters, revision conflicts, exact Markdown patches and restart recovery.
- Add an optional S3 store and Lambda HTTP v2 bridge with conditional writes across independent instances.
- Verify the packed production drawer through the AWS SDK and a local S3 protocol fixture; document private bucket and host authentication setup.

## 0.3.1 — 2026-09-06

- Introduce the first review with a compact checklist illustration and clearer Markdown guidance.
- Offer an expandable starter prompt for Codex, Claude Code, or ChatGPT and a GitHub checklist guide.
- Clarify file selection with file icons, search recovery, and mobile-friendly scrolling.
- Preserve manual prompt copying when clipboard access is unavailable.

## 0.3.0 — 2026-09-06

First public release, published as `@qraft-dev/qa`.

- Review a user-selected Markdown checklist inside Vite React or Next.js App Router applications.
- Add optional task descriptions for concrete review instructions, separate from feedback notes.
- Complete, skip and reopen tasks; write editable notes with optional element and source context.
- Keep review sessions across reloads, pin the drawer, or reserve page space on wider screens.
- Preserve surrounding Markdown and surface revision conflicts during local file synchronization.
- Diagnose setup with `qraft doctor` and print integration steps with `qraft setup`.
- Plan initial, regression, focused and retest reviews with the bundled qraft-review skill and
  read-only `qraft guide` command.
- Try a five-check local demo that preserves feedback across restarts.
- Use Qraft's code, documentation and portable skill under the MIT license.
