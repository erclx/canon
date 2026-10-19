---
title: Orchestrator hand launch
description: The one lean prompts file the orchestrator writes when the operator launches sessions by hand, with its path, overwrite rule, shape, and a filled example
---

Run this when the operator launches sessions by hand rather than through `claude --bg`. The rules every launch shares stay in `orchestrator-launch.md`.

# Hand launch

When the operator launches sessions by hand, write every prompt to one file, `.canon/tmp/dispatch/prompts.md`, and overwrite it at each wave. It lists every row not yet launched. A row launched from an older copy and again from a newer one would build twice, and the branch check in `orchestrator-dispatch.md` catches that.

The operator opens the file, reads one lead line, and pastes one fence per session. The shape is fixed:

- An H1, `# Dispatch prompts`, then one lead line carrying the measured head, the merge order, and the folder to open each session in
- An H2 per task as `## <label>: <title>`, an H3 per role as `### Worker` or `### Reviewer`, a `Model: <model>.` line, and a `text` fence
- In the fence, the command at position zero, then `Controller: <sessionId>`, then only context the plan does not carry, one line each

Keep the command at position zero per `### Position zero` in `orchestrator-launch.md`, and carry only what `### What the brief may carry` there allows. Leave out the answer-slot default and anything else the plan states.

The `Controller:` line replaces the background template's message clauses, which `role-worker` and `session-relay` already own. `auto-ship` Step 0 loads `role-worker`, so the fence needs nothing more.

- A reviewer launched by hand takes the `### Reviewer` H3 under its worker's H2, after `### Worker`, with the sibling facts `orchestrator-reviewer-launch.md` lists

````markdown
# Dispatch prompts

Head `<head>`. Merge `<label-a>` first, then `<label-b>`. Open each session in the repository root.

## <label-b>: <title>

### Worker

Model: opus.

```text
/canon:auto-ship .canon/plans/feature-<slug>.md
Controller: <sessionId>
<branch-a> edits the section of <file> this plan leaves alone. Rebase over it when told.
```

### Reviewer

Model: opus.

```text
Run /canon:role-reviewer, then /canon:review-pr <number>
Controller: <sessionId>
```
````
