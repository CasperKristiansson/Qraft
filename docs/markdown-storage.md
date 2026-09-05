# Markdown storage contract

This document owns the persisted grammar, parsing rules, identity model, and safe file-mutation algorithm. It is the highest-risk implementation contract in Qraft.

## Canonical example

```md
# Checkout QA

## Authentication <!-- qraft:id=section_4dc6d70a -->

- [x] Login <!-- qraft:id=task_58f14d75 -->
- [ ] Expired session <!-- qraft:id=task_4c4f649b -->
  - Note: Check both idle and absolute expiry. <!-- qraft:id=note_d75fa92d -->

## Cart <!-- qraft:id=section_d98729e1 -->

- [ ] Change quantity <!-- qraft:id=task_e9e53cc7 -->
  - Note: Alignment jumps when changing quantity from 9 to 10. <!-- qraft:id=note_758583f2 -->
    - Component: `QuantitySelector`
    - Source: `src/components/cart/QuantitySelector.tsx:87:5`
    - Route: `/checkout`
    - Selector: `.cart .quantity-selector`
- [ ] Remove product <!-- qraft:id=task_6bb032d1 -->
```

Example IDs are shortened for readability. The writer generates a type prefix followed by `crypto.randomUUID()` and treats the resulting value as opaque:

- `section_<uuid>`
- `task_<uuid>`
- `note_<uuid>`
- `finding_<uuid>` is accepted only for legacy nested checkbox notes.

## Recognized grammar

- The first H1 beginning `# ` is the document title. If absent, the UI title is `QA`.
- H2 headings beginning `## ` are sections.
- A GitHub-style checkbox beginning in column 1 is a QA task.
- A checkbox indented by exactly two spaces beneath a task is a legacy note. Its marker and ID are preserved; its old completion state has no workflow effect.
- A bullet beginning `  - Note:` beneath a task is a note.
- Four-space-indented labeled bullets beneath a note can be `Component`, `Source`, `Route`, `Selector`, or `Context` metadata. `Context` is a single inline-code JSON object with bounded tag/attributes/text/ancestors and optional sourceTrail defined in architecture.
- Top-level markers `[ ]`, `[x]`, `[X]`, and `[-]` mean open, completed, completed, and skipped. A touched marker uses space, lowercase x, or hyphen.
- A Qraft ID comment appears on the entity's first line and matches `<!-- qraft:id=... -->`.
- All unrecognized Markdown is retained but absent from the domain read model.

Qraft is not a general Markdown editor. The parser should be line-oriented and return recognized entities plus their exact source spans and diagnostics.

## Ownership and nesting

- A section owns recognized top-level tasks until the next H2.
- A task owns its recognized two-space children and their four-space metadata until the next top-level task or H2.
- A note owns consecutive recognized four-space metadata lines until another two-space child, top-level task, or H2.
- Notes (including legacy findings) outside a task are diagnostics and remain untouched.
- Top-level tasks before the first H2 are allowed in an implicit untitled section not supported: render them as diagnostics and do not mutate them.

This strictness avoids inventing ownership when hand-authored indentation is ambiguous.

## Identity

### Stable entities

An entity with exactly one valid ID uses it across moves and external edits.

### Legacy entities

An entity without an ID receives a deterministic session-local locator derived from its type, source line, and content so it can render. The first mutation targeting it must insert a stable ID as part of the same atomic patch.

Starting the development server, opening the drawer, parsing, or receiving a watcher event must never rewrite the file just to add IDs.

### Duplicate IDs

Duplicate IDs are parse errors. Every entity sharing the ID becomes read-only and the diagnostic names the ID and line numbers. A command addressing that ID returns a conflict. Qraft never chooses one target heuristically.

### Section targeting

Qraft-created sections always have IDs. Creating a task in a legacy section assigns the section an ID and adds the task in the same patch.

## Text and metadata normalization

- Trim entity text and collapse embedded line breaks/whitespace runs to single spaces.
- Reject empty strings and strings longer than 2,000 Unicode code points.
- Escape text that could create a list marker, heading, Qraft comment, or raw HTML boundary.
- Reject NUL and ASCII control characters other than normalized whitespace.
- Render values as text in the browser.
- Serialize metadata with an inline-code fence one backtick longer than the longest backtick run in the value.
- Normalize source path separators to `/`.
- Resolve source paths against the project root and omit paths outside it.
- Store `location.pathname`; omit query strings and hashes.
- Store selectors as one line and enforce the request-body size limit as the final bound.

The parser must correctly read inline code using variable-length backtick fences. It must not interpret unrecognized metadata labels.

## Status semantics

- Task status is open, completed, or skipped. Notes never block any transition.
- A task transition changes only its marker and a lazy ID when required.
- Notes have no completion state; legacy child checkbox bytes remain unchanged.

## Minimal patch rules

The writer patches the smallest recognized span. It never serializes the domain model back into a full Markdown document.

Required mutation shapes:

- Task status: replace only the checkbox marker character or space.
- Legacy ID assignment: append only one ID comment to the entity's first line.
- Add note: insert at the end of the task's owned block, before the next top-level task/H2.
- Edit note: replace only its body span, preserving prefix, trailing whitespace, existing ID, attachment metadata, and all unknown content. Insert a lazy ID if needed; legacy child checkbox prefixes remain untouched.
- Add task: insert at the end of the section's recognized content, before the next H2.
- Add section: append a blank-line-normalized H2 block.
- First write to a missing file: create only the content required by the command.

When one command both stabilizes a legacy target and adds content, calculate both edits against the same source snapshot and apply offsets from end to start.

## Byte preservation

Every supported mutation must preserve:

- unknown headings, paragraphs, lists, HTML comments, and fenced blocks;
- untouched entity spelling and checkbox case;
- whitespace outside the insertion boundary;
- LF or CRLF newline convention;
- presence or absence of a final newline;
- UTF-8 content, including a leading BOM without changing its exact-byte revision;
- existing file mode.

Mixed newline documents produce a diagnostic. Use the first encountered newline for inserted content while leaving existing bytes unchanged.

## Revision and mutation algorithm

`revision` is the SHA-256 of the exact file bytes. A missing file has the SHA-256 revision of zero bytes.

For each command:

1. Enter the configured file's in-process promise queue.
2. Read exact bytes and calculate `readRevision`.
3. Compare `baseRevision` with `readRevision`; on mismatch, return conflict without writing.
4. Decode UTF-8, parse, resolve the target, and validate command invariants.
5. Produce a minimal in-memory text patch.
6. Immediately read/re-hash the target again.
7. If it differs from `readRevision`, return conflict without writing.
8. Call the pinned `write-file-atomic` adapter, which creates a unique temporary sibling, flushes/closes it, preserves supported original metadata, renames it over the target, and cleans up failure residue.
9. Do not treat the dependency's write-only queue as the complete Qraft transaction; the outer queue must cover steps 2–8.
10. Do not disable fsync.
11. Calculate/return the new document and publish one revision change.
12. Verify through failure-injection tests that temporary residue is cleaned and the original remains intact.

The atomic-write dependency keeps its temp file beside the target; do not replace it with a system-temp implementation because rename atomicity is only reliable within the same filesystem. Never derive a target path from browser input.

No cross-process file lock is required for the internal package. The immediate second revision check protects against normal external-editor races. Document that simultaneous writes in the final check-to-rename window are a known local-only limitation; do not claim stronger locking semantics than implemented.

## Error behavior

| Condition                     | Store result                  | File result                                     |
| ----------------------------- | ----------------------------- | ----------------------------------------------- |
| Missing file read             | Empty document                | No file created.                                |
| Invalid command text          | Validation error              | Unchanged.                                      |
| Unknown target                | Not found                     | Unchanged.                                      |
| Duplicate target ID           | Conflict                      | Unchanged.                                      |
| Stale base revision           | Conflict with latest document | Unchanged.                                      |
| External change before commit | Conflict with latest document | Unchanged.                                      |
| Temp write/fsync failure      | I/O error                     | Original unchanged; temp cleaned when possible. |
| Rename failure                | I/O error                     | Original remains; temp cleaned when possible.   |

## Required tests

Every mutation needs a full before/after golden fixture. The required test inventory is maintained in [Testing and acceptance](testing-and-acceptance.md); those tests must directly exercise the rules in this document.
