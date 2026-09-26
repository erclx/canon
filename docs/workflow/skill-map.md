---
title: Skill map
description: When to reach for each plugin skill, grouped by the moment a project meets it
category: Workflow
---

# Skill map

Groups run in the order a project meets them, so a reader at a known point scans to that group and reads across. The set reconciles the scenarios in [AI workflow](ai-workflow.md) with the lifecycle [target projects](../target/target-projects.md) describes, rather than inventing a third vocabulary beside those two, so a group name matches neither source exactly and every moment either one names has a group. Each row says when to reach for the skill. What it does is the skill's own description.

This page is the corpus the coverage claim is measured against: every name `canon claude skills list --names` reports takes exactly one row here. A skill serving two moments sits at the earlier one, and a mention on any other page is prose rather than routing.

## Set up a project

| Skill                  | When to use                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `canon:target-setup`   | On a fresh scaffold, to detect the stack and run the install chain, or to reach one phase of it alone  |
| `canon:canon-operator` | On a project that already exists, to read what it carries before an install is picked                  |
| `canon:sketch-design`  | Before `design-extract`'s greenfield path, to trace a design direction from reference images or URLs   |
| `canon:design-extract` | Before the first UI feature, to draft `canon/DESIGN.md`                                                |
| `canon:draft-diagram`  | Once the architecture is written, to draft per-kind entries under `.canon/diagrams/`                   |
| `canon:repo-metadata`  | When the GitHub About text, homepage, or topics may have drifted, to reconcile them against the README |

## Decide what to build

| Skill                      | When to use                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| `canon:plan-intake`        | When the input is a pile of findings rather than one feature                      |
| `canon:plan-intake-answer` | When an intake folder holds unread slots waiting on your decision                 |
| `canon:backlog-triage`     | When the backlog needs pruning, to file a verdict per row and apply approved ones |
| `canon:plan-groundwork`    | When the state is unmeasured and more than one approach is live                   |
| `canon:decision-escalate`  | When open decisions turn on your preference and want batching into one set        |
| `canon:draft-and-pick`     | When the call is taste and wants several candidates rendered side by side         |
| `canon:task-board`         | When a decided item needs a file on the board, or a shipped one needs archiving   |
| `canon:plan-feature`       | When the approach is settled and the next step is a plan                          |
| `canon:codebase-layout`    | When a plan or change adds a file and you need to decide which folder holds it    |

## Build the feature

| Skill                        | When to use                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `canon:session-worktree`     | At the plan-to-execute boundary, to get an isolated tree and branch, or to route a refused main-root write |
| `canon:auto-ship`            | After plan approval, to chain implement, verify, review, draft PR                                          |
| `canon:project-commands`     | When the project's own command needs running                                                               |
| `canon:test-first`           | Before implementing a planned change, to run its test red, green, then refactor                            |
| `canon:test-craft`           | When writing or changing any test, to pick its layer and filter what it asserts                            |
| `canon:review-craft`         | When reviewing a change, for what to look for and how much evidence a finding needs                        |
| `canon:systematic-debugging` | When a test fails or a bug surfaces, to force root cause first                                             |
| `canon:ui-checklist`         | After a UI change, to write what to look at and name what ships untested                                   |

## Check the work before it leaves the branch

| Skill                    | When to use                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `canon:review-branch`    | On the local branch diff, before anything is pushed                                     |
| `canon:standards-audit`  | When changed markdown has to answer to the authoring standards                          |
| `canon:document-health`  | When the documents themselves have to answer for length, placement, and staleness       |
| `canon:markdown-propose` | When a markdown claim needs rewriting and the change should wait for an answer per file |
| `canon:ux-audit`         | To read UI source for missing states, edge cases, and inconsistencies                   |
| `canon:ux-measure`       | To start the interface and measure paint, processor, and layout cost                    |
| `canon:ux-walkthrough`   | To run a multi-finding inspection pass over a running app with the operator             |

## Ship it

| Skill                  | When to use                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `canon:git-ship`       | To run the whole post-feature chain from the verify gate through open PR                          |
| `canon:memory-capture` | First skill in that chain, to route what the session learned to the surface owning it             |
| `canon:context-fold`   | When decisions diverged from the plan, or a shipped task needs its outcomes marked                |
| `canon:docs-fold`      | Never on purpose. A pointer at the old name that names `context-fold` <!-- canon-keep-retired --> |
| `canon:docs-sync`      | When a change since main left `README.md` or `docs/` stale                                        |
| `canon:git-stage`      | When the staged set spans several concerns and wants one commit each                              |
| `canon:git-commit`     | When the staged set is one concern, or was staged hunk by hand                                    |
| `canon:git-branch`     | When a branch name needs generating or renaming to conventional form                              |
| `canon:git-pr`         | When a pull request needs a title and body written from the diff                                  |
| `canon:memory-review`  | When the pen has grown, to propose where each entry belongs                                       |

## After the pull request opens

| Skill                  | When to use                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `canon:review-pr`      | From an independent session, to post findings on the PR itself       |
| `canon:review-address` | On the worker's side, to fix posted findings and push a follow-up    |
| `canon:git-followup`   | For a small self-review edit on a branch whose PR is already open    |
| `canon:git-split`      | When a branch turns out to carry unrelated commits                   |
| `canon:git-issue`      | When something surfaced that belongs on the tracker rather than here |
| `canon:git-worktree`   | After a PR merges, to list worktrees and reclaim the slot            |

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

## Generate an artifact on demand

| Skill                     | When to use                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `canon:create-rule`       | For a project-specific governance rule the toolkit does not ship                                                  |
| `canon:create-skill`      | For a new `SKILL.md`                                                                                              |
| `canon:create-standard`   | For a new authoring convention                                                                                    |
| `canon:draft-docs`        | For a brand-new `docs/*.md` page, drafted against `standards/docs.md`                                             |
| `canon:draft-ready`       | For finished files a worker should copy, written as a ready folder with its overview, thin plan, and task         |
| `canon:draft-context`     | For a brand-new `canon/context/<domain>.md` entry, drafted against `standards/context.md`                         |
| `canon:draft-wireframes`  | For a brand-new `canon/wireframes/<surface>.md` file, drafted against `standards/wireframes.md`                   |
| `canon:draft-wiki`        | For a brand-new wiki reference page on a subject owned outside the project, drafted against `standards/wiki.md`   |
| `canon:draft-figure`      | For a hand-drawn figure inside an existing doc, drafted against `standards/figures.md` in Mermaid or freehand SVG |
| `canon:draft-readme`      | For a project's `README.md`, drafted against `standards/readme.md`                                                |
| `canon:bash-script`       | For an interactive, human-facing shell tool                                                                       |
| `canon:bash-cli-script`   | For a non-interactive automation, CI, or pipeline script                                                          |
| `canon:ci-workflow`       | For a GitHub Actions workflow file                                                                                |
| `canon:draft-slides`      | For a deck, drafted as `.claude/SLIDES.md` and rendered to PowerPoint                                             |
| `canon:draft-screencast`  | For a recording script with beats and defaults already seeded                                                     |
| `canon:record-screencast` | For compiling and running a screencast draft into a recording and a still                                         |
| `canon:draft-identity`    | For a project's logo mark and its social card, drafted through `draft-and-pick`'s pick loop                       |

## Answer a question at any point

| Skill                       | When to use                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canon:canon-cli`           | Before running an unfamiliar verb, a sync, or an install, to learn which command to run, which reference doc covers it, or what it overwrites, merges, or leaves alone |
| `canon:index-lookup`        | To find where a topic is documented across the tracked `index.md` catalogs                                                                                             |
| `canon:youtube-transcripts` | When a video transcript is wanted in the repo as context                                                                                                               |
| `canon:read-frames`         | To read a recorded demo back frame by frame and report what each one shows, with no verdict on whether the recording looks right                                       |
| `canon:teach-workspace`     | To learn a subject across sessions, in a workspace that holds the progress                                                                                             |
| `canon:write-human`         | Before drafting or revising prose, for voice, rhythm, and density                                                                                                      |
| `canon:restate-plainly`     | When an answer or a document has to be read again in plain words                                                                                                       |

Every row answers a question rather than marking a point in a project's life, so a phase above would send a reader to the wrong group.

A learning workspace produces two halves and only one of them leaves. A lesson is worked through once and stays in the workspace, and a reference page or a glossary carries no learner, so it belongs wherever the project already keeps prose on that subject. Asking `canon:teach-workspace` to promote sorts each durable page by who owns its subject, sending an Anthropic-owned subject to the wiki, an internal one to the matching context entry, and everything else, subject-neutral material included, to the public docs. It proposes and waits, because a promoted page is public prose that needs a line naming who owns the subject, and it writes nothing to a destination: each page the operator confirms goes to a handoff file that `canon:context-fold` folds in from a branch. A project with no wiki folder gets a refusal naming `canon wiki init` rather than a folder it never asked for.
