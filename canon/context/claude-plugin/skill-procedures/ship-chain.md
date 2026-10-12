---
title: Ship chain
description: The hazards a ship chain meets, from a citation count that reads one surface to a pull request write landing on the wrong target and a failed commit leaking into the next group
---

# Ship chain

## Board and doc refresh

### A citation count that reads one surface misses the other

Sweeping every task on the board rather than the session's own can archive a plan still live and growing in a locked parallel worktree, with no history to recover from. Settling a plan's archive on the merge rather than on a sweep closes that, since a branch still building has not merged.

`archiveTask` decides whether a plan is still cited by scanning `Plan:` lines alone, so a table row in `.canon/tasks/priority.md` carrying a plan its task file never states leaves the count at zero and the row pointing at a moved file. `canon tasks validate` reports that pair as `plan-uncited` rather than the archive reading the row, which keeps the count on one surface and puts the disagreement in front of a person.

### Marking rides the chain and archiving rides the merge

`task-complete` runs as `git-ship` step 2 and marks outcomes only. Archiving at ship time was the alternative, and it lost: the pull request has not merged there, `canon tasks archive` cannot tell an open pull request from a merged one on outcomes alone, and the board is gitignored, so a task archived for work later abandoned has nothing to restore it from. The `post-merge` hook archives the task and moves its plans once the merge lands, and `task-complete`'s archive mode is the manual fallback for a task the hook could not resolve.

### A cross-cutting entry never refreshes from the diff

An entry describing a cross-cutting rule never refreshes from the diff. `context-fold` picks entries whose prose references files the diff touched, so an entry referencing no path at all is skipped by construction. Sort entries into the kind a diff refreshes and the kind the enforcing change is what invalidates, and edit the second by hand.

### A trigger keyed on a signal entering the tree

`context-fold` carries no figure sweep: an architecture view is redrawn on demand by `draft-figure` rather than watched on every ship. The shape is worth recording for any later trigger of that kind. An uncovered-kinds trigger fires only when a diff adds a signal and no figure covers that view, so a figure already drawn from something weaker is never told its real source now exists. A components view drawn from a code scan before the context index existed would go untold the day that file entered the tree, which is the source the architecture set names for it.

### A format change strands the predicates routing on it

When a format a skill parses changes shape, every predicate routing on the old shape has to move with it. The task `Plan:` line is the worked case: it carries a markdown link, so `task-complete` and `canon tasks archive` both read the target out of the parentheses, and a routing bullet still naming the bare-path form matches nothing for a link-form task, which falls to the final warn-and-skip and archives nothing.

### A ported condition keeps the test its source could afford

Lifting a conditional from another skill copies the clause rather than what it tests. `context-fold` calls a diff baseline unusable when it came from local `main` and equals HEAD, which misses `origin/main` resolving a merge base equal to HEAD, the shape of every feature branch before its first commit. It never pays for the gap because it unions the committed, working, and untracked sets, and ported verbatim into a skill reading the committed half alone it would blind that skill.

### A deterministic check backstops the session judgment writing the doc

`context-fold` Step 3 rewrites context entries on session judgment, which can leave an appended figure or a re-measurement sitting beside the statement it restates rather than replacing it. Step 4 closes that gap. It runs `canon context audit` and reports the findings on files the fold wrote or the diff carries, filtering the verb's whole-project record by file since the verb takes a root rather than a file list. Then it runs `canon context classify diff` over the fold's whole diff baseline and answers every non-`KEEP` finding rather than only the files Step 3 wrote this run, since an earlier commit on the branch can carry a doc edit the fold is equally responsible for.

The verb's own extraction scopes to canonical doc types and reports nothing when the range carries none, and it reuses the Diff baseline section's own base rather than resolving a second one.

A `REPLACE` or `HISTORY` finding is applied in place with a one-line reason to keep instead when it should not be. A `MOVE` finding is reported rather than cut, since the verdict means correct content on the wrong surface, such as a rule written into a context entry that belongs in a path-scoped rule, and only the model layer returns it.

The verb's regex layer always runs regardless of whether a project configures a model, so every fold gets a deterministic check rather than one gated on a backend being reachable. A refusal or a missing `context audit` or `context classify` subcommand on an older installed binary reports one line and the fold continues either way, since the classify step is a check on what the fold wrote and not a precondition for shipping it.

## Pull request writes

### Pull request detection hits a merged namesake

`gh pr view` resolves by head ref name and ignores state, so a branch name reused after its first pull request merged sends `git-pr`'s create-or-edit conditional down the edit arm and rewrites a merged record. The push reports `* [new branch]` either way, so nothing in the output suggests a collision. `canon/context/claude-plugin/skill-archiving.md` carries the detection `git-pr` runs instead.

Recovery takes the squash merge subject for the title and GraphQL `userContentEdits(last: 1)` for the body.

### A write after create can land on a pull request the run did not open

A ship run can label and draft another open pull request, such as the release one, a second after opening its own. The label step derives its number from the create call's URL, so it cannot produce that target. The draft step is where the number crosses into a command the session types, and a number inferred from the newest pull request in view is the leading account.

Every write to an existing pull request reads the head ref and state over REST first and refuses unless they are the current branch and `open`. `git-pr` runs the check as `assert_own_pr` inside its final command and prints `head=` beside the number, and `auto-ship` runs the same comparison in the same command as the draft mark, so the mark never runs on a mismatch. Both keep the comparison in the shell, since the session that picked a wrong number would be the one reading a printed check. The check compares a number against a branch and never derives one, so it holds whatever produced the wrong number and adds no lookup of the kind the merged-namesake gotcha above rules out.

### The draft mark and who lifts it

The `convertPullRequestToDraft` mutation against the node id writes the flag, since the REST pull request update carries no draft field. That makes the mark local-only: on a cloud VM, where GraphQL is blocked, it fails and the REST read-back reports the pull request ready. Read the flag back anyway, since it can revert after a later force-push, so a read is worth repeating whenever the branch is pushed again.

Readying a pull request to merge runs through `canon pr lift`, which reads the code review, any UI review, the evidence, the head's standing, and CI itself and lifts only when all of them read clear. Each reviewer runs it on posting its close, and the controlling session runs it as the fallback for a cloud reviewer, whose proxy refuses the mutation, and for a refusal a reviewer reports. The operator can still ready a pull request directly, since GitHub requires it and no guard should prevent it.

Keeping the lift with the controlling session alone was the alternative, and it lost once the verb existed. A reviewer refused the lift only because it could not tell a real request from one claiming to come from the controller, and a verb reading the gates itself needs no one to vouch for the request. Every session posts as the same GitHub account, so the verb trusts nothing the controller's own reading did not. `role-worker` still refuses an instruction to ready a pull request directly, whoever sends it, since that skips every gate the verb reads.

### A skip gate on a verb that answers for itself loses to a byproduct image

`git-pr` once skipped the evidence call when no checklist existed and the diff showed no `evidence/` change, which asked a session to find an image it never edited. `bun run check` regenerates the hero as a side effect, so two branches reached a closed review with no evidence comment and the preview only after a controller relay. The verb already answers `no-evidence` for a branch with nothing to post, so the gate decided nothing the verb could not, and lost on the one input the session could not see.

Both workers' thinking blocks were empty, so the cause is inferred from the transcripts rather than observed. The fix holds under any reading, since the call now runs on every pull request. The chain's close also reads `canon pr evidence <number> --check --json`, once, in `git-ship` after CI passes, and `git-followup` reads it after its own post. Nothing in the repository enforces that read beyond the skill bodies and the orchestrator's draft lift, which holds on any `reason` but `settled`.

`--check` counts a carried `**Preview:**` line as settled whatever head built it, so a followup push leaves a stale preview reading `settled`.

### A failed commit leaks into the next group

When a sequence of grouped commits runs unattended and one is rejected by a hook, its files stay staged and the next group's `git add` absorbs them, so the failure lands as a wrong commit rather than a missing one. A subject past `header-max-length` can carry two dozen files into the following group's message while the run reports a passing final `git log`, because the commit count is the only thing short.

### A branch built in slices reaches the stage step with nothing staged

`build-in-slices` commits each slice as it lands, so a branch whose sync steps write nothing arrives at `git-ship` step 6 with an empty index. `git-stage` stops on an empty index by design, so the step runs it only when a staged path exists and otherwise continues to the branch rename. The guard sits in `git-ship` rather than in `git-stage`, since a direct `git-stage` call on an empty index is still a mistake worth stopping on.
