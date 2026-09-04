# Qraft

Qraft is a development-only React QA drawer backed by a local Markdown checklist. It connects human testing in the browser with coding-agent work through one shared `QA.md` file.

The repository currently contains the implementation specification and is ready for v0.1 development. No application code has been implemented yet.

## Documentation

Start with [the documentation index](docs/README.md). It identifies the canonical document for each product and engineering concern and gives agents a task-specific reading order.

The v0.1 boundary is intentionally narrow: Vite, React, local Markdown, and React Grab primitives. Hosted services, databases, authentication, MCP, AI features, screenshots, and additional framework adapters are deferred.

## For coding agents

Read [AGENTS.md](AGENTS.md) before making changes. It contains repository-wide working rules and verification expectations.
