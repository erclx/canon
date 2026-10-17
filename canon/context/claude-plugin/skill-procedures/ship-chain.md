---
title: Ship chain
description: The hazards a ship chain meets, from a citation count that reads one surface to a pull request write landing on the wrong target
---

# Ship chain

## Board and doc refresh

### A citation count that reads one surface misses the other

Sweeping every task on the board rather than the session's own can archive a plan still live and growing in a locked parallel worktree, with no history to recover from. Settling a plan's archive on the merge closes that, since a branch still building has not merged.

`archiveTask` decides whether a plan is still cited by scanning `Plan:` lines alone. A row in `.canon/tasks/priority.md` carrying a plan its task file never states leaves the count at zero and the row pointing at a moved file.

- `canon tasks validate` reports that pair as `plan-uncited` rather than the archive reading the row
- This keeps the count on one surface and puts the disagreement in front of a person

### Marking rides the chain and archiving rides the merge

`task-complete` runs as `git-ship` step 2 and marks outcomes only. Archiving at ship time lost as the alternative for three reasons.

- The pull request has not merged, and `canon tasks archive` cannot tell an open pull request from a merged one on outcomes alone
- The board is gitignored, so a task archived for work later abandoned has nothing to restore it from
- The `post-merge` hook already archives the task and moves its plans once the merge lands

`task-complete`'s archive mode is the manual fallback for a task the hook could not resolve.

### A cross-cutting entry never refreshes from the diff

`context-fold` picks entries whose prose references files the diff touched, so an entry referencing no path at all is skipped by construction. Sort entries into the kind a diff refreshes and the kind the enforcing change invalidates, and edit the second by hand.

### A trigger keyed on a signal entering the tree

`context-fold` carries no figure sweep, since `draft-figure` redraws an architecture view on demand rather than on every ship. The shape is worth recording for any later trigger of that kind.

- An uncovered-kinds trigger fires only when a diff adds a signal and no figure covers that view
- A figure already drawn from something weaker is therefore never told its real source now exists
- A components view drawn from a code scan before the context index existed goes untold the day that file enters the tree, though the architecture set names it as the source

### A format change strands the predicates routing on it

When a format a skill parses changes shape, every predicate routing on the old shape has to move with it. The task `Plan:` line is the worked case, since it carries a markdown link and `task-complete` and `canon tasks archive` both read the target out of the parentheses.

A routing bullet still naming the bare-path form matches nothing for a link-form task. That task falls to the final warn-and-skip and archives nothing.

### A ported condition keeps the test its source could afford

Lifting a conditional from another skill copies the clause rather than what it tests. `context-fold` calls a diff baseline unusable when it came from local `main` and equals HEAD. That misses `origin/main` resolving a merge base equal to HEAD, the shape of every feature branch before its first commit.

`context-fold` never pays for the gap because it unions the committed, working, and untracked sets. Ported verbatim into a skill reading the committed half alone, the clause would blind that skill.

## The context audit backstop

### A deterministic check backstops the session judgment

`context-fold` Step 3 rewrites entries on session judgment, which can leave an appended figure or a re-measurement beside the statement it restates. Step 4 closes that gap in two moves.

- It runs `canon context audit` and reports findings on files the fold wrote or the diff carries, filtering the whole-project record by file since the verb takes a root
- It runs `canon context classify diff` over the whole diff baseline and answers every non-`KEEP` finding, since an earlier branch commit can carry a doc edit the fold answers for

The verb scopes to canonical doc types, reports nothing when the range carries none, and reuses the Diff baseline section's own base rather than resolving a second one.

### How each verdict is answered

Each non-`KEEP` verdict has its own answer.

- `REPLACE` and `HISTORY` are applied in place, with a one-line reason to keep instead when it should not be
- `MOVE` is reported rather than cut, since it means correct content on the wrong surface, such as a rule sitting in a context entry, and only the model layer returns it

The regex layer always runs whether or not a project configures a model, so every fold gets a deterministic check. A refusal, or a missing `context audit` or `context classify` subcommand on an older installed binary, reports one line and the fold continues, since classify checks what the fold wrote and is not a precondition for shipping it.

## Pull request writes

### Pull request detection hits a merged namesake

`gh pr view` resolves by head ref name and ignores state. A branch name reused after its first pull request merged sends `git-pr`'s create-or-edit conditional down the edit arm and rewrites a merged record.

The push reports `* [new branch]` either way, so nothing in the output suggests a collision. `canon/context/claude-plugin/skill-archiving.md` carries the detection `git-pr` runs instead. Recovery takes the squash merge subject for the title and GraphQL `userContentEdits(last: 1)` for the body.

### A write after create can land on a pull request the run did not open

A ship run can label and draft another open pull request, such as the release one. The label step takes its number from the create call's URL, so it cannot produce that target. The draft step is where the number crosses into a command the session types, and the leading account is a number inferred from the newest pull request in view.

Every write to an existing pull request reads the head ref and state over REST first and refuses unless they are the current branch and `open`.

- `git-pr` runs the check as `assert_own_pr` inside its final command and prints `head=` beside the number
- `auto-ship` runs the same comparison in the same command as the draft mark, so the mark never runs on a mismatch
- Both keep the comparison in the shell, since the session that picked a wrong number would be the one reading a printed check

The check compares a number against a branch and never derives one. It holds whatever produced the wrong number and adds no lookup of the kind the merged-namesake gotcha rules out.

### The draft mark

The `convertPullRequestToDraft` mutation against the node id writes the flag, since the REST pull request update carries no draft field. The mark is therefore local-only, and on a cloud VM where GraphQL is blocked it fails and the REST read-back reports the pull request ready.

Read the flag back anyway, since it can revert after a later force-push, and repeat the read whenever the branch is pushed again.

### Who lifts the draft

Readying a pull request to merge runs through `canon pr lift`, which reads the code review, any UI review, the evidence, the head's standing, and CI itself, and lifts only when all of them read clear.

- Each reviewer runs it on posting its close
- The controlling session runs it as the fallback for a cloud reviewer, whose proxy refuses the mutation, and for a refusal a reviewer reports
- The operator can still ready a pull request directly, since GitHub requires it and no guard should prevent it

Keeping the lift with the controlling session alone lost once the verb existed. A reviewer was refused only because it could not tell a real request from one claiming to come from the controller, and a verb reading the gates itself needs no one to vouch for the request.

- Every session posts as the same GitHub account, so the verb trusts nothing the controller's own reading did not
- `role-worker` still refuses an instruction to ready a pull request directly, whoever sends it, since that skips every gate the verb reads

### A skip gate on a verb that answers for itself loses to a byproduct image

A gate skipping the evidence call when no checklist exists and the diff shows no `evidence/` change asks a session to find an image it never edited. `bun run check` regenerates the hero as a side effect, so a branch can reach a closed review with no evidence comment and the preview only after a controller relay.

The verb already answers `no-evidence` for a branch with nothing to post, so the gate decided nothing the verb could not, and lost on the one input the session could not see. The cause is inferred from transcripts rather than observed, so the call runs on every pull request, which holds under any reading.

- The chain's close reads `canon pr evidence <number> --check --json` once in `git-ship` after CI passes, and `git-followup` reads it after its own post
- Nothing in the repository enforces that read beyond the skill bodies and the orchestrator's draft lift, which holds on any `reason` but `settled`
- `--check` counts a carried `**Preview:**` line as settled whatever head built it, so a followup push leaves a stale preview reading `settled`

## Commit sequences

### A failed commit leaks into the next group

When grouped commits run unattended and a hook rejects one, its files stay staged and the next group's `git add` absorbs them, so the failure lands as a wrong commit rather than a missing one.

A subject past `header-max-length` can carry two dozen files into the following group's message while the run reports a passing final `git log`, because the commit count is the only thing short.

### A branch built in slices reaches the stage step with nothing staged

`build-in-slices` commits each slice as it lands, so a branch whose sync steps write nothing arrives at `git-ship` step 6 with an empty index. `git-stage` stops on an empty index by design, so the step runs it only when a staged path exists and otherwise continues to the branch rename.

The guard sits in `git-ship` rather than in `git-stage`, since a direct `git-stage` call on an empty index is still a mistake worth stopping on.
