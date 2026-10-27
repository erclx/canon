---
title: Record the number on the task
description: How git-pr writes the pull request number the final command printed onto the task whose Plan line names the branch's plan, and which refusals it skips silently
---

# Record the number on the task

The last step of `git-pr` before its report, reached on every run whose final command printed a number.

Write the `number` the final command printed onto the task the branch is closing, and never resolve it again. A lookup by branch alone can return a closed pull request sharing that head, per `${CLAUDE_SKILL_DIR}/REQUIREMENT.md`. A final command that refused on a head mismatch printed no number, so this step writes nothing on that run.

## Name the plan

The task is the one whose `Plan:` line names the plan this branch implemented. That plan is `.canon/plans/feature-<slug>.md` at the main worktree root, with `<slug>` derived per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`.

- `plan-feature` writes the plan under the branch slug, so the two correspond on any branch that came through the plan-to-execute path
- When a caller earlier in the chain already read the plan, use that filename instead of re-deriving
- The slug is a guess at the plan rather than a fact about the task, so the verb re-checks it against the board and refuses on a near miss

```bash
canon tasks pull-request <number> --plan feature-<slug> --json
```

## What the verb writes

The verb resolves the board at the main worktree root in-process, the root `session-worktree` resolves on entry. It is the route because the write edits an existing main-root file, which `session-worktree` routes through a verb.

- It adds `Pull request: #NNN` under the task's `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` lines, and corrects the number in place when the line exists
- A line already reading as a list of `#NNN` entries takes the new number appended, reported as `appended`, so a task shipped in slices keeps every pull request
- The same write drops this branch from the `Pending branch:` line `canon tasks outcome` wrote, which lets the merge-time archive close the task

## Record the session

Beside the number, name this session on the same task's `Sessions:` line. It is the one record that covers a hand-launched worker, which no dispatcher saw start. Read the id from the roster's own row for the caller, then hand it to the verb under the same plan:

```bash
id=$(canon sessions list --self --json | jq -r '.sessions[0].sessionId // empty')
[ -n "$id" ] && canon tasks session "$id" --plan feature-<slug> --json
```

- A dispatched worker is already listed, since its dispatcher recorded it at launch, and the verb reports `unchanged` rather than writing it twice
- An empty `id` means the roster could not name the caller, so skip the write and report that no session was recorded
- Skip the same three refusals as the number below, and report `bad-input` or `no-name`, since either is a defect in this call

## Refusals

Skip silently when the record is `ok: false` and `reason` is `no-board`, `no-match`, or `ambiguous`, meaning no board, no task naming the plan, or more than one. A guessed write would compound each, since a wrong match archives the wrong task unattended once the branch merges. Report any other refusal rather than swallowing it.

A branch whose slug names no plan file lands on `no-match`, the same as one whose plan no task cites.

## Why the number

Every merge on `main` is a squash carrying the number in its subject, so the number survives where a branch name does not. `post-merge` reads it back to call `canon tasks archive`, which is why this step runs at pull request time rather than at worktree time.
