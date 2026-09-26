---
name: backlog-triage
description: Why the backlog gets a measured verdict per row with a lean toward decline, and why filing and applying are split by the operator's answer
---

# Backlog triage requirement

## Gap

Without this skill, the backlog only grows. `task-board` declines or archives one named task, and nothing reads the backlog as a whole, so a row stays until somebody happens to remember it and decides by hand. The orchestrator's backlog re-test only clears a row upward onto the board, so no sweep ever takes one off. A backlog past fifty rows had no surface that could say which of them still mattered.

Three failure modes cost more than the rest. A pass that judges a row by what its task file says rather than by the tree keeps every row, since a task file reads as live the day it was written and every day after. A pass that applies its own verdicts decides rows on silence, which ships a decline nobody approved on a board with no history to restore it from. And a keep that carries no measurement is the default nobody argues with, so a triage without a lean toward decline ends with the same backlog it started with.

## Must

- Measure every row against the tree and the log during the pass, carrying a count, a path, or a commit rather than the task file's own claim
- Suggest decline for any row this pass cannot argue for, putting the burden of proof on keep and promote
- Name the commit or pull request per outcome position before suggesting archive
- File into an ordinary intake folder, so the intake list and answer verbs read and write it unchanged
- Carry the verdict in the suggestion line and the task stem in the item heading, rather than in new fields
- Split filing from applying by the operator's answer, so filing writes only inside the intake folder and applying writes only what was approved
- Apply through the existing decline, outcome, and archive verbs
- Leave the folder slug on every task a verdict touched, so a re-run writes nothing twice
- Refuse to apply under a planner or worker session, and hand a promote to a live orchestrator rather than writing the ordering file beside it

## Must not

- Fill an operator's answer slot, or infer a verdict from an empty one or from a free-text answer
- Read a suggestion carrying no verdict token as keep
- Treat age as evidence for or against a row
- Retry an archive with guessed outcome positions after a refusal
- Change the intake standard, the intake skills, or the task verbs to fit triage

## Guards

- No backlog file: stop
- Unread items in the newest triage folder: stop and name the answer skill
- An item carrying no answer slot: stop and name the folder to repair
- Apply under a session named for the planner or worker role: stop before writing

## Out of scope

- Filing a brain dump, which `plan-intake` owns
- Answering the filed items, which `plan-intake-answer` owns
- Creating a task, or archiving and declining one named task outside a triage, which `task-board` owns
- Ordering the rows a promote lands under `## Needs a plan`, which the orchestrator's refill sweep owns
- Skipping rows kept at a recent triage, which waits on a second triage measuring the re-read cost
