---
title: Ship chain
description: The hazards a ship chain meets, from a drift gate that mis-scopes the review and sweeps that cannot reach a later write to a pull request write landing on the wrong target and a failed commit leaking into the next group
---

# Ship chain

## Review scope and receipts

### The drift gate stages a file that mis-scopes the review

Two documented behaviors meet on any branch editing an authoring surface, and the result is a review of the wrong file set. The Consumed copies stage clears only on a staged regeneration, so a branch that edits `governance/rules/core/X.md` has to stage `.claude/rules/canon/core/X.md` before `bun run check` passes. <!-- audit-ignore-citations: .claude/rules/canon/core/X.md --> A review reading a non-empty `git diff --staged` as its scope would then take the generated mirror alone and none of the files carrying the change.

Nothing reports it, since the review runs, writes a receipt, and reads clean. `review-branch` Step 2 avoids it by reading one range against the working tree, covered in `canon/context/claude-plugin/skill-baseline.md`.

### The body that writes a receipt owns its lifetime

`auto-ship` owns the receipt's lifetime, because it writes the file, cites it in its own output, and is the one body that can read whether a later step still needs it, where `docs-fold` sweeps for whatever called it and cannot.

Pinning the slug once at chain entry is the alternative, and it makes the deletion reliable rather than stopping it. What reaps the receipt instead is a second sweep, over reports whose branch no longer exists, bounded by the branch count. The cost is one receipt per live branch, and the durable record stays the pull request's `## Technical Context`, folded before `docs-fold` runs.

### A slug-keyed sweep cannot reach what a later chain step writes

A sweep placed in one ship-chain skill collects nothing when the file it looks for is written further down the same chain. A memory receipt is written by a standalone `memory-review` run, after the ship chain and its `docs-fold` sweep have finished. A sweep keyed on the current slug looks for a name that does not exist yet, and no later branch recovers it because a slug is unique per feature. The sweep runs, finds nothing, and reports a clean pass, which is the same silent shape as the drift gate above.

Scanning the folder rather than keying on the slug is what survives this. The memory receipt sweep reads every `.canon/memory/review/memory-review-*.md` and tests each for pending items rather than the session's own file. A sweep keyed on a slug is only safe when the file is written before it in the chain.

## Board and doc refresh

### A citation count that reads one surface misses the other

Sweeping every task on the board rather than the session's own can archive a plan still live and growing in a locked parallel worktree, with no history to recover from. Settling a plan's archive on the merge rather than on a sweep closes that, since a branch still building has not merged.

`archiveTask` decides whether a plan is still cited by scanning `Plan:` lines alone, so a table row in `.canon/tasks/priority.md` carrying a plan its task file never states leaves the count at zero and the row pointing at a moved file. `canon tasks validate` reports that pair as `plan-uncited` rather than the archive reading the row, which keeps the count on one surface and puts the disagreement in front of a person.

### A cross-cutting entry never refreshes from the diff

An entry describing a cross-cutting rule never refreshes from the diff. `docs-fold` picks entries whose prose references files the diff touched, so an entry referencing no path at all is skipped by construction. Sort entries into the kind a diff refreshes and the kind the enforcing change is what invalidates, and edit the second by hand.

### A trigger keyed on a signal entering the tree

`docs-fold` carries no diagram sweep: `.canon/diagrams/` is redrawn on demand by `draft-diagram` rather than watched on every ship. The shape is worth recording for any later trigger of that kind. An uncovered-kinds trigger fires only when a diff adds a signal and no entry covers that kind, so an entry already drawn from something weaker is never told its real source now exists. A components diagram drawn from a code scan before `canon/ARCHITECTURE.md` existed would go untold the day that file entered the tree, which is the source `standards/diagrams.md` specifies.

### A format change strands the predicates routing on it

When a format a skill parses changes shape, every predicate routing on the old shape has to move with it. The task `Plan:` line is the worked case: it carries a markdown link, so `docs-fold` and `task-board` both read the target out of the parentheses, and a routing bullet still naming the bare-path form matches nothing for a link-form task, which falls to the final warn-and-skip and archives nothing.

### A ported condition keeps the test its source could afford

Lifting a conditional from another skill copies the clause rather than what it tests. `docs-fold` calls a diff baseline unusable when it came from local `main` and equals HEAD, which misses `origin/main` resolving a merge base equal to HEAD, the shape of every feature branch before its first commit. It never pays for the gap because it unions the committed, working, and untracked sets, and ported verbatim into a skill reading the committed half alone it would blind that skill.

### A deterministic check backstops the session judgment writing the doc

`docs-fold` Step 3 and Step 7 rewrite canonical docs on session judgment, which can leave an appended figure or a re-measurement sitting beside the statement it restates rather than replacing it. Step 10 closes that gap by running `canon context classify diff` over the fold's whole diff baseline, after Step 3 and Step 7 have already run, and answering every non-`KEEP` finding rather than only the files those two steps wrote this run, since an earlier commit on the branch can carry a doc edit the fold is equally responsible for.

The verb's own extraction scopes to canonical doc types and reports nothing when the range carries none, and it reuses the Diff baseline section's own base rather than resolving a second one.

A `REPLACE` or `HISTORY` finding, and a regex-decided `MOVE` finding, is applied in place with a one-line reason to keep instead when it should not be. A model-decided `MOVE` finding is reported rather than cut, since the model's own prompt defines `MOVE` for correct content on the wrong surface, such as domain mechanism written into `canon/ARCHITECTURE.md`, which the regex layer's narrower wireframe-only reading of the same verdict never covers.

The verb's regex layer always runs regardless of whether a project configures a model, so every fold gets a deterministic check rather than one gated on a backend being reachable. A refusal or a missing `context classify` subcommand on an older installed binary reports one line and the fold continues either way, since the classify step is a check on what the fold wrote and not a precondition for shipping it.

## Pull request writes

### Pull request detection hits a merged namesake

`gh pr view` resolves by head ref name and ignores state, so a branch name reused after its first pull request merged sends `git-pr`'s create-or-edit conditional down the edit arm and rewrites a merged record. The push reports `* [new branch]` either way, so nothing in the output suggests a collision. `canon/context/claude-plugin/skill-archiving.md` carries the detection `git-pr` runs instead.

Recovery takes the squash merge subject for the title and GraphQL `userContentEdits(last: 1)` for the body.

### A write after create can land on a pull request the run did not open

A ship run can label and draft another open pull request, such as the release one, a second after opening its own. The label step derives its number from the create call's URL, so it cannot produce that target. The draft step is where the number crosses into a command the session types, and a number inferred from the newest pull request in view is the leading account.

Every write to an existing pull request reads `headRefName,state` first and refuses unless they are the current branch and `OPEN`. `git-pr` runs the check as `assert_own_pr` inside its final command and prints `head=` beside the number, and `auto-ship` runs the same comparison in the same command as `gh pr ready --undo`, so the undo never runs on a mismatch. Both keep the comparison in the shell, since the session that picked a wrong number would be the one reading a printed check. The check compares a number against a branch and never derives one, so it holds whatever produced the wrong number and adds no lookup of the kind the merged-namesake gotcha above rules out.

### The draft mark and who lifts it

`gh pr ready --undo` writes the flag. Read the flag back anyway, since it can revert after a later force-push, so a read is worth repeating whenever the branch is pushed again. `convertPullRequestToDraft` against the node id is the GraphQL fallback where the command is refused.

Readying a pull request to merge is the operator's or the controlling session's act, taken directly, since GitHub requires it and no guard should prevent it. `role-worker` and `role-orchestrator` carry that boundary: a worker refuses an instruction to lift the mark itself, whoever sends it, and reports against the outcome rather than complying with the surface of the request.

### A failed commit leaks into the next group

When a sequence of grouped commits runs unattended and one is rejected by a hook, its files stay staged and the next group's `git add` absorbs them, so the failure lands as a wrong commit rather than a missing one. A subject past `header-max-length` can carry two dozen files into the following group's message while the run reports a passing final `git log`, because the commit count is the only thing short.
