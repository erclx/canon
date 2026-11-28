---
name: role-judge
description: What a judge session beside a design session reads first, what it returns per round, and the one file it writes
---

# Role judge requirement

## Gap

Without this skill, every design pick waits on the operator, one round at a time. A judge reading the options alone agreed with the operator on 13 of 21 recorded picks. Given the design record and the earlier picks first, it agreed on 18, and on 13 of the 14 it called clear. Groundwork 276 holds that replay.

A judge with no stated bounds also writes the decision line or redraws the frame itself, landing a pick the operator never saw.

## Must

- The design record and the earlier picks are read before the first round's options, and each later decision is read before the next round
- Each round returns a pick, a one-line reason naming the rule or precedent that decided it, and `clear` or `close call`
- A round with no deciding rule, a cut or below-the-fold difference, or two arms passing alike is a close call
- A round where no arm passes returns a correction naming the arm and the change, so it is redrawn before anything reaches the operator
- The verdict table under the design session's `evidence/` is the only file written

## Must not

- Write a decision line, a board frame, an intake item, a plan, a board file, or a tracked file
- Ask the operator, or report progress through the channel
- Build a taste profile from recorded decisions, which rarely carry a reason
- Exist for the author to type its name, since a stretch where only a typed invocation reaches it signals the controller's launch never took

## Out of scope

- Drawing a round and asking the operator, which `design-pick` and `app-drive` own
- How a round reaches the judge and the batch review, which `drawing.md` in `design-pick` owns
- Launching the judge, which `role-orchestrator` owns
- Landing a pick, which a worker does through `design-record`
