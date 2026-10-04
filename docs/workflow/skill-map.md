---
title: Skill map
description: When to reach for each plugin skill, grouped by the moment a project meets it
category: Workflow
---

# Skill map

Groups run in the order a project meets them. They reconcile the scenarios in [AI workflow](ai-workflow.md) with the lifecycle [target projects](../target/projects.md) describes, so every moment either one names has a group. Each row says when to reach for a skill, and its description says what it does.

This page and [skill map on request](skill-map-on-request.md) are the corpus the coverage claim is measured against: every name `canon claude skills list --names` reports takes exactly one row across the two. A skill serving two moments sits at the earlier one, this page counting as earlier than the sibling, and a mention on any other page is prose rather than routing. The sibling holds the groups that answer a request rather than mark a moment.

Each row sits under the group its skill's `metadata.family` names. The landing page's skills field groups by that field and reads each row's text from both pages, so its build refuses a skill with no row, a row naming no skill, a row filed under another group, and a heading on either page naming no family group, even one with no rows under it. A new group takes its vocabulary entry in `src/claude/skills-families.ts` before its heading lands here.

## Set up a project

| Skill                  | When to use                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `canon:target-setup`   | On a fresh scaffold, to detect the stack and run the install chain, or to reach one phase of it alone       |
| `canon:canon-operator` | On a project that already exists, to read what it carries before an install is picked                       |
| `canon:sketch-design`  | Before `design-extract`'s greenfield path, to trace a design direction from reference images or URLs        |
| `canon:design-extract` | Before the first UI feature, to draft `canon/DESIGN.md`                                                     |
| `canon:deploy-app`     | Once a project is ready to publish, to set up its Cloudflare or Vercel deploy and stop for token and domain |
| `canon:repo-metadata`  | When the GitHub About text, homepage, or topics may have drifted, to reconcile them against the README      |

## Decide what to build

| Skill                      | When to use                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| `canon:plan-intake`        | When the input is a pile of findings rather than one feature                      |
| `canon:plan-intake-answer` | When an intake folder holds unread slots waiting on your decision                 |
| `canon:backlog-triage`     | When the backlog needs pruning, to file a verdict per row and apply approved ones |
| `canon:plan-groundwork`    | When the state is unmeasured and more than one approach is live                   |
| `canon:decision-escalate`  | When open decisions turn on your preference and want batching into one set        |
| `canon:draft-and-pick`     | When the call is taste and wants several candidates rendered side by side         |
| `canon:canvas`             | When a direction should be drawn as frames the operator can see, select, and edit |
| `canon:task-board`         | When a decided item needs a file on the board, or a shipped one needs archiving   |
| `canon:plan-feature`       | When the approach is settled and the next step is a plan                          |
| `canon:codebase-layout`    | When a plan or change adds a file and you need to decide which folder holds it    |

## Build the feature

| Skill                         | When to use                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `canon:session-worktree`      | At the plan-to-execute boundary, to get an isolated tree and branch, or to route a refused main-root write |
| `canon:auto-ship`             | After plan approval, to chain implement, verify, review, draft PR                                          |
| `canon:project-commands`      | When the project's own command needs running                                                               |
| `canon:test-first`            | Before implementing a planned change, to run its test red, green, then refactor                            |
| `canon:test-craft`            | When writing or changing any test, to pick its layer and filter what it asserts                            |
| `canon:build-in-slices`       | While building a plan, to commit each tested slice and note out-of-scope defects rather than fix them      |
| `canon:api-design`            | When changing what a caller sees, being an export, a flag, an output shape, or a retried write             |
| `canon:deprecation-migration` | When deleting or replacing code something may still call, to migrate its callers and prove none remain     |
| `canon:code-craft`            | Before writing a function, class, or module, to pick the shape the next change needs                       |
| `canon:review-craft`          | When reviewing a change, for what to look for and how much evidence a finding needs                        |
| `canon:search-craft`          | Before searching outside the project, to derive where the field's authorities publish and search there too |
| `canon:systematic-debugging`  | When a test fails or a bug surfaces, to force root cause first                                             |
| `canon:design-taste`          | When drafting or judging an interface, or when output reads generic, to settle which decision comes first  |
| `canon:video-craft`           | Before composing or judging a video, for sourced captions, zoom, pointer, and audio judgment               |
| `canon:ui-checklist`          | After a UI change, to write what to look at and name what ships untested                                   |

## Check the work before it leaves the branch

| Skill                    | When to use                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `canon:review-branch`    | On the local branch diff, before anything is pushed                                     |
| `canon:document-health`  | When the documents themselves have to answer for length, placement, and staleness       |
| `canon:markdown-propose` | When a markdown claim needs rewriting and the change should wait for an answer per file |
| `canon:ux-audit`         | To read UI source for missing states, edge cases, and inconsistencies                   |
| `canon:ux-measure`       | To start the interface and measure paint, processor, and layout cost                    |
| `canon:ux-walkthrough`   | To run a multi-finding inspection pass over a running app with the operator             |

## Ship it

| Skill                  | When to use                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `canon:git-ship`       | To run the whole post-feature chain from the verify gate through open PR              |
| `canon:memory-capture` | First skill in that chain, to route what the session learned to the surface owning it |
| `canon:context-fold`   | When decisions diverged from the plan, or a shipped task needs its outcomes marked    |
| `canon:docs-sync`      | When a change since main left `README.md` or `docs/` stale                            |
| `canon:git-stage`      | When the staged set spans several concerns and wants one commit each                  |
| `canon:git-commit`     | When the staged set is one concern, or was staged hunk by hand                        |
| `canon:git-branch`     | When a branch name needs generating or renaming to conventional form                  |
| `canon:git-pr`         | When a pull request needs a title and body written from the diff                      |
| `canon:memory-review`  | When the pen has grown, to propose where each entry belongs                           |

## After the pull request opens

| Skill                  | When to use                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `canon:review-pr`      | From an independent session, to post findings on the PR itself         |
| `canon:review-ui`      | Beside the code review, to drive the PR's checklist in the running app |
| `canon:review-address` | On the worker's side, to fix posted findings and push a follow-up      |
| `canon:git-followup`   | For a small self-review edit on a branch whose PR is already open      |
| `canon:git-split`      | When a branch turns out to carry unrelated commits                     |
| `canon:git-issue`      | When something surfaced that belongs on the tracker rather than here   |
| `canon:git-worktree`   | After a PR merges, to list worktrees and reclaim the slot              |

## Run several tracks at once

| Skill                     | When to use                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `canon:role-orchestrator` | To assert the control session that owns the queue and reviews each worker's PR                              |
| `canon:role-planner`      | To assert the thinking role for a cold session writing a plan, a groundwork track, or an intake pass        |
| `canon:role-reviewer`     | To assert the reviewing role for a cold session dispatched to review one pull request                       |
| `canon:role-worker`       | To assert the worker role for a cold session building one branch under one plan                             |
| `canon:session-relay`     | When this session owes another session a message, with or without a role                                    |
| `canon:session-resume`    | At the start of a session, to pick up what a previous one left                                              |
| `canon:session-compact`   | Before a compaction or a move to another machine, to write a plain session's handoff note outside the board |
| `canon:session-map`       | At the close of an orchestrating session, to write its board-side handoff                                   |

## Keep the project current with the toolkit

| Skill                         | When to use                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `canon:target-check`          | In a target project, to report per domain what it holds against what the toolkit ships |
| `canon:seed-sync`             | After a toolkit update, to reconcile installed seeds without losing customizations     |
| `canon:canon-feedback`        | When something in the toolkit is broken, missing, or off, to open an issue on it       |
| `canon:canon-feedback-triage` | In the toolkit repo, to work through the open feedback issues                          |
| `canon:canon-rollout`         | In the toolkit repo, to take one change out to every consuming project at once         |
