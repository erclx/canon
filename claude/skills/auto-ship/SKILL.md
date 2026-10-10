---
name: auto-ship
description: Chains implement → verify → ship after a feature plan is approved. Reads the plan the caller names, the plan a named task points at, or the plan for the current branch when none is named, runs the full pipeline in one session, and stops on any failure. Use when asked to "autoship", "ship this feature end to end", or "run the chain". Do NOT auto-trigger. Requires an approved plan file.
metadata:
  family: build
---

# Auto ship

Chain the post-plan pipeline in a single run. Every step but the UI checklist has a stop condition. State is always recoverable on stop: code lives on the branch, plan still linked.

## Guards

- All `.canon/plans/` reads resolve at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does.
- Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. This skill takes the stop rather than the `latest` fallback, since it commits and opens a pull request. If empty, stop: `❌ Detached HEAD. Checkout the feature branch first.` This slug is provisional. It is superseded once `session-worktree` runs, whether at Step 0 or before this chain began. Every later step keys its output on the slug that run resolves, being the worktree and the branch, regardless of which plan Step 1 reads.
- Resolve `<plan>` in Step 1, ahead of any other read.
- If the working tree has uncommitted changes unrelated to the plan, stop: `❌ Uncommitted changes outside the plan. Commit or stash before autoshipping.`

## Step 0: take the role, then enter a worktree

Invoke `canon:role-worker` first, whatever the worktree state. That skill states the boundaries, the lifetime, and the channel obligations of a session building one branch under one plan, and a dispatched worker reaches the role here and nowhere else. Report it rather than proceeding silently when `canon:role-worker` does not resolve.

If `git rev-parse --git-dir` equals `git rev-parse --git-common-dir`, the session is in the main worktree. Invoke `canon:session-worktree` before continuing, carrying the argument the subsection below derives. The wrapper handles branch alignment. Do not call `EnterWorktree` directly.

If neither command resolves, stop: `❌ Not a git repository. Autoship needs git or a WorktreeCreate hook.`

If the two commands differ, the session is already in a linked worktree. Continue.

### Name the worktree from the plan rather than leaving it to be derived

When the invocation argument is a plan path or a bare slug, name the worktree from `canon tasks plan-branch <argument> --json` rather than from a reading of the plan. Read `${CLAUDE_SKILL_DIR}/references/worktree-name.md` before invoking `canon:session-worktree` for how each record shape reaches its tier 0 argument. A task path or no argument at all invokes it bare.

## Step 1: read the plan

Resolve `<plan>` in this order, stopping at the first match:

1. **Caller-supplied task.** The invocation carried a path under `.canon/tasks/`. If it does not resolve to a file, stop: `❌ No task at <path>. Path was supplied, not derived, so check it and re-run.` Read that task's first `Plan:` line and take what it names as `<plan>`, per `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`, reading `${CLAUDE_SKILL_DIR}/references/tier-failures.md` first for how the pointer resolves and the four stops it can take.
2. **Caller-supplied plan.** The invocation carried something else. Accept it as a plan path or a bare slug, in the same position `session-worktree` tier 0 accepts its name. A bare slug resolves to `.canon/plans/feature-<slug>.md`, and a path is taken as given from the main worktree root. If it does not resolve to a file, stop: `❌ No plan at <path>. Path was supplied, not derived, so check it and re-run.`
3. **Derived.** `.canon/plans/feature-<slug>.md`, from the `<slug>` the Guards derived. If it does not exist, stop: `❌ No approved plan at .canon/plans/feature-<slug>.md, where <slug> was derived from the current branch, <branch>. The invocation carried no argument, so pass a plan or a task path, or run /plan-feature first.`

Only a path reaches tier 1, and a bare slug is read as a plan's throughout, since the two would collide on any similar name.

### When a tier fails

Tier 1 stops on a `Plan:` line linking several plans, on a task carrying none, and on a pointer into a plans archive or to no file. `${CLAUDE_SKILL_DIR}/references/tier-failures.md` carries the stop each one takes and the order the archive and existence tests run in.

Test the shape of whatever `<plan>` resolved to before reading it as one, after all three tiers, since a file resolving under any tier can still be the wrong document.

Check for a `**Files to touch:**` or `## Files to touch` marker per `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`, the one section every plan carries structurally and a task never does, where `## Outcomes` and `## Findings` are the task's own. If neither form is present, stop: `❌ <path> carries no plan sections. A plan lives at .canon/plans/feature-<slug>.md, and a task reaches one through its Plan: line only from .canon/tasks/. Point autoship at either and re-run.`

Read `<plan>` at the main worktree root. This file is the scope for this run.

Its sections and its answer contract are fixed by `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`. A blank `- Answer:` accepts the `- Suggested:` line above it, so an unanswered question is a decision this run executes rather than a reason to stop. When this run decides against that suggestion, rewrite the `- Suggested:` line as `overridden at execution to <pick>,` plus the measurement, leaving the `- Answer:` slot blank, and put the same deviation in one line under the open task's `## Findings`, per `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`.

## Step 2: implement

Load `canon:build-in-slices`, reporting it when it does not resolve, and implement only what the plan describes. Do not expand scope, refactor neighbors, or touch files outside the plan's "Files to touch" list without reason.

## Step 3: verify

Run the verify commands defined in `CLAUDE.md` (lint, typecheck, tests). On failure:

- Make **one** fix attempt targeting the reported errors
- Re-run only the failing command
- If it still fails, stop: `❌ Verify failed after one fix attempt. Review logs and retry manually.`

Do not loop. Do not bypass hooks.

## Step 4: test order

Run `canon gov test-order --json` from the worktree this chain is building in, never from the main worktree root, whose trunk checkout closes the range on itself and reads every finding as clean.

The verb reads git history rather than the working tree, so it catches a violation that already reached this branch's history in an earlier session or round. It reports and never gates, so branch on the record's `kind` and its `findings` array rather than on the exit, which a shell function wrapping `canon` can flatten to zero.

- `kind: 'measured'`, `findings` empty. Nothing on the branch reached history ahead of its test. Continue to Step 5.
- `kind: 'measured'`, `findings` non-empty. Report each pair's `subject` and `reason` to the user and continue to Step 5. Do not stop the chain and do not attempt a fix, since rewriting it here rewrites what an earlier run shipped.
- `kind: 'unreadable'`. Report the `message` and continue to Step 5, since a shallow clone or a repository with no trunk is no reason to stop shipping.

### When the verb is absent

Never read a missing subcommand as clean. Read `${CLAUDE_SKILL_DIR}/references/verb-absent.md` on meeting one.

## Step 5: UI checklist (conditional)

If the diff touches UI files (JSX, TSX, Vue, Svelte, HTML, or CSS under `src/`), invoke `canon:ui-checklist`, then continue to Step 6 whatever it returns, in every run. The Step 6 draft mark holds the merge, so a stop here protects nothing. When it produces a checklist, read `${CLAUDE_SKILL_DIR}/references/ui-checklist.md` for the counts to hold before `git-pr` removes the file.

## Step 6: ship

Invoke `canon:git-ship`. That body owns the sequence, being the verify gate, both doc syncs, staging, the commit grouping, the branch rename, the pull request, and the CI watch, along with the reason each step sits where it does. Read the order there and never here.

One thing this chain adds. Mark the pull request as a draft as soon as `git-ship`'s pull request step returns, ahead of its CI watch, naming the number that step returned rather than one resolved by branch. Read `${CLAUDE_SKILL_DIR}/references/draft-mark.md` on reaching that point for the one command that proves the target, marks it, and reads the flag back. A `false` read stops the chain, and never re-issue the mark on it.

Emit the Output block on the wake after `git-ship`'s background CI watch exits on `passing`, not when the turn ends on its watch line.

`git-ship` verifies again at its own gate, repeating Step 3 on a clean run. Keep that repeat, since a resumed run enters at that gate.

## Output

Respond with up to two lines:

```plaintext
✅ Autoshipped (<state>): <PR url>
🖼️ <N> visual boxes unchecked (<M> taste), owed on the evidence comment of <PR url> to the operator, or to the UI reviewer for the boxes a driver can run
```

`<state>` is whatever the Step 6 read returned, being `draft` or `ready, unsupervised`, rather than the state the mark asked for.

Fill the second line from the counts Step 5 held, and omit it when no checklist was produced.

This block replaces the one `git-ship` closes on rather than following it, since emitting both reports one run twice and buries the state under a `✅ Shipped` that does not name it.

## Failure recovery

Every stop point leaves recoverable state. Read `${CLAUDE_SKILL_DIR}/references/failure-recovery.md` on a stop for the step the user resumes from.
