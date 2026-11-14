---
title: Orchestrator shared files
description: What a dispatch does when a candidate shares a file with a track in flight, the practitioner evidence behind dispatching both, and how the tracks in flight are read for the conflict check
---

Read this from `## Check for a conflict with the tracks in flight` in `orchestrator-dispatch.md`, once the five holds there have cleared a candidate that still shares a path with a track in flight.

## A shared file is not a hold

Dispatch both and name the shared paths, so the merge order and the second branch's rebase are planned rather than discovered. The branch merging second resolves after the first merges, never against a sibling still building.

- It resolves by running `review-address` in the session that built it, whose Step 5 rebases the branch once it no longer merges
- A hunk needing a decision the tree does not carry goes to the controller
- A branch no live session holds gets the review-address shape in `orchestrator-launch.md`

## The evidence

No practitioner source serializes on a shared file. Each builds in parallel and tests at integration, where the merge surfaces a textual conflict and the suite over the merged result a semantic one.

- Fowler's [branching patterns](https://martinfowler.com/articles/branching-patterns.html) have the second integrator pull mainline in and check health "even if it's a clean merge"
- His [Semantic Conflict](https://martinfowler.com/bliki/SemanticConflict.html) names self-testing code as the first defense, and [DORA](https://dora.dev/capabilities/trunk-based-development/) keeps branches to a few hours
- GitHub's [merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) tests each pull request against everything queued ahead of it
- A candidate has no commits to trial-merge, so `git merge-tree` runs at integration and this check reads what a plan declares

## Reading the tracks

Read `canon sessions list --json` for the branches in flight as well as the board, since a hand-launched track carries no row, and read the plan of any branch no row names.

- `canon tasks validate` and `canon tasks plan-reach` report the paths two rows share, a candidate list for the five holds and the paths a dispatch names
- A shared folder means a plan declared it bare, so narrow that plan's list rather than reading the folder as a sweep
- A declared set predicts rather than bounds, since `canon:context-fold`, `canon:docs-sync`, and the drift stages write past every plan
- Such a crossing changes what the second branch rebases over, not whether a row holds, and `canon tasks plan-reach` at `canon:git-ship` step 5 names it
