# Qraft documentation

Qraft puts a local Markdown QA checklist inside Vite React and Next.js App Router applications.

## Use Qraft

- [Get started](getting-started.md): supported environments, Vite/Next.js integration, teammate installs and removal.
- [Create a checklist](creating-checklists.md): write a file or ask a coding agent for a useful review.
- [Install the agent skill](agent-skill.md): explicit installation, optional project context and updates.
- [Troubleshoot](troubleshooting.md): files, saves, sessions, picker context and responsive limits.

The [README](../README.md) introduces the workflow and local first-review example.

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

The package remains private and unpublished. Passing local checks does not authorize a release.
See [release preparation](releasing.md) for the separate owner-controlled visibility and publication
steps, and [contributing](../CONTRIBUTING.md) for the normal development workflow.
