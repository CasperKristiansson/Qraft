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
- `Observation` is an optional four-space metadata bullet containing inline-code JSON with route pathname and CSS viewport width/height. It belongs to the note independently of an element attachment. Existing notes remain valid without it. Body edits preserve it byte-for-byte.
- Consecutive two-space-indented non-list text immediately after a task is displayed as read-only instructions. Blank lines within that block are allowed. Headings, fences and child bullets end instruction capture. Unsupported checkbox nesting produces a diagnostic. All other unknown Markdown remains absent from the domain read model and is retained byte-for-byte.

Qraft is not a general Markdown editor. The parser should be line-oriented and return recognized entities plus their exact source spans and diagnostics.

## Ownership and nesting

- A section owns recognized top-level tasks until the next H2.
- A task owns its recognized two-space children and their four-space metadata until the next top-level task or H2.
- A note owns consecutive recognized four-space metadata lines until another two-space child, top-level task, or H2.
- Notes (including legacy findings) outside a task are diagnostics and remain untouched.
- Top-level tasks before the first H2 belong to a synthetic section labeled Checklist. Its ID is reserved and never written to the file. Creating a task there does not insert a heading; status/note mutations stabilize only their real target. The synthetic span ends at the next H2.

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

1. Enter the configured file's in-process promise queue and acquire its exclusive sibling lock.
2. Read bounded exact UTF-8 bytes and calculate `readRevision`.
3. Compare `baseRevision` with `readRevision`; on mismatch, return conflict without writing.
4. Parse, resolve the target, validate invariants and produce a minimal text patch.
5. Stage and fsync the resulting bytes in a unique sibling file through `write-file-atomic`, preserving the original mode and ownership.
6. Revalidate the target path and immediately read/re-hash the current target. If it differs from `readRevision`, return conflict without replacing it.
7. Rename the prepared sibling over the target, then calculate/return the new document and notify listeners. A notification exception cannot undo a confirmed write.
8. Release only the lock owned by this operation and clean ordinary staging residue, including on failure.

The queue and cooperative lock cover the entire transaction, rather than only the dependency's write. Keep staging beside the target so final rename stays on the same filesystem. Never derive a target path from browser input. Failure-injection tests prove external-edit preservation and ordinary cleanup. See the concurrency and recovery contract below for crash leftovers and the remaining arbitrary-editor check-to-rename race.

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

## Cooperative writers and bounded documents

Reads and resulting writes are bounded to 2 MiB of valid UTF-8. Oversized or invalid files are rejected without modification. Before reading a mutation's base revision, Qraft acquires an exclusive sibling `<file>.qraft.lock` with mode 0600 and a process ID/random ownership token. Another Qraft process receives a retryable lock error. Qraft releases only its own token after the operation; it never steals a stale or replaced lock.

After a crashed process, run `qraft doctor` from the app directory. Stop all Qraft servers for that project and verify no writer is active before manually removing the identified lock. PID existence is a diagnostic hint, not permission to steal ownership. External editors do not participate in this lock; the second revision check still guards known edits immediately before rename, but arbitrary editor writes in the final check/rename interval cannot be made transactional. Notification failures after a successful rename do not turn a confirmed write into a failure.

Replacement stages fsynced bytes in a unique sibling `.qraft-stage-<uuid>` through the pinned atomic writer, then checks the current path/revision and performs the final rename. File mode and existing ownership are passed to staging; ordinary failures remove staging files. A process crash can leave staging/lock files, which are ignored by Git and never treated as checklists. Stop writers before manually cleaning identified leftovers.
