---
title: Talk answers
description: Where a talk worker writes an operator's answer before it acts on or relays it, so the controller reads the answer once from a slot rather than asking the operator again
---

An operator's answer given in a talk session sits only in this chat until someone writes it down. A worker that relays it with `Answer at: none` sends the controller to ask the operator a second time, so write each answer to a slot first, then act, then relay.

## Pick the slot

Write the answer to the first of these that fits, in the plan or task this build runs under.

- A plan question with a blank `- Answer:` takes the answer on its `- Suggested:` line, naming the operator, with the `- Answer:` slot left blank, since a session never fills that slot
- A plan question whose `- Answer:` the operator already typed takes no write from this session. A reversal is the operator's own edit to that slot.
- A decision no question covers, with a plan, takes a new question written already settled, per `### Overrides and settled questions` in `${CLAUDE_SKILL_DIR}/../plan-change/references/plan.md`
  - Give it an `- Evidence:` line citing what this build read, or `none, settled by the operator` where the call rests on no fact
- A decision no question covers, with no plan yet, takes a dated line under the task's `## Findings`
  - Open it with the bold label `**operator, <YYYY-MM-DD>:**`, per `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`
- A build with no plan and no task has no slot to write, so write nothing and relay the answer with `Answer at: none`

## Relay it

Cite the slot in the `Answer at:` line that opens the relayed message, in the form `${CLAUDE_SKILL_DIR}/../session-relay/SKILL.md` states, so the controller reads the answer once.

- A worker writes only its own task file and the plan it runs under, so an answer that belongs in neither is relayed with `Answer at: none`, which tells the controller to confirm it with the operator
- Write the line before acting on the answer, since an action taken first leaves the record behind the work it decided
