---
title: Reclaim
description: The reading canon worktrees list takes to decide which worktree is safe to remove after its work ships, why it refuses on an unreadable input, and the removal routes it reports
---

# Reclaim

## The reclaim reading

`canon worktrees list` reports which worktrees can be removed once their work ships, which the sweep after a merge does not read on its own. It is composed in `src/worktrees/reclaim.ts` out of the worktree listing, the merged pull requests, a status read per directory, and the session roster.

Git ancestry is the reading anyone reaches for, and it is wrong in both directions here, which is why this is a verb rather than a line in the sweep runbook. This repository squash merges, so a merged branch is never an ancestor of `main`: `git merge-base --is-ancestor` called five of six lingering branches unmerged, each with a merged pull request. The one branch it called merged had no pull request at all, sat at a release commit, and its worktree held finished work outside any commit. The cheap test kept every directory safe to remove and offered the only one that was not.

Reclaimable takes all three of a merged pull request, a clean working tree, and no live session holding the directory, and `refusals` names every failing condition rather than the first. Each alone has a case where removal loses something, and removal is the unrecoverable direction, since a worktree is gitignored scratch with no history behind it. Untracked files count as uncommitted for that reason.

### Reading the merges

The pull request read is one `gh pr list --state merged` for the repository rather than one call per worktree, which would put a network round trip inside a loop. It covers the most recent 200 merges, so an older worktree reads as having none and is refused, which fails in the keeping direction.

That read strips the git resolution variables through `gitEnv()` the way every git read in the file does, because `gh` resolves its repository through git and those variables take precedence over the working directory it is handed. With `GIT_DIR` naming a remote-less repository, the stripped call reads this repository's merges while a bare `gh repo view` beside it answers `no git remotes found`. A run from inside a hook would otherwise match a branch name against another repository's merges, and branch names recur, so the wrong answer arrives in the direction that removes a live worktree. `src/github.ts` carries the only other `gh` call in the tree and does not strip the same variables.

### Refusing the whole reading

An unreadable input refuses the whole reading rather than producing verdicts around it, on the argument `refsReadable` makes in `canon/context/claude-internal/orchestration/dispatch.md`. An absent merge state and a branch with no merged pull request produce the same empty answer, as do an absent roster and a worktree nobody holds, and reporting the second when it was the first is a false clean that ends in a removal rather than in a duplicate dispatch. Two flags beside the verdicts was the alternative and it puts the same false clean behind a boolean a caller has to remember to read.

What the reading cannot decide is the session a wind-down is about to retire. A planner is refused as `main-worktree` and handed a null removal route, since it never enters a worktree and registers against the tree it was launched from, and an unmerged worker's directory is refused on `no-merged-pull-request` however that worker went. Neither ever surfaces as reclaimable, so `orchestrator-handoff.md` takes both by hand off the delivery the controlling session received, `status` on the roster reading `busy` or `waiting` about the last turn rather than about the work.

The refusal list settles the order between the two acts. `held-by-session` refuses a directory a live session holds, so a reclaim taken ahead of the retirement refuses the directories that retirement is about to free, and the handoff runs the retirement first for that reason.

## Reclaiming without removing

`route` reports which removal shape applies rather than choosing one. `claude rm <id>` is meant to remove a background session and its worktree together while a session exists, though its own report is not reliable, so `canon worktrees list` is the reading to trust afterward, and a worktree whose session has ended needs `git worktree remove` and a branch delete instead. The argument is the id `claude agents --json` carries rather than the name, so a caller holding the `sessions` field matches a name to an id there before the call. Deleting a directory underneath a live session is the case that has to refuse, so a held worktree is refused and its route is reported for whoever decides to act on it.

The `sessions` field carries `{name, kind, id}` per holder rather than a bare name, since `kind` separates a background holder from an interactive one and the two differ on whether an id exists at all. A resolved background holder's `id` is the value `claude agents --json` reported, and an unresolved one's is `null` when that read could not answer for the pid. An interactive holder's `id` is always `null`, because no id exists for one to begin with, and nothing removes it until a person closes its terminal, which is the dead end this shape exposes rather than closes. `kind` reads `bg` off this repository's own session registry where `claude agents --json` names the same state `background`, so a comparison written against the client's own spelling never matches.

`canon worktrees list` reports and removes nothing, and `canon worktrees reclaim` beside it removes what that reading called reclaimable. The read ships apart from the act because the failure mode is unrecoverable and the measurement behind the reading is a single afternoon, so a caller takes the verdicts without ever reaching the second verb. A local hook cannot carry any of this either: merging happens on GitHub, so the husky `post-merge` hook fires only when the operator later pulls, runs in the main worktree, and knows nothing about which pull request landed.
