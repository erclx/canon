---
name: operator-walk
description: Why steps the operator runs by hand are written to one file before the first is said, and why a check rather than the operator's memory marks each one done
---

# Operator walk requirement

## Gap

Without this skill, a session walking the operator through hand steps says them one message at a time, and the list lives only in the chat. Two steps run in the wrong order, and a setting lost to an outage goes unnoticed because the operator said it was done. Nobody can tell which steps are left, and a later session has nothing to resume from.

Each turn also mixes a hold with the next step and asks two things at once, so a hold placed at the end is read after the action it held, and a bare yes answers neither question. A secret left in a terminal reaches a screenshot.

## Must

- Every hand step is in one file at the main worktree root before the first is said, and the file changes before the chat says a reordered or added step
- Each step carries the exact action ready to copy, what the operator should see, what to do when it differs, and how it is checked
- Each step reads `done`, `skipped`, or `blocked` from its read-only check where one exists, and says when the operator's word marked it instead
- A turn carries one step and one open question, opening on any hold
- No secret value reaches the file, and a step asking for a screenshot clears the screen first

## Must not

- Run a check that changes state, since the operator is the one acting
- Trigger on anything but steps left to the operator, since `role-worker`'s talk clause, a planner, or an app drive loads it by its description rather than its author by name

## Out of scope

- Setting up a deploy and its host project, which `deploy-app` owns
- Teaching a subject so it sticks, which `teach-craft` owns
- Writing an operator's answer to a plan question, which `role-worker` owns
