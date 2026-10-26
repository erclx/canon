---
title: Skill map
description: When to reach for each plugin skill, grouped by the moment a project meets it
category: Workflow
---

# Skill map

Groups run in the order a project meets them. Every name `canon claude skills list --names` reports takes one row across this page and [skill map on request](skill-map-on-request.md), under the group its `metadata.family` names.

## Set up a project

| Skill                | When to use                                   |
| -------------------- | --------------------------------------------- |
| `canon:target-setup` | On a fresh scaffold, to run the install chain |
| `canon:deploy-app`   | When a project is ready to publish            |

## Decide what to build

| Skill                      | When to use                                        |
| -------------------------- | -------------------------------------------------- |
| `canon:plan-intake`        | The input is a pile of findings                    |
| `canon:plan-intake-answer` | An intake folder holds unread slots                |
| `canon:backlog-triage`     | The backlog needs pruning                          |
| `canon:plan-groundwork`    | The state is unmeasured and approaches compete     |
| `canon:decision-escalate`  | Open decisions turn on your preference             |
| `canon:pick-by-eye`        | The call is taste, wanting candidates side by side |
| `canon:task-board`         | A decided item needs a file on the board           |
| `canon:plan-feature`       | The approach is settled and needs a plan           |
| `canon:codebase-layout`    | A change adds a file and needs a folder            |

## Build the feature

| Skill                         | When to use                                        |
| ----------------------------- | -------------------------------------------------- |
| `canon:session-worktree`      | Before building a plan in this session             |
| `canon:auto-ship`             | After plan approval, to chain implement through PR |
| `canon:test-first`            | Before implementing a planned change               |
| `canon:test-craft`            | Writing or changing a test                         |
| `canon:build-in-slices`       | While building, to commit each slice               |
| `canon:api-design`            | Changing what a caller sees                        |
| `canon:deprecation-migration` | Deleting or replacing code something may call      |
| `canon:code-craft`            | Before writing a function, class, or module        |
| `canon:review-craft`          | Reviewing a change                                 |
| `canon:search-craft`          | Before searching outside the project               |
| `canon:systematic-debugging`  | A test fails or a bug surfaces                     |
| `canon:design-taste`          | Drafting or judging an interface                   |
| `canon:ui-craft`              | Building or judging a component's behavior         |
| `canon:ui-checklist`          | After a UI change, to list what to check           |

## Check the work before it leaves the branch

| Skill                   | When to use                                    |
| ----------------------- | ---------------------------------------------- |
| `canon:document-health` | Documents must answer for length and staleness |
| `canon:ux-audit`        | To read UI source for missing states           |
| `canon:ux-measure`      | To measure paint, processor, and layout cost   |
| `canon:app-drive`       | To drive a built app with the operator         |

## Ship it

| Skill                 | When to use                                   |
| --------------------- | --------------------------------------------- |
| `canon:git-ship`      | To run the post-feature chain through open PR |
| `canon:context-fold`  | The diff left a context entry untrue          |
| `canon:design-record` | A picked design needs landing in the record   |
| `canon:task-complete` | After the fold, to mark shipped outcomes      |
| `canon:docs-sync`     | A change left `README.md` or `docs/` stale    |
| `canon:git-stage`     | Staged changes span several concerns          |
| `canon:git-commit`    | Staged changes are one concern                |
| `canon:git-branch`    | A branch needs creating, naming, or renaming  |
| `canon:git-pr`        | A pull request needs a title and body         |

## After the pull request opens

| Skill                  | When to use                                   |
| ---------------------- | --------------------------------------------- |
| `canon:review-pr`      | From an independent session, to post findings |
| `canon:review-ui`      | Beside code review, to drive the checklist    |
| `canon:review-address` | As the worker, to fix posted findings         |
| `canon:git-followup`   | A small edit on a branch with an open PR      |
| `canon:pr-evidence`    | A new head needs its screenshots re-posted    |
| `canon:git-split`      | A branch carries unrelated commits            |
| `canon:git-pr-close`   | A pull request closes without merging         |
| `canon:git-issue`      | Something belongs on the tracker              |
| `canon:git-worktree`   | After a merge, to reclaim worktrees           |

## Run several tracks at once

| Skill                     | When to use                                         |
| ------------------------- | --------------------------------------------------- |
| `canon:role-orchestrator` | To assert the control session that dispatches       |
| `canon:role-planner`      | To assert the role of a session writing a plan      |
| `canon:role-reviewer`     | To assert the role of a session reviewing one PR    |
| `canon:role-worker`       | To assert the role of a session building one branch |
| `canon:session-relay`     | This session owes another a message                 |
| `canon:session-resume`    | At session start, to pick up a previous one         |
| `canon:session-compact`   | Before a compaction, to write a handoff             |
| `canon:session-map`       | When an orchestrating session closes                |

## Keep the project current with the toolkit

| Skill                         | When to use                                             |
| ----------------------------- | ------------------------------------------------------- |
| `canon:target-check`          | In a target, to compare each domain with the toolkit    |
| `canon:target-update`         | After a release, to catch a target up to the toolkit    |
| `canon:document-repair`       | Rewrite a failing docs folder to the limits and gate it |
| `canon:canon-feedback`        | The toolkit is broken, missing, or off                  |
| `canon:canon-feedback-triage` | In the toolkit repo, to file feedback issues            |
