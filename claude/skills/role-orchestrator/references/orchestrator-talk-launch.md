---
title: Orchestrator talk launch
description: The talk variant of the planning and build launches, being the name suffix, the one added brief sentence, and where the talk session's id is recorded for the handoff
---

Run this when the operator wants to talk with a planner or worker rather than leave it to report back. The rules every launch shares stay in `orchestrator-launch.md`.

# Talk launch

## The launch

A planner or worker the operator will talk with takes the same launch as its cold shape in `orchestrator-launch.md`, with a `-talk` suffix on its name and one sentence added to its brief. A cold session works alone and reports back, and a talk session stays open after its plan or pull request lands so the operator can keep shaping the row.

```bash
claude --bg --model <model> -n "planner-<project>-<slug>-talk" "Run /canon:role-planner, then /canon:plan-feature <task>. This is a talk session: the operator will talk with you here, so run your role's talk clause, and message your controller when the operator ends the conversation. Your controller is the session whose sessionId is <dispatcher-id>. ..."
claude --bg --model <model> -n "worker-<project>-<slug>-talk" "/canon:auto-ship <plan>
This is a talk session: the operator will talk with you here, so run your role's talk clause, and message your controller when the operator ends the conversation. Your controller is the session whose sessionId is <dispatcher-id>. ..."
```

The ellipsis stands for the rest of the cold template's message clauses, unchanged. The build variant keeps `/canon:auto-ship <plan>` at position zero with nothing before it, per `### Position zero` in `orchestrator-launch.md`.

- Keep the role prefix and add the suffix, since `orchestrator-handoff.md` separates dispatched sessions by `worker-` and `planner-` and a new prefix reads as a hand launch
- A talk session is retired only on the operator's word, stated once in `orchestrator-handoff.md`, so do not restate it in a launch report
- Reviewers get no talk shape, since a reviewer's pass holds no operator dialogue

## Recording the talk session

Read the session's `sessionId` off the launch output, carry it in this session's own context, and write it into the map's `## Talk sessions held open` at the next handoff. The client can rename a session and drop the suffix, so the id is the durable marker and the suffix is only for display.

The map exists only once the handoff writes it, so this session's own launches, read with the prior map, are what the first wind-down reads talk sessions from.
