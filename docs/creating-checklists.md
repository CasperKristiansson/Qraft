# Create a useful checklist

A Qraft file is an ordinary project Markdown file. You choose its name and location, then select
it from Qraft's file chooser. You can write it yourself or ask a coding agent to create it.

## Ask your coding agent

[Install qraft-review](agent-skill.md), or provide the output of `pnpm exec qraft guide`. Then ask:

```text
Create a Qraft review for the checkout changes, including my uncommitted work.
The rest of the app has already been reviewed. Compare with the last reviewed
commit if we can identify it; otherwise tell me what comparison you used.
Keep the checks focused on useful outcomes and save them in reviews/checkout.md.
```

You can instead ask for the first review of a new app, a single page, or a retest of existing notes.
The [skill](../skills/qraft-review/SKILL.md) owns how the agent scopes those approaches, asks useful
questions, and preserves earlier feedback. Your request can override its default level of detail.
It prepares the checklist; you still perform the review.

## Write one yourself

<!-- prettier-ignore -->
```md
# Account review

## Profile

- [ ] Save a changed display name
  Use the local test account. Change the display name, save, then reload.
  The profile should retain the new name and show a clear save confirmation.
- [ ] Cancel a profile edit
  Make another edit and cancel it. The previously saved name should remain.
```

Replace those expectations with your product's intended behavior. H2 headings group tasks.
Top-level checkboxes create tasks, even without sections. Two-space-indented plain text directly
under a task appears in its **Description** section. Keep the title short; use the optional
description for concrete prerequisites, what to check and the expected result. Omit it when the
title is sufficient. Background prose outside the task will not appear in the drawer.

Descriptions explain the check; **notes record feedback from doing it**. Do not create a note to
hold task instructions. Keep descriptions before any notes. In the drawer, **Add task** includes
an optional description field. To revise an existing description, edit its indented text in the
Markdown file; Qraft picks up the change automatically.

Use `[ ]` for new checks. `[x]` records a completed review and `[-]` a deliberately skipped check.
Completion does not assert that every observation has been fixed. Leave notes in place when
retesting; a fresh unchecked retest can refer back to the original observation.

Open Qraft, choose the file, and review its tasks. If you created the file while Qraft was open,
use **Refresh files**. Add notes in the drawer rather than manufacturing element metadata by hand.
Coordinate a pause before asking an agent to edit a file you are actively reviewing.

The [Markdown storage contract](markdown-storage.md) owns the complete grammar, hidden IDs,
attachment fields, supported limits and preservation behavior.
