---
name: git-ship
description: Runs the full post-feature workflow by syncing docs, staging commits, renaming the branch, and opening a PR. Use after implementing a feature, or when asked to "ship", "ship this", or "ship it". Do NOT auto-trigger. Shipping is a decision the user takes.
metadata:
  family: ship
---

# Ship

Run the full post-feature workflow by invoking each skill in sequence using the Skill tool. After each skill returns, invoke the next step immediately in the same response.

Do not output any text between steps and do not wait for user input. Tool permission dialogs are the only interrupts allowed. The final output is `✅ Shipped`, emitted on the wake after the step 9 watch exits on `passing`, unless a wrapping caller such as `auto-ship` closes on its own block.

## Verify

Run the verify commands `CLAUDE.md` names (lint, typecheck, tests) before the sequence starts. On a failure, stop: `❌ Verify failed. Fix the reported errors and run /git-ship again.` Make no fix attempt, since this skill is the resume point and the user is already making the fix.

When `CLAUDE.md` names no verify command, say so on one line and continue. A project with no suite is not a project with a failing one.

### Why verify runs first

Verify runs ahead of the sync skills so a stop leaves the tree exactly as the user left it. Re-running a suite the caller already ran costs one command.

The path it closes has no other guard. `auto-ship` verifies at its own Step 3 and hands three of its stop points back here, so a hand fix after one of those would otherwise reach the remote with nothing re-run.

## Pre-check

Run `git diff --cached --name-only 2>/dev/null` to check for staged files. If output is empty and there are unstaged changes, run `git add -A` to stage everything before proceeding.

## Sequence

1. Invoke `canon:context-fold` to sync the context entries against session decisions and the diff
2. Invoke `canon:task-complete` to mark the outcomes the diff shipped
3. Invoke `canon:docs-sync` to sync public docs against changes since main
4. Run `git add -A` to stage any files the sync skills wrote
5. Run `canon tasks plan-reach <plan> --json`, naming this branch's plan by path or slug, and report both lists per `### Reading the reach` below. This step never stops the sequence.
6. Invoke `canon:git-stage` to commit by concern, only when `git diff --cached --name-only` prints a path. When it prints nothing, the work already reached history in slices, so continue.
7. Invoke `canon:git-branch` to rename branch to match conventional format
8. Invoke `canon:git-pr` to push branch and open pull request
9. After the PR opens, watch CI in the background, so the session stays reachable while CI runs. Read `### Watching CI` below for the commands and the wake.

A caller wrapping this sequence may act between step 8 and step 9, the one gap the order leaves open, since the pull request exists and nothing has read its checks. `auto-ship` marks the pull request draft there. A caller needing a step anywhere else is asking for a change to this body.

### Reading the reach

Read `claimed` first and say who holds each path, since that is the half a reader acts on, then say how many changed paths `undeclared` names. Branch on the record rather than the exit code, which a shell function wrapping `canon` can flatten to zero.

### Why the reach reads at step 5

The branch is whole at step 5 and nowhere earlier. Steps 1 and 3 write past what the plan declared, and no pull request exists to carry the answer until step 8.

It reports rather than acts because every crossing measured on the wave it was filed against merged clean. The undeclared list runs long enough on an ordinary branch that a gate would fire on nearly every ship.

### When the verb is absent

An installed binary carrying no `plan-reach` subcommand reports the reach unread rather than clear. Say that, and continue.

The verb ships with the CLI and this body with the plugin, so an older binary meets a missing subcommand. Reading that absence as clean would report the check passing on every branch that never ran it.

### Watching CI

Run `canon pr checks <number> --json` once in the foreground. When no record comes back at all, the CLI predates the verb, so read `${CLAUDE_SKILL_DIR}/references/ci-watch.md` for the fallback watch. Otherwise start this loop through the Bash tool with `run_in_background` and a 60-minute timeout:

```bash
until canon pr checks <number> --json | jq -e '.state != "pending" or .conflicted == true' >/dev/null; do sleep 30; done; canon pr checks <number> --json
```

Emit `⏳ Watching CI on #<number> in the background` and end the turn, printing nothing more while the watch runs. The wake resumes this step rather than restarting at step 1, and a wake landing inside another skill, such as a `review-address` pass, goes to whichever step is waiting on CI.

### Reading the wake

Branch on the final record's fields rather than on the exit. Do not auto-fix any reading, and the watch line and a stop report are the two exceptions to the no-text-between-steps rule.

| Record                                  | Route                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `state: passing`                        | Settle the evidence thread below, then continue to After completion on `settled`      |
| `state: failing`                        | Stop the sequence and report the failing check with its URL                           |
| `conflicted: true`                      | Stop and report the branch conflicts with its base, since no run will start. Rebase.  |
| A `reason` and no `state`, or a timeout | Read `${CLAUDE_SKILL_DIR}/references/ci-watch.md` for the refused and unsettled reads |

### Settling the evidence thread

On a `passing` wake, run `canon pr evidence <number> --check --json` against the number step 8 returned. It reads the comments and edits none, so a comment a reviewer ticked stays as it is. Branch on `reason` and `owed` rather than the exit.

| Reading                                 | Route                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `settled`                               | Nothing is owed, as on a branch that changed no rendered surface, so continue                           |
| `owed`                                  | Run each step the `owed` list names, then re-read once, as below                                        |
| Any other `reason`, such as `gh-failed` | Stop and report it, since an unread thread is not a settled one                                         |
| No record, or an unknown flag error     | The binary predates `--check`, so report the thread unread and continue without claiming it was checked |

On `owed`, invoke `canon:pr-evidence` with the number, which runs the evidence step first and then the preview the thread owes, and re-read with the same command. Continue only on `settled`, and stop on any other reading with the `reason` and the `owed` list, never looping back.

A refused preview step or a failed deploy leaves `preview` owed on the re-read, so that is the stop and not a retry. The read is a closing step, so the draft mark stays the only thing between steps 8 and 9, and a caller closing on its own block waits on the same wake.

## After completion

Output one line:

```plaintext
✅ Shipped
```

Emit nothing here when a wrapping caller states it closes on its own block. `auto-ship` is that caller and its block opens on a line naming the draft state, so emitting both reports one run twice. A caller that states no such thing gets this block, which is every direct invocation.
