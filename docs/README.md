# Qraft documentation

These documents collectively define Qraft v0.1. Each concern has one canonical owner so agents can work without reconciling duplicated specifications.

Status: implementation-ready

Audience: maintainers and coding agents

Specification snapshot: 2026-09-04

## Current repository state

- The v0.1 documentation set is complete and ready to guide implementation.
- The six-surface [visual direction](visuals/qraft-v0.1-visual-direction.png) is owner-approved and locked for v0.1.
- No package shell, runtime code, example app, or tests have been implemented yet.
- The next implementation work is [Milestone 1 — Package shell and Markdown read model](implementation-plan.md#milestone-1--package-shell-and-markdown-read-model).
- Treat every behavior in these documents as specified, not verified, until its milestone evidence exists.

## Source-of-truth map

| Question | Canonical document |
| --- | --- |
| What are we building, and what is out of scope? | [Product requirements](product-requirements.md) |
| How should the drawer and element picker behave? | [Design](design.md) |
| How is the package divided and which dependencies are allowed? | [Architecture](architecture.md) |
| What Markdown is recognized and how can it be safely changed? | [Markdown storage](markdown-storage.md) |
| What does the browser/dev-server interface expose? | [Dev-server protocol](dev-server-protocol.md) |
| In what order should the implementation be delivered? | [Implementation plan](implementation-plan.md) |
| Which tests and acceptance gates prove completion? | [Testing and acceptance](testing-and-acceptance.md) |
| Which upstream code and licensing boundaries apply? | [Upstream and licensing](upstream-and-licensing.md) |

## Implementation reading order

An agent starting or resuming implementation must read:

1. [Product requirements](product-requirements.md)
2. [Architecture](architecture.md)
3. [Markdown storage](markdown-storage.md)
4. [Dev-server protocol](dev-server-protocol.md)
5. [Design](design.md)
6. [Implementation plan](implementation-plan.md)
7. [Testing and acceptance](testing-and-acceptance.md)
8. [Upstream and licensing](upstream-and-licensing.md) before dependency or picker work

For a narrow change, read the owning document plus every document it links as a dependency. `AGENTS.md` always applies.

## Conflict rule

The owning document in the table above wins for its concern. Cross-document summaries are informative links, not competing contracts. If two canonical requirements genuinely conflict, update the documents to make one decision explicit before changing code.

## Documentation maintenance

- Change product scope only in `product-requirements.md`.
- Change persisted syntax only in `markdown-storage.md`, then update protocol fixtures and acceptance tests.
- Change a command or response in `dev-server-protocol.md`, then update the domain model in `architecture.md`.
- Add future ideas only to the deferred backlog in `implementation-plan.md`.
- Keep completion claims evidence-based; the presence of this specification does not mean the behavior is implemented.
