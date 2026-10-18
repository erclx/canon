---
name: session-compact
description: Why a plain session needs a handoff surface that is not the task board
---

# Session compact requirement

## Gap

Without this skill, a session facing a compaction reaches for `session-map`, which writes onto the task board in the orchestrator's shape. That shape runs a drift check against a start commit nothing records and fills a `## State` section, so a session that shipped nothing pays for both and leaves a file every board reader filters out.

Sessions also write the wrong thing into a handoff. They restate the tree, which survives a compaction, and omit what each decision beat, which does not. A session about to move machines finds no surface naming the push and export it needs first.

## Must

- The note lands in `.canon/compact/`, outside the task board and outside scratch, and in a stated shape
- Every claim carries a citation, and every decision carries the alternative it rejected
- A session holding nothing a compaction would destroy gets a one-line decline rather than a padded note
- A caller who asked to move the session gets `canon records push` then `canon sessions export` named in the report
- The skill keeps a caller of its own beyond an operator typing it, being the `PreCompact` hook naming it on a manual compaction

## Must not

- Write a task row, a plan, or anything under `.canon/tasks/`
- Write a `## State` section, or any section a reader could fill from `git status`
- Run a drift check or recover a start commit, which belong to the role that ships code

## Out of scope

- The orchestrator's handoff with its drift check and board row, which `session-map` owns
- Reading a handoff back, which `session-resume` owns
- A decision a groundwork track owns, which `plan-groundwork` owns in that track's decision file
