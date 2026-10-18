---
title: Parallel features
description: Run independent features in parallel worktrees, with the records and board every session shares
category: Workflow
---

# Parallel features

Run independent features in parallel, one git worktree and one Claude Code session per feature.

## One worktree per feature

- Invoke `canon:plan-feature` in each session. Plans land at `.canon/plans/feature-<slug>.md` at the main root.
- `ui-checklist` writes a per-branch handoff at `tmp/handoff/ui-checklist/<slug>.md`, which `pr-evidence` posts and removes. The slug is the branch name minus its leading type segment.
- Ship each worktree with `canon:git-ship`, or `canon:auto-ship` for a draft pull request
- Only the operator or the controlling session readies a draft

## A coordinated flow

Assert the orchestrator role in one warm session with `canon:role-orchestrator`. It plans each feature or dispatches a cold planner under `canon:role-planner`, and dispatches a reviewer under `canon:role-reviewer` for each PR. The human launches workers and merges. See [operating model](operating-model.md).

- Run one orchestrator at a time
- Execution order comes off `.canon/tasks/priority.md`
- Before a handoff, grep each construct the plan names and open each file it describes
- A constraint naming a track in flight opens with the commit it was measured against. A merge of that track into `origin/main` over the named paths kills the constraint.

## Records at the main root

`.canon/plans/` and `.canon/review/` resolve at the main worktree root. File-editing tools refuse a main-root path from a worktree, so write a whole file through the shell and change an existing one through a `canon` verb.

`claude/skills/plan-feature/references/plan.md` fixes the plan's shape and `claude/skills/plan-feature/references/plan-lifecycle.md` its lifecycle. A blank `- Answer:` slot accepts the `- Suggested:` line.

- To pick otherwise, rewrite that line as `overridden at execution to <pick>,` plus the measurement, and add one line to the open task's `## Findings`

- `canon records validate plans` reports a plan breaking its standard, and takes `groundwork`, `intake`, and `teach`
- `canon records push` and `canon records pull` carry `.canon/` to and from a private repository. See [records](../agents/records.md).
- `canon records size`, `canon records prune-tmp`, and `canon records stale canonical` report folder size, idle scratch, and releases since the requirements review
- `canon tasks archive` moves a shipped plan to `.canon/plans/archive/` and retargets the task's `Plan:` line

## Shipping a fan-out

Merge order matters only when two branches touch the same file. Expect to rebase over `CLAUDE.md`, `tooling/**`, `canon/context/context-model.md`, `docs/agents/`, and any folder's `index.md`. Resolve an `index.md` conflict with `canon indexes regen` over the rebased tree.

- **Fan-in.** Batches of one change sharing edge files ship as one pull request, opened by an integrator that merges each member branch. See `claude/skills/plan-feature/references/batches.md`.
- **Merge order.** Merge the smallest hotspot footprint first, and a branch touching `CLAUDE.md` or a context entry last.
- **Rebase.** The branch merging second runs `/review-address`, which trial-merges against `origin/main` and rebases. Push, then merge.
- **Clean up.** Run `/git-worktree cleanup` to remove merged worktrees. To start fresh, `ExitWorktree(action: "keep")`, then `/session-worktree <new-name>`.
- **Wrong call.** If a rebase needs a decision the tree does not carry, land one branch before starting the next.

## The task board

`.canon/tasks/` is gitignored and resolves at the main worktree root, one file per task. A hook generates `index.md`, and `priority.md` carries execution order and blockers. `canon tasks place`, `promote`, `move`, and `block` write it, deriving every cell but `Waiting on`.

`canon tasks validate` reports and never writes:

- A row's cell count must match its header, and a `## Needs a plan` row stating its position is checked against where it sits
- Every plan pointer resolves, every task file is named once, and every ready row names its files
- A parked row is reported when its cited task reached the trunk, whether the cell links it or names its bare label
- A group header must be the columns the group owns, a `Touches` cell must match its plan, and a `Waiting on` cell renders at most 120 characters

`canon:task-board` creates a task file, and `canon:task-complete` marks outcomes. The `post-merge` hook archives the task a merged pull request closed, with its plan, and a `post-rewrite` hook does the same for a rebase pull. Both archive only when the merge carried a PR number and the task is closed.

`CANON_SKIP_RECLAIM`, `CANON_SKIP_UPGRADE`, and `CANON_SKIP_PLUGIN_UPDATE` turn off the three hook steps that act on the machine.
