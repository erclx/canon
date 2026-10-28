---
name: proposal-critique
description: Scope boundary for questioning a proposal before it is built, the two directions it checks, and the one verdict it ends on
---

# Proposal critique requirement

## Gap

Without this skill, a session builds a proposal as stated. A fix for an upstream failure ships before anyone checks whether the cause is ours. A proposal that holds back too far, such as a gate serializing work it never needed to hold, passes too, since an improvised critique asks only whether a change does too much.

When a session does question a proposal, it asks the same long list of a one-line revertible edit and of a published release, so it either stalls small work or waves through large work. It ends on a list of concerns with no call, and it answers from its own reading of the conversation without saying the proposal was its own.

## Must

- Ask whether the proposal does too much and whether it is too cautious
- Scale the question count by reversibility and reach, two questions for a two-way local change and every group for a one-way change or a fix whose cause is unverified
- Answer each question from evidence in the tree, the history, or the record, and put a preference question through the question surface
- End on exactly one verdict of go, probe first, absorb, or stop, naming the questions that decided it
- Say where the proposal was read from, and say when this session wrote it

## Must not

- Write a section into the plan, task, or intake item it critiques, since the operator decides what moves into a record
- Run on its own initiative or from another skill by default
- Stay in the catalog if the operator and the planning skills' pointers never reach it at the costly moment, which is the review criterion for whether it earns its place
- Give a conditional verdict, which is a probe stated as a go

## Out of scope

- Batching decisions that turn on the operator's preference, which `decision-escalate` owns
- Investigating a failing test or a bug in hand, which `systematic-debugging` owns
- Judging a finished change, which `review-pr` owns
- Writing the plan a go lets through, which `plan-feature` owns
