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
- Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`, taking the stop over the `latest` fallback, since this skill opens a pull request
- If the slug is empty, stop: `❌ Detached HEAD. Checkout the feature branch first.`
- Resolve `<plan>` in Step 1, ahead of any other read.
- If the working tree has uncommitted changes unrelated to the plan, stop: `❌ Uncommitted changes outside the plan. Commit or stash before autoshipping.`

Treat that slug as provisional. Once `session-worktree` runs, at Step 0 or before this chain began, every later step keys on the worktree and branch it resolved, whichever plan Step 1 reads.

## Step 0: take the role, then enter a worktree

Invoke `canon:role-worker` first, whatever the worktree state. That skill states the boundaries, the lifetime, and the channel obligations of a session building one branch under one plan, and a dispatched worker reaches the role here and nowhere else. Report it rather than proceeding silently when `canon:role-worker` does not resolve.

Then compare `git rev-parse --git-dir` with `git rev-parse --git-common-dir`. The `session-worktree` wrapper handles branch alignment, so never call `EnterWorktree` directly.

| Reading          | Route                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Equal            | The main worktree, so invoke `canon:session-worktree` with the argument the subsection derives |
| Different        | Already in a linked worktree, so continue                                                      |
| Neither resolves | Stop: `❌ Not a git repository. Autoship needs git or a WorktreeCreate hook.`                  |

### Name the worktree from the plan rather than leaving it to be derived

When the invocation argument is a plan path or a bare slug, name the worktree from `canon tasks plan-branch <argument> --json` rather than from a reading of the plan. A task path or no argument at all invokes `canon:session-worktree` bare.

Read `${CLAUDE_SKILL_DIR}/references/worktree-name.md` before invoking `canon:session-worktree`, for how each record shape reaches its tier 0 argument.

## Step 1: read the plan

Resolve `<plan>` in this order, stopping at the first match. Only a path reaches tier 1, and a bare slug is read as a plan's throughout, since the two would collide on any similar name.

1. **Caller-supplied task.** A path under `.canon/tasks/`. Take what its first `Plan:` line names, per `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`, after reading `tier-failures.md`.
2. **Caller-supplied plan.** Anything else, a plan path or a bare slug, as `session-worktree` tier 0 takes it. A slug resolves to `.canon/plans/feature-<slug>.md`, and a path is taken from the main root.
3. **Derived.** `.canon/plans/feature-<slug>.md`, from the `<slug>` the Guards derived.

Each tier stops with its own message on a file that does not resolve.

| Tier    | Stop                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task    | `❌ No task at <path>. Path was supplied, not derived, so check it and re-run.`                                                                                                                                     |
| Plan    | `❌ No plan at <path>. Path was supplied, not derived, so check it and re-run.`                                                                                                                                     |
| Derived | `❌ No approved plan at .canon/plans/feature-<slug>.md, where <slug> was derived from the current branch, <branch>. The invocation carried no argument, so pass a plan or a task path, or run /plan-feature first.` |

### When a tier fails

Tier 1 stops on a `Plan:` line linking several plans, on a task carrying none, and on a pointer into a plans archive or to no file. `${CLAUDE_SKILL_DIR}/references/tier-failures.md` carries the stop each one takes and the order the archive and existence tests run in.

### Test the plan's shape

Test the shape of whatever `<plan>` resolved to before reading it, after all three tiers, since a file resolving under any tier can be the wrong document. Look for a `**Files to touch:**` or `## Files to touch` marker per `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`, which a plan always carries and a task never does.

If neither form is present, stop: `❌ <path> carries no plan sections. A plan lives at .canon/plans/feature-<slug>.md, and a task reaches one through its Plan: line only from .canon/tasks/. Point autoship at either and re-run.` Otherwise read `<plan>` at the main worktree root, which is the scope for this run.

### Unanswered questions

Read `## The suggested-and-answer contract` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md` before acting on a question, for what it resolves to and the form an override takes. A question left open is a decision this run executes rather than a reason to stop.

Open the task's `## Findings` line for an override with the bold source-and-date label `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md` fixes.

## Step 2: implement

Load `canon:build-in-slices`, reporting it when it does not resolve, and implement only what the plan describes. Do not expand scope, refactor neighbors, or touch files outside the plan's "Files to touch" list without reason.

When the plan's `**Constraints:**` carry a `Fans in` bullet, this run is a fan-in integrator, so open this step by merging the member branches, per `${CLAUDE_SKILL_DIR}/references/fan-in.md`.

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
- `kind: 'measured'`, `findings` non-empty. Report each pair's `subject` and `reason` and continue to Step 5 without a fix, since a rewrite here rewrites what an earlier run shipped.
- `kind: 'unreadable'`. Report the `message` and continue to Step 5, since a shallow clone or a repository with no trunk is no reason to stop shipping.

### When the verb is absent

Never read a missing subcommand as clean. Read `${CLAUDE_SKILL_DIR}/references/verb-absent.md` on meeting one.

### A fan-in member stops here

When the plan's `**Constraints:**` carry a `Fan-in member of` bullet, push the branch, announce it done, and stop before Step 5. A member opens no pull request, since its integrator ships the whole set. Read `${CLAUDE_SKILL_DIR}/references/fan-in.md` for the push and the message.

## Step 5: UI checklist (conditional)

If the diff touches UI files (JSX, TSX, Vue, Svelte, HTML, or CSS under `src/`), invoke `canon:ui-checklist`, then continue to Step 6 whatever it returns, in every run. The Step 6 draft mark holds the merge, so a stop here protects nothing.

When it produces a checklist, read `${CLAUDE_SKILL_DIR}/references/ui-checklist.md` for the counts to hold before `pr-evidence` removes the file. A diff passing this test also owes the preview server `role-worker` states, started before Step 6.

## Step 6: ship

Invoke `canon:git-ship`. That body owns the sequence, being the verify gate, both doc syncs, staging, the commit grouping, the branch rename, the pull request, and the CI watch, along with the reason each step sits where it does. Read the order there and never here.

### The draft mark

This chain adds one thing. Mark the pull request as a draft as soon as `git-ship`'s pull request step returns, ahead of its CI watch, naming the number that step returned rather than one resolved by branch.

- Read `${CLAUDE_SKILL_DIR}/references/draft-mark.md` on reaching that point for the one command that proves the target, marks it, and reads the flag back
- A `false` read stops the chain, and never re-issue the mark on it
- Act on the wake after the CI watch exits on `passing`, not when the turn ends on its watch line, moving to Step 7 under a named controller and to the Output block otherwise
- Keep `git-ship`'s own verify gate, which repeats Step 3 on a clean run, since a resumed run enters at that gate

## Step 7: wait for the reviews

Run this step only when the launch named a controlling session, since only a controller dispatches the reviewers. A launch naming no controller has nobody reviewing, so it emits the Output block on the CI wake instead of waiting on a pass that cannot arrive. A `Controller: <sessionId>` line names one, whether the launch was by hand or not.

Read review state through `canon pr review-state` alone, since both families post as pull request reviews, and a worker polling issue comments instead stalled with both reviewers idle. Run it in the background with the number Step 6 returned, since the wait outlasts a foreground shell call, and act on the wake.

```bash
canon pr review-state <number> --wait 1200 --json
```

Branch on the record's `reason` rather than on the exit, which a shell function wrapping `canon` can flatten to zero.

| `reason`    | Route                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `covered`   | Emit the Output block. Invoke `canon:review-address` when `review.reason` or `ui.reason` reads open at the tip         |
| `timeout`   | Send the record to the controller per `canon:role-worker`, emit the Output block, and stop rather than waiting again   |
| Any refusal | Report the `reason` to the controller the same way and stop, since an unread thread is not one nobody has reviewed yet |

Skip the `review-address` call when a reviewer's message already started it, since that message carries the same posted pass. A close in both families needs nothing from this session, since the reviewers run the lift on their close.

## Output

Respond with up to two lines:

```plaintext
✅ Autoshipped (<state>): <PR url>
🖼️ <N> visual boxes unchecked (<M> taste), owed on the evidence comment of <PR url> to the operator, or to the UI reviewer for the boxes a driver can run
```

`<state>` is whatever the Step 6 read returned, being `draft` or `ready, unsupervised`, rather than the state the mark asked for. Fill the second line from the counts Step 5 held, and omit it when no checklist was produced.

This block replaces the one `git-ship` closes on rather than following it, since emitting both reports one run twice and buries the state under a `✅ Shipped` that does not name it.

## Failure recovery

Every stop point leaves recoverable state. Read `${CLAUDE_SKILL_DIR}/references/failure-recovery.md` on a stop for the step the user resumes from.
