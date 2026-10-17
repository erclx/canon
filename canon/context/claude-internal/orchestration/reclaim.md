---
title: Reclaim
description: The reading canon worktrees list takes to decide which worktree is safe to remove after its work ships, why it refuses on an unreadable input, and the removal routes it reports
---

# Reclaim

## Decisions

### The reclaim reading

`canon worktrees list` reports which worktrees can be removed once their work ships, which the sweep after a merge does not read on its own. It is composed in `src/worktrees/reclaim.ts` from the worktree listing, the merged pull requests, a status read per directory, and the session roster.

### Why not git ancestry

Ancestry is the reading anyone reaches for and it is wrong in both directions here, which is why this is a verb rather than a line in the sweep runbook. This repository squash merges, so a merged branch is never an ancestor of `main`.

- `git merge-base --is-ancestor` called five of six lingering branches unmerged, each with a merged pull request
- The one it called merged had no pull request, sat at a release commit, and held finished work outside any commit
- The cheap test kept every removable directory and offered the only one that was not

### What reclaimable requires

Reclaimable takes all three of a merged pull request, a clean working tree, and no live session holding the directory. `refusals` names every failing condition rather than the first.

Each alone has a case where removal loses something, and removal is the unrecoverable direction, since a worktree is gitignored scratch with no history. Untracked files count as uncommitted for that reason.

### Reading the merges

The pull request read is one `gh pr list --state merged` for the repository, not one call per worktree, which would put a network round trip inside a loop. It covers the most recent 200 merges, so an older worktree reads as having none and is refused, which fails in the keeping direction.

### Stripped git variables

The read strips the git resolution variables through `gitEnv()` as every git read in the file does, because `gh` resolves its repository through git and those variables outrank the working directory it is handed.

- With `GIT_DIR` naming a remote-less repository, the stripped call reads this repository's merges while a bare `gh repo view` answers `no git remotes found`
- A run from inside a hook would otherwise match a branch name against another repository's merges. Branch names recur, so the wrong answer removes a live worktree.
- `src/feedback/github.ts` carries the only other `gh` call in the tree and does not strip the same variables

### Refusing the whole reading

An unreadable input refuses the whole reading rather than producing verdicts around it, on the argument `refsReadable` makes in `canon/context/claude-internal/orchestration/dispatch.md`. An absent merge state and a branch with no merged pull request give the same empty answer, as do an absent roster and a worktree nobody holds.

Reporting the second when it was the first is a false clean that ends in a removal rather than a duplicate dispatch. Two flags beside the verdicts would put the same false clean behind a boolean a caller must remember to read.

### What the reading cannot decide

The reading cannot decide the session a wind-down is about to retire.

- A planner is refused as `main-worktree` with a null removal route, since it registers against the tree it was launched from
- An unmerged worker's directory is refused on `no-merged-pull-request` however that worker went
- Neither surfaces as reclaimable, so `orchestrator-handoff.md` takes both by hand off the delivery the controller received. Roster `status` reads `busy` or `waiting` about the last turn, not the work.

### Retirement runs first

`held-by-session` refuses a directory a live session holds, so a reclaim taken ahead of the retirement refuses the directories that retirement is about to free. The handoff runs the retirement first for that reason.

### Reclaiming without removing

`route` reports which removal shape applies rather than choosing one. `claude rm <id>` is meant to remove a background session and its worktree together, though its own report is unreliable, so `canon worktrees list` is the reading to trust afterward.

- A worktree whose session has ended needs `git worktree remove` and a branch delete instead
- The argument is the id `claude agents --json` carries, not the name, so a caller holding the `sessions` field matches name to id before the call
- A held worktree is refused and its route reported for whoever decides to act, since deleting a directory under a live session is the case that must refuse

### The sessions field

The `sessions` field carries `{name, kind, id}` per holder, since `kind` separates a background holder from an interactive one and only the first can have an id.

- A resolved background holder's `id` is the value `claude agents --json` reported, and `null` when that read could not answer for the pid
- An interactive holder's `id` is always `null`, and nothing removes it until a person closes its terminal, a dead end this shape exposes rather than closes
- `kind` reads `bg` off this repository's session registry where the client spells the state `background`, so a comparison against the client's spelling never matches

### List and reclaim are separate verbs

`canon worktrees list` reports and removes nothing, and `canon worktrees reclaim` removes what that reading called reclaimable. The read ships apart from the act because the failure mode is unrecoverable and the measurement behind the reading is a single afternoon, so a caller can take the verdicts without ever reaching the second verb.

A local hook cannot carry this either. Merging happens on GitHub, so the husky `post-merge` hook fires only when the operator later pulls, runs in the main worktree, and knows nothing about which pull request landed.
