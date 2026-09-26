---
name: git-ship
description: Runs the full post-feature workflow by syncing docs, staging commits, renaming the branch, and opening a PR. Use after implementing a feature, or when asked to "ship", "ship this", or "ship it". Do NOT auto-trigger. Shipping is a decision the user takes.
---

# Ship

Run the full post-feature workflow by invoking each skill in sequence using the Skill tool. After each skill returns, invoke the next step immediately in the same response.

Do not output any text between steps and do not wait for user input. Tool permission dialogs are the only interrupts allowed. The final output is `✅ Shipped`, unless a wrapping caller states it closes on its own block, which `auto-ship` does.

## Verify

Run the verify commands `CLAUDE.md` names (lint, typecheck, tests) before the sequence starts. On a failure, stop: `❌ Verify failed. Fix the reported errors and run /git-ship again.` Make no fix attempt. This skill is the resume point after a stop, so the fix is the one the user is already making.

When `CLAUDE.md` names no verify command, say so on one line and continue. A project with no suite is not a project with a failing one.

Verify runs ahead of the sync skills so a stop leaves the tree exactly as the user left it. Re-running a suite the caller already ran costs one command, and the path it closes is the one that has no other guard: `auto-ship` verifies at its own Step 3 and then hands four of its stop points straight back here, so a fix made by hand after one of those stops otherwise reaches the remote with nothing re-run.

## Pre-check

Run `git diff --cached --name-only 2>/dev/null` to check for staged files. If output is empty and there are unstaged changes, run `git add -A` to stage everything before proceeding.

## Sequence

1. Invoke `canon:memory-capture` to route what this session learned to the context entries that own it and write the residue to `.canon/memory/`
2. Invoke `canon:context-fold` to sync internal planning docs against session decisions, folding in the routed facts
3. Invoke `canon:docs-sync` to sync public docs against changes since main
4. Run `git add -A` to stage any files the sync skills wrote
5. Run `canon tasks plan-reach <plan> --json` and report both lists it carries. Name the plan this branch built under, by path or by slug. Read `claimed` first and say who holds each path, since that is the half a reader acts on, then say how many of the changed paths `undeclared` names. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero. This step reports and never stops the sequence.
6. Invoke `canon:git-stage` to group staged changes and commit by concern
7. Invoke `canon:git-branch` to rename branch to match conventional format
8. Invoke `canon:git-pr` to push branch and open pull request
9. After the PR opens, watch CI. Poll `canon pr checks <number> --json` until the record's `state` leaves `pending` or the record carries `conflicted: true`, branching on those fields rather than on the exit, and fall back to `gh pr checks <number>` when no record comes back at all, which is a target whose CLI predates the verb. On `passing`, continue. On `failing`, stop the sequence and report the failing check with its URL. On `conflicted`, stop the sequence and report that the branch conflicts with its base, since no run will start for it and polling on never ends. A rebase is the repair. Do not auto-fix. This step may output on failure, the one exception to the no-text-between-steps rule.

A caller wrapping this sequence may act between step 8 and step 9, which is the one gap the order leaves open, since the pull request exists there and nothing has read its checks yet. `auto-ship` marks the pull request draft in it. Nothing else may go there, and a caller that needs a step anywhere else in the sequence is asking for a change to this body rather than for a place to stand.

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

Emit nothing here when a wrapping caller states it closes on its own block. `auto-ship` is that caller and its block carries these same two trailing lines above a first line naming the draft state, so emitting both reports one run twice. A caller that states no such thing gets this block, which is every direct invocation.
