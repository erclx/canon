---
name: git-ship
description: Runs the full post-feature workflow by syncing docs, staging commits, renaming the branch, and opening a PR. Use after implementing a feature, or when asked to "ship", "ship this", or "ship it". Do NOT auto-trigger. Shipping is a decision the user takes.
metadata:
  family: ship
---

# Ship

Run the full post-feature workflow by invoking each skill in sequence using the Skill tool. After each skill returns, invoke the next step immediately in the same response.

Do not output any text between steps and do not wait for user input. Tool permission dialogs are the only interrupts allowed. The final output is `✅ Shipped`, emitted on the wake after the step 9 watch exits on `passing` rather than when the turn ends on the watch line, unless a wrapping caller states it closes on its own block, which `auto-ship` does.

## Verify

Run the verify commands `CLAUDE.md` names (lint, typecheck, tests) before the sequence starts. On a failure, stop: `❌ Verify failed. Fix the reported errors and run /git-ship again.` Make no fix attempt. This skill is the resume point after a stop, so the fix is the one the user is already making.

When `CLAUDE.md` names no verify command, say so on one line and continue. A project with no suite is not a project with a failing one.

Verify runs ahead of the sync skills so a stop leaves the tree exactly as the user left it. Re-running a suite the caller already ran costs one command, and the path it closes is the one that has no other guard: `auto-ship` verifies at its own Step 3 and then hands three of its stop points straight back here, so a fix made by hand after one of those stops otherwise reaches the remote with nothing re-run.

## Pre-check

Run `git diff --cached --name-only 2>/dev/null` to check for staged files. If output is empty and there are unstaged changes, run `git add -A` to stage everything before proceeding.

## Sequence

1. Invoke `canon:memory-capture` to route what this session learned to the context entries that own it and write the residue to `.canon/memory/`
2. Invoke `canon:context-fold` to sync internal planning docs against session decisions, folding in the routed facts
3. Invoke `canon:docs-sync` to sync public docs against changes since main
4. Run `git add -A` to stage any files the sync skills wrote
5. Run `canon tasks plan-reach <plan> --json` and report both lists it carries. Name the plan this branch built under, by path or by slug. Read `claimed` first and say who holds each path, since that is the half a reader acts on, then say how many of the changed paths `undeclared` names. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero. This step reports and never stops the sequence.
6. Invoke `canon:git-stage` to group staged changes and commit by concern, only when `git diff --cached --name-only` prints a path. When it prints nothing, the work already reached history in slices, so continue to step 7.
7. Invoke `canon:git-branch` to rename branch to match conventional format
8. Invoke `canon:git-pr` to push branch and open pull request
9. After the PR opens, watch CI in the background, so the session stays reachable while CI runs. Read `### Watching CI` below for the commands and the wake.

A caller wrapping this sequence may act between step 8 and step 9, which is the one gap the order leaves open, since the pull request exists there and nothing has read its checks yet. `auto-ship` marks the pull request draft in it. Nothing else may go there, and a caller that needs a step anywhere else in the sequence is asking for a change to this body rather than for a place to stand.

### Watching CI

Run `canon pr checks <number> --json` once in the foreground. When no record comes back at all, the target's CLI predates the verb, and the watch command is `gh pr checks <number> --watch`. The loop below would never exit on such a target, since an empty read never satisfies its test.

Otherwise start this loop through the Bash tool with `run_in_background` and a 60-minute timeout:

```bash
until canon pr checks <number> --json | jq -e '.state != "pending" or .conflicted == true' >/dev/null; do sleep 30; done; canon pr checks <number> --json
```

Emit `⏳ Watching CI on #<number> in the background` and end the turn. Print nothing more while the watch runs. The session wakes when the command exits, and the wake resumes this step rather than restarting the sequence at step 1. A wake that lands while the session is inside another skill, such as a `review-address` pass a message started during the watch, goes to whichever step is waiting on CI.

On the wake, branch on the final record's fields rather than on the exit:

- `state: passing`: read the evidence thread under `### Settling the evidence thread` below, then continue to After completion on `settled`.
- `state: failing`: stop the sequence and report the failing check with its URL.
- `conflicted: true`: stop the sequence and report that the branch conflicts with its base, since no run will start for it. A rebase is the repair.
- A `reason` and no `state`: the read was refused, such as `no-remote-branch` for a branch deleted on the remote. Stop and report that `reason`. A missing `state` is never a pass.
- The command hit its timeout and printed no final record: report CI unsettled after 60 minutes, and emit no `✅ Shipped`.
- The `gh pr checks --watch` fallback ran, which prints a check table rather than a record. Only a printed table carrying at least one check, every one passing, continues to After completion. Any failing check stops the sequence naming it with its URL. Empty or errored output stops the sequence and reports the message, since `no checks reported on the '<branch>' branch` is what a conflicted branch prints, and that fallback has no `conflicted` field to separate it from lag.

Do not auto-fix any of these. The watch line and a stop report from any branch above are the two exceptions to the no-text-between-steps rule.

### Settling the evidence thread

On a `passing` wake, run `canon pr evidence <number> --check --json` against the number step 8 returned. It reads the pull request's comments and edits none, so the comment a reviewer already ticked stays as it is. Branch on `reason` and `owed` rather than the exit.

- `settled`: nothing is owed, which is also what a branch that changed no rendered surface reads. Continue to After completion.
- `owed`: run each step the record's `owed` list names, from `canon:git-pr`'s `references/evidence.md`, evidence first and then preview. Re-read once with the same command. Continue to After completion only on `settled`. Any other reading stops the sequence and reports the `reason` with the `owed` list, and the sequence never loops back for a second pass. A preview step that refuses, or a deploy that failed, leaves `preview` owed on the re-read, so that is the stop and not a retry.
- Any other `reason`, such as `gh-failed`: the thread went unread. Stop and report the `reason`, since an unread thread is not a settled one.
- No record at all, or an unknown flag error: the installed binary predates `--check`. Report the thread unread rather than settled, and continue to After completion without emitting a claim that it was checked.

The read is a closing step and the draft mark stays the only thing between steps 8 and 9. A caller that closes on its own block, as `auto-ship` does, waits on the same CI wake, so the read lands here and not in that body.

### Why the reach reads at step 5

The branch is whole there and nowhere earlier. Steps 2 and 3 write past whatever the plan declared, so a reading taken ahead of them misses the chain's own additions, and no pull request exists until step 8 to carry the answer anywhere.

It is the one step here that reports rather than acts, which is why it never stops the sequence. Every crossing measured on the wave it was filed against merged clean, and the undeclared list runs long enough on an ordinary branch that a gate would fire on nearly every ship.

### When the verb is absent

An installed binary carrying no `plan-reach` subcommand reports the reach unread rather than clear. Say that, and continue. The verb ships with the CLI and this body ships with the plugin, so a target on an older binary meets a missing subcommand, and a body reading that absence as a clean answer would report the check passing on every branch that never ran it.

Capture leads the sequence because a routed fact lands in a context entry, which is a tracked file. Running it after the pull request opens leaves that edit off the branch entirely, so the fact reaches nothing. Memory files are gitignored either way, which is what hid the ordering while capture wrote only those.

## After completion

Output up to three lines:

```plaintext
✅ Shipped
<N facts routed to context entries>
<N memories captured in .canon/memory/>
```

Omit the second line if nothing routed and the third if `memory-capture` wrote no memory file this session.

Emit nothing here when a wrapping caller states it closes on its own block. `auto-ship` is that caller and its block carries these same two trailing lines below a first line naming the draft state, so emitting both reports one run twice. A caller that states no such thing gets this block, which is every direct invocation.
