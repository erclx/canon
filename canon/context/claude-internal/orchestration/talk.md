---
title: Talk launch
description: The launch shape for a planner or worker the operator talks with, why retirement is exempt until the operator ends the conversation, and why the controller does not relay
---

# Talk launch

A planner or worker the operator talks with is launched from the cold shape in `dispatch.md`, with a `-talk` suffix on its name and one brief sentence saying so. On 2026-10-11 a controller retired the `canon-cli` planner the moment its plan landed while the operator still wanted to talk to it.

## Decisions

### The decision

The operator talks to the session directly, and retirement is exempt until the operator ends the conversation. The rejected alternative was the controller relaying the dialogue.

- Every operator turn would become an inbound message into the controller's whole context, which `references/orchestrator-inbound.md` under `role-orchestrator` prices
- The relay adds a hop that rewords what the operator said

### Where the rule lives

Retirement happens in one runbook, `orchestrator-handoff.md`, and no runbook retires a session on its delivery. The exemption sits there and the launch section points at it.

The `-talk` suffix is display only, since the client can rename a session after launch. The map records the `sessionId` under `## Talk sessions held open`, and every later read finds the session by it.

### What a talk session owes

A talk session owes one message a cold session does not, a close when the operator ends the conversation. It carries the operator's word onto the controller's channel without making them repeat it in the controller's own session, which stays a valid route for a talk session that crashed or was abandoned.

Reviewers get no talk shape, since a reviewer holds no operator dialogue.

## Gotchas

A talk planner launched while the operator has walked away waits silently on its first question. The before-prompt block message is skipped for a question put to the operator in the session, so the controller sees the stall only from the session's own statement of what it waits on.
