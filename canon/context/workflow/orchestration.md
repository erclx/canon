---
title: Orchestration
description: The task, plan, and ready artifacts coordinating multi-session work, the board, and the dispatch, review, and reclaim steps that move a row to merged
---

# Orchestration

## Overview

`docs/workflow/operating-model.md` owns the three roles and their loop, and `canon docs operating-model` reaches it in a target. This entry covers the artifacts that make a handoff mechanical, the board, and the steps to merge. The board, tasks, and plans are gitignored, so they are undated, held by one orchestrator, and cited from no diff.

## Layout

### `.canon/tasks/`

Holds one task file per task, the board surfaces `priority.md` and `backlog.md`, and one `session-<slug>.md` handoff per session. `canon tasks place`, `promote`, `move`, `block`, and `plan-link` write `priority.md`, each rendering every table from the task files and their plans, so only `Waiting on` is typed.

- `priority.md` groups rows under `## Run now`, `## Up next`, and `## Needs a plan`, and `backlog.md` holds decided work nobody has scheduled, which is no fourth group
- `canon tasks validate` reads and never writes, since a validator repairing a row asserts the claim it tests, and lists `## Run now` overlaps in `shared` without moving an exit code
- A blocker cell is prose, and `src/tasks/trunk.ts` settles a cited task only when a commit naming its `Pull request:` number sits on `origin/main`
- A blocker resting on judgment goes to the `untested` array, so the check never claims more than it settled
- A worker files no task, because `task-board` stops it before `canon tasks next-label --claim` and placing the row is the controller's call

### `.canon/plans/`

Holds one plan per task, archived beside the task on ship.

- `canon tasks archive` moves the task, its plan, and the folder its `Ready:` line names, and the `post-merge` hook calls it with the number the merge subject carries
- A plan several live tasks hold stays live, decided by `otherTasksCitingPlan` in `src/tasks/archive.ts` and reported by `plan-citations`
- `planLineIndex` finds the first `Plan:` line outside a fenced sample, and a line linking several plans is a sliced task
- `next-label --claim` reserves a label under `.canon/ordinal-locks/`, since a bare read lets two callers land on one answer

### `claude/skills/plan-feature/`

Owns the plan shape that a planner writes and a worker or controller reads.

- A question answered by narrowing scope leaves the dropped board outcome `[ ]`, so the task stays live and the merge archives no plan
- The numbered questions are coupled, so re-read every answer as one set for a later answer whose mechanism an earlier one chose not to supply
- Where a `- Suggested:` line conflicts with a Files-to-touch line for the same file, the suggestion wins and the reconciliation is reported
- A plan's file list is a measurement from the day it was written, so re-run its count before treating it as the scope

### `src/tasks/`

Owns the `canon tasks` verbs that validate, archive, derive from, and write the board. `board.ts` refuses a row naming no task or one whose blocker its header cannot place, since a render would drop or rewrite it in a gitignored file, and checks a group move against the predicates `validate.ts` exports.

- `plan-branch` is the one branch derivation, called by the dispatcher and by `auto-ship` Step 0, and its type is a constant because the type is cosmetic
- `plan-answers` reports `launchable` from a `needs your call` suggestion over an empty slot, and holds a fan-in integrator until each member branch is on origin, since a local head exists mid-build
- `resolvePlanReference` tries the project root and then the board directory, and an archived plan refuses as `archived`
- The overlap checks read a row's paths from its plans, since a `Touches` cell only counts them. `sharesPath` collides a folder a plan declares with every file under it on purpose.
- `plan-reach` reports the paths a branch wrote beyond its plan and gates nothing

### `src/intake/`

Reads and answers the intake folders under `.canon/intake/`, behind `canon intake list`, `canon intake answer`, and `canon intake drive-check`.

- `items.ts` parses an item's heading and its bolded field bullets, and skips `00-overview.md`, which points at items and carries no answer slot
- `folder.ts` resolves a slug to a folder and refuses with a named reason, such as `ambiguous-slug` or `answered`, before it writes a selection into an answer slot
- `drive-check.ts` matches a goal by its text with the bold label and trailing period stripped, so a goal reworded after a drive reads as both unmapped and unknown
- `undrawn` reads the drive log by its exact `Drawn` and `Decision (operator)` labels, so renaming either in `drive-record.md` turns the axis off silently. The test parses that reference's example.

### `src/worktrees/`

Owns the reclaim reading behind `canon worktrees list` and `reclaim`. `stop.ts` signals every listener inside a reclaimable path ahead of the removal, and a machine with no listener reader removes anyway and records `stopped` as null, never zero.

- A worktree is reclaimable only with a merged pull request, a clean tree, and no live session in the roster `src/sessions/` holds, and `refusals` names every failing condition
- Ancestry to `main` cannot decide it after a squash. A fan-in member has no pull request, so `members.ts` reads the integrator's member line and checks each tip against its merged head.
- The merged read is one `gh pr list` over the latest 200 merges, run through `gitEnv()` so a stray `GIT_DIR` cannot aim `gh` at another repository
- An unreadable input refuses the whole reading, because a false clean ends in a removal
- A planner reads `main-worktree` and an unmerged worker `no-merged-pull-request`, so the handoff retires both by hand and does so first

### `claude/skills/role-orchestrator/references/`

Holds the runbooks for moments the model cannot detect, shipped inside the skill so they resolve in a project running no install.

- `orchestrator-dispatch.md` launches a `## Up next` row through `claude --bg` after checking its branch, plan answers, claim, and conflicts, then promotes it to `## Run now`
- A row holds behind a track in flight only on a dependency, a changed contract, a relocation, a sweep, or a stated reason, and a shared file is no hold
- A launch names its model by the cost of a miss, and a worker is named `worker-<…>` and carries the controller's `sessionId`, resolved to a name at send time
- `orchestrator-sweep.md` refills the queue and then fires `orchestrator-parked.md`, which re-tests untested blockers on a merge and walks every parked row and the backlog when idle
- A planner brief states no worktree, branch, tracked file, or board write, and skips the build checks, and a talk session takes a `-talk` suffix and is retired only on the operator's word

### `claude/skills/session-map/`

Owns the handoff the orchestrator adds three sections to.

- `orchestrator-handoff.md` writes the map and `orchestrator-resume.md` reads it, adding delegated decisions, the review-poll restart, and `## Talk sessions held open`
- One file per session keeps two writers off one path, and `isReservedStem` in `src/tasks/archive.ts` stops the task verbs counting it, reading the `session-` prefix from `src/records/session-map.ts`
- `canon records validate sessions` counts a map against the cap in `src/records/session-map.ts`, which a test pins to `session.md`
- The count drops the closing block by its exact `## Resume` heading, so renaming it in `orchestrator-handoff.md` puts the block back in the count
- `session-resume` filters `index`, `priority`, `backlog`, and `session-` rows before it counts tasks, so a new sibling in the folder must reach that reader

### `claude/skills/role-orchestrator/`

Owns the orchestrator body and requirement, which state the dispatch policy.

- After any change to the shared-file policy, search every spelling in the body, its requirement, five runbooks, and two workflow docs, including `wiring seam`, `serialize`, and `shared file`
- Check a peer's claim about what a merge did against its commits, since an add followed by a remove reads as an untouched file in the net diff

### `claude/skills/role-orchestrator/scripts/`

Holds `poll.ts`, `watch.ts`, and the `repo.ts` they share. Tests sit in `src/claude/orchestrate-poll.test.ts` and `orchestrate-watch.test.ts`.

- `poll.ts` keeps its baseline at `.canon/tmp/pr/poll/baseline.txt` under the main worktree root, read as the first ten space-separated fields
- `RESPONSE` needs a new reply count and a reply newer than the last pass, and `canon pr review-state` is the only parser of the `review-pr` and `review-ui` markers
- `STALE` and `OVERLAP` read the base from the pull request's diff against `git merge-base`, and `OVERLAP` merges only pairs sharing a written path
- `poll.ts --check <number>` rereads base and head without writing, since the draft lift cannot trust a baseline as old as the last run
- `watch.ts` reads pull requests and the roster every 60 seconds, and `WORKER-STOPPED` fires on a `waiting` row past `STALL_THRESHOLD_S`

### `.claude/hooks/`

Holds the hooks, and `cloud-setup.sh` stages a cloud build.

- It runs on `SessionStart` only when `CLAUDE_CODE_REMOTE=true`, copying `claude/skills/*` into `.claude/skills/` and linking `canon` to the checkout
- Every path it writes goes into `.git/info/exclude`, since `.gitignore` would itself be a diff
- The plan travels as launch-prompt text, since the VM holds no `.canon/`, and the claim reads open `claude/` pull request comments for an `ANNOUNCE:` or `QUESTION:` line naming the plan

### Other folders

The remaining surfaces each own one slice.

- `.canon/ready/` holds only archived folders under `archive/`, which `canon tasks archive` still moves and retargets for an older task's `Ready:` line
- A posted finding reaches the worker as a message from the reviewer, who receives the re-review request directly, so the controller hears only a close, a refusal, or a block
- The controller falls back as sender for a cloud reviewer or an unreachable side, as `orchestrator-handback.md` states, and the poll's after-finding rule skips a pass a live reviewer sent on
- A cloud worker has no GraphQL, so its draft mark reads ready and `git-pr` deletes the session link the harness appends
- `crossSessionInbound` stays unset, since `hold` and `refuse` break the worker handback and `accept` bounds nothing

## Gotchas

- A plan carried as an intro link rather than a `Plan:` line is skipped silently by the `git-pr` number write, so the merge archives no plan
- `canon tasks archive` retargets only the closing task's `Plan:` line, so a sibling row in `priority.md` keeps a dead link until the next board verb re-derives its Plan cell
- A review's `commit.oid` is the head at submission, so a `SEEN` with `source` reading `fallback` may cover a commit the pass never read
- `src/gate/boundaries.ts` bans only `wiki/` in the Skill paths measure, so a skill citing a toolkit-only path passes clean
- `OPERATOR_CALL_PHRASES` in `src/records/validate.ts` covers two paraphrases of the operator-call phrase, so a third reads `launchable: true`
