---
title: Orchestrator hand launch
description: The prompts queue `canon dispatch prompts` owns when the operator launches sessions by hand, with the calls that fill and clear it, the shape the verb writes, and how a launch is recorded
---

Run this when the operator launches sessions by hand rather than through `claude --bg`. The rules every launch shares stay in `orchestrator-launch.md`.

# Hand launch

When the operator launches sessions by hand, queue every prompt through `canon dispatch prompts`, which owns one file at `.canon/dispatch/prompts.md`. Never write or edit that file yourself.

- The verb replaces a task and role already queued, so a retried call lands once
- It refuses `malformed` on a hand edit that broke the shape rather than writing over it
- The operator opens the file, opens each session in the repository root, and pastes one fence per session
- Every `add` reads the claim on each worker branch, refusing `claimed` for a new row and dropping a queued one already launched, so a stale prompt never reaches the next paste

## Queue a prompt

Run one `add` per session, with the model and effort the launch rules pick:

```bash
canon dispatch prompts add <task> --role worker --model <model> --effort <effort> --controller <sessionId> --json
```

- `--role worker` writes `/canon:auto-ship <plan>` from the plan the task links, and refuses `no-plan` for a task linking none
- `--role planner` writes the `role-planner` then `plan-feature` command for the task
- `--role reviewer` takes `--pr <number>` and writes the `role-reviewer` then `review-pr` command. Add the sibling facts `orchestrator-reviewer-launch.md` lists as lines.
- `--line <text>` adds one context line, and repeats. Carry only what `### What the brief may carry` in `orchestrator-launch.md` allows, never the answer-slot default or another fact the plan states.
- `--merge-order <text>` writes the one lead line the file carries. The verb drops it while no two queued worker plans share a file, and says so in the record.

Branch on the record's `ok` and `reason` rather than the exit. Report a `dropped` row as launched and a `claimUnread` branch as unverified.

The `Controller:` line the verb writes replaces the background template's message clauses, which `role-worker` and `session-relay` already own. `auto-ship` Step 0 loads `role-worker`, so the fence needs nothing more.

### The shape the verb writes

An H1, then the optional merge-order line, then an H2 per task as `## <label>: <title>` and an H3 per role. Each H3 carries a `Model:` line, an `Effort:` line, and a `text` fence with the command at position zero, per `### Position zero` in `orchestrator-launch.md`. An empty queue reads `No prompts waiting.` and carries no lead line.

````markdown
# Dispatch prompts

Merge order: <label-a> first, then <label-b>.

## <label-b>: <title>

### Worker

Model: opus
Effort: high

```text
/canon:auto-ship .canon/plans/feature-<slug>.md
Controller: <sessionId>
<branch-a> edits the section of <file> this plan leaves alone. Rebase over it when told.
```
````

## Record a launch

Start the watch in `orchestrator-watch.md` when a wave queues a worker prompt, if it is not running already. On the pass where a session first holds a queued worker row's branch, it prints `LAUNCHED <label> -> <name> [<id>]`.

On that line, or on the operator's word that a session launched, clear the row and promote it:

```bash
canon dispatch prompts rm <task> --role worker --json
canon tasks promote <stem>
```

The promote is the same call a background launch makes, and nothing else moves a hand-launched row out of `## Up next`. A planner or reviewer row takes no branch the watch can match, so it stays on the operator's word, then `rm` with its role.

`rm` answers `ok` with nothing removed for a row no longer queued, so a second clear is harmless. The wave after a worker's pull request opens queues `--role reviewer` for that row alone, since the worker's prompt is already gone.

## Reporting the queue

Report the file in the turn that queues to it by its path, then one line per row naming its label and the roles it carries, read from `canon dispatch prompts list --json`. Paste no fence into the reply, since the operator copies from the file and a second copy in chat goes stale at the next `add`.
