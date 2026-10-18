---
name: decision-escalate
description: Scope boundary for handing a decision back to the operator, and the batching contract that keeps the handoff to one turn
---

# Decision escalate requirement

## Gap

A session facing a decision that belongs to the operator asks one question per turn, so the operator cannot see how many are open or trade one against another. It asks in prose with no options, omits what the other option buys, or escalates a call the repository could settle.

It carries on with work the open questions govern, or acts on an answer and leaves the record that posed it reading open, so the next session re-asks. Where the named tool is absent it falls back to the per-decision ask. Taking a preference decision itself ships silently.

## Must

- Collect every open decision before asking, and put the whole batch in one turn
- Give each question a short axis header and two to four options shaped as `CLAUDE.md` states, capped at four questions with the held count said
- Test the surface rather than the project's instruction file when choosing where the batch goes
- Hold every escalated decision until answered, and continue only work depending on none of them
- Route a pick that changes a written artifact into that artifact under the standard owning it

## Must not

- Answer on the operator's behalf, or treat the recommendation as the answer because no reply arrived
- Escalate a decision settled by the repository or by the session's own judgment, or one already recorded
- Manufacture a question when nothing is open

## Out of scope

- The ordinary judgment call, which `CLAUDE.md` owns as a pick plus a one-sentence tradeoff
- Writing the decision into a plan, task, or context entry, which each owning standard governs
- Deciding when to fire, which the operator owns since the skill never auto-triggers
