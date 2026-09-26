---
name: auto-ship
description: Chains implement → verify → review → ship after a feature plan is approved. Reads the plan the caller names, the plan a named task points at, or the plan for the current branch when none is named, runs the full pipeline in one session, and stops on any failure or non-minor review finding. Use when asked to "autoship", "ship this feature end to end", or "run the chain". Do NOT auto-trigger. Requires an approved plan file.
disable-model-invocation: true
---

# Auto ship

Chain the post-plan pipeline in a single run. Every step has a stop condition. State is always recoverable on stop: code lives on the branch, review output on disk, plan still linked.

## Guards

- All `.canon/plans/` and `.canon/review/` reads resolve at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does.
- Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. This skill takes the stop rather than the `latest` fallback, since it commits and opens a pull request. If empty, stop: `❌ Detached HEAD. Checkout the feature branch first.` This slug is provisional. It is superseded once `session-worktree` runs, whether at Step 0 or before this chain began. Every later step keys its output on the slug that run resolves, being the worktree, the review receipt, and the branch, regardless of which plan Step 1 reads.
- Resolve `<plan>` in Step 1, ahead of any other read.
- If the working tree has uncommitted changes unrelated to the plan, stop: `❌ Uncommitted changes outside the plan. Commit or stash before autoshipping.`

## Diff baseline

Step 6 classifies the changed-file list to decide whether review runs. Resolve the base ref once:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Prefer `origin/main` over local `main`, since a local `main` trailing the remote pulls other people's merged commits into the list.

The baseline is unusable when no merge base resolves against either ref. Stop: `❌ No diff baseline against main. Fetch origin, then re-run autoship.`

The base equalling HEAD stays usable here. Step 6 runs before `git-stage` commits at Step 8, so the base equals HEAD on every ordinary run, and the classifier diffs the base against the working tree. Do not port the read-only siblings' `base == HEAD` stop into this skill.

## Step 0: take the role, then enter a worktree

Invoke `canon:role-worker` first, whatever the worktree state. That skill states the boundaries, the lifetime, and the channel obligations of a session building one branch under one plan, and a dispatched worker reaches the role here and nowhere else. Report it rather than proceeding silently when `canon:role-worker` does not resolve.

If `git rev-parse --git-dir` equals `git rev-parse --git-common-dir`, the session is in the main worktree. Invoke `canon:session-worktree` before continuing, carrying the argument the subsection below derives. The wrapper handles branch alignment. Do not call `EnterWorktree` directly.

If neither command resolves, stop: `❌ Not a git repository. Autoship needs git or a WorktreeCreate hook.`

If the two commands differ, the session is already in a linked worktree. Continue.

### Name the worktree from the plan rather than leaving it to be derived

When the invocation argument is a plan path or a bare slug, name the worktree from `canon tasks plan-branch <argument> --json` rather than from a reading of the plan. Read `${CLAUDE_SKILL_DIR}/references/worktree-name.md` before invoking `canon:session-worktree` for how each record shape reaches its tier 0 argument. A task path or no argument at all invokes it bare.

## Step 1: read the plan

Resolve `<plan>` in this order, stopping at the first match:

1. **Caller-supplied task.** The invocation carried a path under `.canon/tasks/`. If it does not resolve to a file, stop: `❌ No task at <path>. Path was supplied, not derived, so check it and re-run.` Read that task's first `Plan:` line and take what it names as `<plan>`, per `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`, reading `${CLAUDE_SKILL_DIR}/references/tier-failures.md` first for how the pointer resolves and the four stops it can take.
2. **Caller-supplied plan.** The invocation carried something else. Accept it as a plan path or a bare slug, in the same position `session-worktree` tier 0 accepts its name. A bare slug resolves to `.canon/plans/feature-<slug>.md`, and a path is taken as given from the main worktree root. If it does not resolve to a file, stop: `❌ No plan at <path>. Path was supplied, not derived, so check it and re-run.`
3. **Derived.** `.canon/plans/feature-<slug>.md`, from the `<slug>` the Guards derived. If it does not exist, stop: `❌ No approved plan at .canon/plans/feature-<slug>.md, where <slug> was derived from the current branch, <branch>. The invocation carried no argument, so pass a plan or a task path, or run /plan-feature first.`

Only a path reaches tier 1, and a bare slug is read as a plan's throughout, since the two would collide on any similar name.

### When a tier fails

Tier 1 stops on a `Plan:` line linking several plans, on a task carrying none, and on a pointer into a plans archive or to no file. `${CLAUDE_SKILL_DIR}/references/tier-failures.md` carries the stop each one takes and the order the archive and existence tests run in.

Test the shape of whatever `<plan>` resolved to before reading it as one, after all three tiers, since a file resolving under any tier can still be the wrong document.

Check for a `**Files to touch:**` or `## Files to touch` marker per `${CLAUDE_SKILL_DIR}/../../standards/plan.md`, the one section every plan carries structurally and a task never does, where `## Outcomes` and `## Findings` are the task's own. If neither form is present, stop: `❌ <path> carries no plan sections. A plan lives at .canon/plans/feature-<slug>.md, and a task reaches one through its Plan: line only from .canon/tasks/. Point autoship at either and re-run.`

Read `<plan>` at the main worktree root. This file is the scope for this run.

Its sections and its answer contract are fixed by `${CLAUDE_SKILL_DIR}/../../standards/plan.md`. A blank `- Answer:` accepts the `- Suggested:` line above it, so an unanswered question is a decision this run executes rather than a reason to stop. When this run decides against that suggestion, rewrite the `- Suggested:` line as `overridden at execution to <pick>,` plus the measurement, leaving the `- Answer:` slot blank, and put the same deviation in one line under the open task's `## Findings`, per `${CLAUDE_SKILL_DIR}/../../standards/plan.md`.

## Step 2: implement

Implement only what the plan describes. Do not expand scope. Do not refactor neighbors. Do not touch files outside the plan's "Files to touch" list without reason.

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

If the diff touches UI files (JSX, TSX, Vue, Svelte, HTML, or CSS under `src/`), invoke `canon:ui-checklist`.

If `ui-checklist` produces a checklist, stop: `❌ UI requires visual verification. Checklist at .canon/tmp/handoff/ui-checklist/<slug>.md, which reaches the pull request once /git-ship runs. Verify manually, then run /git-ship.`

The stop is the only thing that makes the operator look before `git-ship`.

If there is nothing to verify visually and nothing shipping untested, continue.

## Step 6: review

Classify the diff first. Take the union of `git diff --name-only <base>` and `git ls-files --others --exclude-standard`, resolving `<base>` per Diff baseline, then hand that set to the verb rather than reading it against the list below yourself:

```bash
canon autoship classify --json <path>...
```

The verb reads names only and touches git not at all. Branch on the record's `decision` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

- `skip`. Every path reads as prose and none states agent behavior. Skip review entirely and continue to Step 8.
- `review`. Invoke `canon:review-branch`. The record names the `file` that decided it and the `test` it failed, `extension` for a path that is not prose and `behavior-path` for prose that states what an agent does.
- `refused`, carrying reason `no-changes`. The changed set was empty, so take the stop below.

Say in the run whether the verb or the written fallback decided.

An empty list stops the chain rather than reading as prose-only, which it satisfies vacuously: `❌ No changed files to classify. Re-run when the plan has yet to produce its output. When the output is gitignored by design, autoship cannot ship it, so take the work out of the chain.` Never advise removing the output from `.gitignore`, which trades a stopped run for scratch committed into the repository.

### When the verb is absent

Never read an absent subcommand as a skip, since failing open would ship every branch unreviewed. Read `${CLAUDE_SKILL_DIR}/references/verb-absent.md` on meeting one, which carries the written test and the behavior paths it reads.

## Step 7: evaluate findings

Skip this step when Step 6 skipped review. Otherwise read `.canon/review/branch-<slug>.md` at the main worktree root. Split every finding by origin before parsing the summary line (`X critical, Y should-fix, Z minor`), since the stop exists for a defect the branch inherited.

- **This run caused it, at any severity.** Fix it, re-run the Step 3 verify commands, re-read the fixed file against what the finding claimed, and continue. Do not report it as a stop or offer the fix as a choice.
- **It predates this run, critical or should-fix.** Stop: `❌ Review found non-minor issues that predate this run. See .canon/review/branch-<slug>.md. Fix and run /git-ship.`
- **It predates this run, minor only.** Continue. The minor findings stay in the on-disk review receipt. Fold any a reviewer needs into the PR's `## Technical Context`. Do not add a separate review-notes section to the PR body.

Read origin as causation rather than authorship, so staleness this run induced in a file it never opened is a finding it caused.

Bound the repair at one pass, the way Step 3 bounds verify. When that re-read shows the finding still standing, stop: `❌ A self-introduced finding survived one fix pass. See .canon/review/branch-<slug>.md. Fix and run /git-ship.`

This chain owns the receipt's lifetime, which is what makes the Output block's citation resolve on a run that reaches it. The `context-fold` sweep under Step 8 reaches only reports whose branch is gone, which collects this one a branch later rather than during the run that wrote it.

## Step 8: ship

Invoke `canon:git-ship`. That body owns the sequence, being the verify gate, memory capture, both doc syncs, staging, the commit grouping, the branch rename, the pull request, and the CI watch, along with the reason each step sits where it does. Read the order there and never here.

One thing this chain adds. Mark the pull request as a draft as soon as `git-ship`'s pull request step returns, ahead of its CI watch, naming the number that step returned rather than one resolved by branch. Read `${CLAUDE_SKILL_DIR}/references/draft-mark.md` on reaching that point for the one command that proves the target, marks it, and reads the flag back. A `false` read stops the chain, and never re-issue the mark on it.

`git-ship` verifies again at its own gate, which repeats this chain's Step 3 on the run where nothing stopped. That cost is deliberate, since most stop points hand the run straight back to that body, and a gate the chain skips for being redundant is a gate no resumed run ever meets.

## Output

Respond with up to five lines:

```plaintext
✅ Autoshipped (<state>): <PR url>
<N minor findings kept in .canon/review/branch-<slug>.md>
<N facts routed to context entries>
<N memories captured in .canon/memory/>
<the review line memory-capture returned>
```

`<state>` is whatever the Step 8 read returned, being `draft` or `ready, unsupervised`, rather than the state the undo asked for.

Omit the second line if there were no minor findings, and the third if nothing routed. Omit the fourth if `memory-capture` wrote no memory file this session, and the fifth if it returned no review line. Pass that line through verbatim, since a dispatched worker's controller relays it to the operator.

This block replaces the one `git-ship` closes on rather than following it, since emitting both reports one run twice and buries the state under a `✅ Shipped` that does not name it.

## Failure recovery

Every stop point leaves recoverable state. Read `${CLAUDE_SKILL_DIR}/references/failure-recovery.md` on a stop for the step the user resumes from.
