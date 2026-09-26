---
name: decision-escalate
description: Scope boundary for handing a decision back to the operator, and the batching contract that keeps the handoff to one turn
---

# Decision escalate requirement

## Gap

Without this skill, a session facing a decision that belongs to the operator asks about it one question at a time across several turns, so the operator answers each without knowing how many are open and cannot trade one against another. It asks in prose with no options attached, so the operator has to invent the alternatives before picking one. It names an option and omits what the other one buys, so the pick is made blind. It escalates a call it could have settled from the repository or from its own judgment, which spends the operator's attention on work the session owed.

It also empties a long backlog into one turn, so the questions past the first few arrive in no order and the operator cannot tell which ones the work is actually stalled on. It carries on with work the unanswered questions govern, so an answer arrives against output already built the other way. It takes the answer, acts, and leaves the plan, task, or record that posed the question reading as open, so the next session re-asks a decision the operator already made.

A body written around a named tool fails a third way. A session on a surface carrying no structured question tool reads an instruction it cannot execute and falls back to whatever it would have done unaided, which is the per-decision ask this file exists against.

The opposite failure is the one that ships silently. A session that takes a preference decision itself produces work the operator did not ask for and never learns a choice was made, because nothing in the output says a fork was passed.

`CLAUDE.md` states both branches of the rule, sending an ordinary judgment call to a pick with the tradeoff in one sentence and a preference-deciding call to the operator. The second branch now states how a question is shaped and where it is put, so this skill inherits both and adds only what a batch needs on top of one question.

## Must

- Collect every open decision before asking any of them, so the operator sees the set rather than the first one
- Put the whole batch in one turn, since a batch split across turns is the per-decision ask this skill exists to replace
- Give each question a short axis header and two to four options, taking the shape of an option from `CLAUDE.md` rather than restating it
- Test the surface rather than the project's instruction file when choosing where the batch goes, so a target whose `CLAUDE.md` predates the rule still reaches the tool and loses only the shape
- Cap a batch at four questions and say how many are held, since a structured question tool takes four and an uncapped batch hides the overflow
- Hold every escalated decision until it is answered, and continue only the work depending on none of them
- Route a pick that changes a written artifact into that artifact under the standard owning it, rather than leaving it in the session

## Must not

- Answer on the operator's behalf, or treat the recommendation as the answer because no reply arrived
- Escalate a decision the session can settle from its own judgment or from reading the repository, which is the first branch of the rule and belongs to the session
- Escalate a decision already taken, which goes to the record that holds it rather than back to the operator

## Guards

- Nothing open, stop rather than manufacturing a question to justify the invocation

## Out of scope

- Making the ordinary judgment call, which is a pick plus a one-sentence tradeoff and needs no surface
- Writing the decision into a plan, task, or architecture record, which each owning standard governs and this skill only routes to
- Deciding when to fire. The skill is user-invoked through `disable-model-invocation`, so escalating is the operator's call rather than a description match.
