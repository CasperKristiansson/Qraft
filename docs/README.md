# Qraft documentation

Qraft is a private development tool for Vite React and Next.js App Router applications.
Start with the root [README](../README.md) for installation and the everyday workflow.
The old implementation roadmap and visual mockup have been retired; their history is in Git.

## Canonical contracts

| Concern                             | Document                                            |
| ----------------------------------- | --------------------------------------------------- |
| Product behavior and scope          | [Product requirements](product-requirements.md)     |
| Drawer and picker interaction       | [Design](design.md)                                 |
| Module and framework boundaries     | [Architecture](architecture.md)                     |
| Grammar and byte preservation       | [Markdown storage](markdown-storage.md)             |
| HTTP, events and safeguards         | [Dev-server protocol](dev-server-protocol.md)       |
| Verification and package acceptance | [Testing and acceptance](testing-and-acceptance.md) |
| Dependencies and notices            | [Upstream and licensing](upstream-and-licensing.md) |

Before editing, read AGENTS.md, the root README and the owning contract above plus its dependencies.
For framework, packaging or broad refactoring work, read all seven contracts. Update the owning
contract with intentional behavior changes. Do not create competing specifications or treat old
completion receipts as evidence for a changed candidate.

## Maintenance

Run `pnpm format` to format owned code and documentation. Markdown preservation fixtures, local
checklists, dependency locks and generated output are excluded. `pnpm check` enforces formatting,
source boundaries, unused-code checks, strict types, unit/integration behavior and the build.
See acceptance for the complete package and browser gates. Local receipts live in ignored
`artifacts/release`; screenshots live in ignored `artifacts/browser-evidence`.

The package remains private. No public license, registry publication or deployment is implied by
passing local checks. Keep internal archives immutable and commit them with the consuming
project's dependency entry, lockfile and integration.
