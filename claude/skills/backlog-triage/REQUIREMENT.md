---
name: backlog-triage
description: Why the backlog gets a measured verdict per row with a lean toward decline, and why filing and applying are split by the operator's answer
---

# Backlog triage requirement

## Gap

Without this skill, the backlog only grows. `task-board` declines one named task and `task-complete` archives one, but nothing reads the backlog as a whole, and the orchestrator's re-test only clears a row upward. A long backlog has no surface that can say which rows still matter.

Judged by its own task file, every row reads live and stays. Applied without the operator, verdicts decline rows on silence, on a board with no history to restore them. Measuring only that a defect still exists keeps nearly everything, since a row filed against the tree almost always reproduces.

## Must

- Every row is measured against the tree and the log, carrying a count, a path, or a commit rather than the task file's claim
- Keep or promote is suggested only for a row naming a cost someone hit or a reach into what the project ships, and decline for a row whose defect merely still exists
- Verdicts are filed into an ordinary intake folder, in the suggestion line and item heading, so the intake verbs read them unchanged
- Applying writes only what the operator approved, through the existing decline, outcome, and archive verbs, and archive names the commit or pull request per outcome position
- Every task a verdict touched carries the folder slug, so a re-run writes nothing twice

## Must not

- Fill an answer slot, or read a verdict from an empty answer, a free-text answer, or a suggestion with no verdict token
- Treat age as evidence for or against a row
- Retry an archive with guessed outcome positions after a refusal
- Apply under a planner or worker session, or write the ordering file beside a live orchestrator rather than handing it the promote
- Change the intake standard, the intake skills, or the task verbs to fit triage

## Out of scope

- Filing a brain dump, which `plan-intake` owns
- Answering the filed items, which `plan-intake-answer` owns
- Creating or declining one named task outside a triage, which `task-board` owns
- Archiving one named task outside a triage, which `task-complete` owns
- Ordering the rows a promote lands under `## Needs a plan`, which `role-orchestrator` owns
