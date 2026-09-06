# Use Qraft with a coding agent

Qraft ships one portable [qraft-review skill](../skills/qraft-review/SKILL.md). It helps an agent
prepare or continue a **human** review: an initial app review, regression checks, a focused feature
review, or retesting earlier feedback. It does not execute QA, implement fixes, or certify a release.

The package never edits agent settings. Choose one of the explicit installation methods below.
Installing a skill gives an agent instructions; Qraft itself still runs entirely locally and does
not call an LLM. Your agent's own data handling applies when you give it project files or feedback.

## Install for a project

Run from the consuming project after installing `@qraft/qa`. The optional external
[skills CLI](https://github.com/vercel-labs/skills) can install the bundled directory:

```sh
npx skills add ./node_modules/@qraft/qa/skills --skill qraft-review --agent codex
```

For Claude Code, use `--agent claude-code`. Select only agents your project uses, keep project scope,
and inspect the proposed destinations. `npx` downloads and runs the third-party installer; it is
not a Qraft dependency. Its defaults can create a canonical copy and agent symlinks. Review its
output and changed files before committing them. Do not run a global or all-agents install by default.

Alternatively, copy the skill manually without running another package. For a new Codex install:

```sh
mkdir -p .agents/skills
test ! -e .agents/skills/qraft-review && test ! -L .agents/skills/qraft-review && \
  cp -R node_modules/@qraft/qa/skills/qraft-review .agents/skills/qraft-review
```

For Claude Code, substitute `.claude/skills` for `.agents/skills` in that command. The existence
checks deliberately leave an existing installation untouched. Commit the installed project skill
with your team's normal workflow. Do not create a second copy for an unused host.

These locations follow the [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)
and [Claude Code skill documentation](https://code.claude.com/docs/en/skills). Other hosts can use
the standalone guide below; native discovery and invocation depend on that host's support.

## Confirm discovery and use it

Start a fresh agent session in the project. In Codex, select or explicitly request `$qraft-review`;
in Claude Code, invoke `/qraft-review`. Ask it to make a small checklist for an existing feature.
Check that it reads the installed skill, chooses an appropriate scope, and produces the expected
file. Then try a separate fresh session with a natural request such as “Make a QA list for the
checkout changes.” Explicit invocation and natural discovery are separate checks; installing the
files alone does not prove either works in your agent version.

If a project already has `AGENTS.md` or `CLAUDE.md`, an optional short routing line can help:

```text
For human QA checklist requests, use the installed qraft-review skill.
Read root QRAFT.md if present; current user instructions override its preferences.
```

Add it deliberately without replacing the file or duplicating the skill's methodology. Do not
add a host instruction file solely to copy the entire guide into it.

## Use the guide without installing a skill

```sh
pnpm exec qraft guide
```

This read-only command prints the exact guide bundled with your installed Qraft version, even
outside an app directory. Give it to your agent as context, or ask the agent to read
`node_modules/@qraft/qa/skills/qraft-review/SKILL.md` directly. This is ordinary prompt context,
not automatic skill discovery. `qraft doctor` and `qraft setup` remain read-only diagnostics.

## Optional project preferences

A root `QRAFT.md` can hold durable information that is hard to infer. It is optional and is read
because the skill explicitly asks for it, not because Qraft or every agent recognizes the filename.
Use one root file; there is no nested configuration merge or executable schema.

For example, adapt these preferences to your project:

```md
# Review preferences

- Save new reviews under reviews/; continue an existing review when requested.
- Review instructions are in English and focus on outcomes, not individual clicks.
- Use the seeded local account described in docs/local-development.md.
- Do not submit real orders or contact real customers during QA.
- For regression reviews, use the release records in docs/releases/ to find a baseline.
```

Keep credentials, generated app inventories, live “latest deployed commit” values and task state
out of this file. Point to existing setup and release records instead. The user's current request
and established decisions for a continuing review take precedence over these preferences.
Grammar and preservation rules remain part of Qraft's actual capabilities.

## Update or remove an installed skill

The package's skill is versioned with the package; its frontmatter records the skill revision and
Markdown format family. An installed project copy is a snapshot. A package upgrade does not
necessarily refresh it, even when the installer uses symlinks to its own canonical project copy.

After upgrading Qraft, compare the installed skill with the new bundled directory. Back up local
customizations, inspect the diff, and explicitly refresh using your chosen method. Prefer putting
durable project preferences in `QRAFT.md` so skill updates stay simple. Do not overwrite `QRAFT.md`,
the review file, or other agent instructions during an update.

To remove it, remove only the installed qraft-review copy or installer-managed entry and its routing
line. Keep project preferences and QA notes unless you intentionally want to remove those too.
