---
title: Orchestrator planner reuse
description: How one planner takes more than one row, being the batch launch that hands it several task files and asks for one plan per task, how that differs from a bundle row, and when a live planner takes a further row
---

Run this before handing a planner more than one row, whether rows sharing a surface or a concern go to one planner at launch, on this session's judgment or the operator's ask, or a further row goes back to a live one. The rules every launch shares stay in `orchestrator-launch.md`.

# Planner reuse

## Several rows in one launch

The brief names every task file and asks for one plan file per task, so the session reads the shared code once and writes a plan for each row.

```bash
claude --bg --model <model> --effort <effort> -n "planner-<project>-<batch-slug>" "Run /canon:role-planner, then /canon:plan-feature once for each task below in the order listed, writing one plan file per task and linking it before starting the next: <task-1> <task-2>. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it as each plan lands, carrying its path and what its task file got wrong, and message it again if you stop on a question."
```

`<batch-slug>` names the shared surface, since the planning wait keys on each task and nothing matches a planner's name to a row. The other placeholders resolve as in the single-row shape of `orchestrator-launch.md`.

## What stays per row

A batch shares the planner and nothing downstream of it.

- This is not a bundle row. Each task keeps its own plan file, branch, pull request, and planning wait.
- A bundle row is one plan the operator agreed to, per `### Bundle rows` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`
- Arm one wait per task, per `orchestrator-planning-wait.md`
- A flaky row inside the batch keeps the order `### A flaky row` in `orchestrator-launch.md` states, so the brief puts `/canon:plan-groundwork <task>` ahead of that task's plan

## Bounds

Set no cap on how many rows a batch holds. The bound is finishing before a compaction, where `role-planner` stops and names the rows left unplanned. The talk launch takes no batch variant, since a talk planner already takes a further row when one is named back to it.

## Reusing a planner

A reused session pays the context load once and ages its picture of the tree, which is why the in-flight read sits on each row. One that compacts loses the reasoning behind its earlier plans unreported, so `role-planner` stops it when the operator ends it or a compaction nears.

- Reuse rows known at launch through the batch shape above
- Name a further row back to a live planner once it is running

The session that closed a groundwork track or an app drive is the default planner of the rows its record produced, talk session or not. Name each filed row back to it, since it holds the evidence and what the operator said about the row.

- Launch a cold planner for such a row only on a close message handing off with a reason `role-planner` states, or on the operator's ask
- Hold all planning of a row any other talk session has said by message it is planning, whether by a launch or by `plan-feature` here, unless the operator asks for a cold planner
