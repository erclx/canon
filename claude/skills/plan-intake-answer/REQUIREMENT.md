---
name: plan-intake-answer
description: Scope boundary for answering a filed intake from chat, and the write-back contract that keeps the file rather than the conversation as the record
---

# Plan intake answer requirement

## Gap

An operator answers a filed intake by opening each cluster file and typing under each item, so the largest folders go unanswered. A session asked to help reads an empty slot as agreement, answers in chat and never the file, or overwrites a slot already filled.

The write fails where no prose rule catches it. A worker's file-editing tools refuse a main-root path from a linked worktree, and a stream editor exits zero on no match, so the answer is lost behind a success report. Thirty items in one flat batch leave a file half answered.

## Must

- Offer every item with an empty slot, batched by cluster in the folder's numbering and capped at four items, so a stop leaves whole clusters unread
- Open each question with a lead-in an operator who has not opened the file can follow, then rank the item's own suggestion first and give every option its cost
- Land each selection through a verb that resolves the root in-process and rewrites the whole line, one cluster per call
- Pass the cluster and the label exactly as the heading spells them, letter suffix included
- Report what stays unread by count after each cluster, and stop when there is no folder or no unread item

## Must not

- Fill a slot the operator did not answer, or infer an answer from the conversation having happened
- Overwrite a slot already carrying an answer
- Write anywhere but an item's answer slot, the index included

## Out of scope

- Filing a dump and writing the items, which `plan-intake` owns
- Promoting an answered item onto the board, which `task-board` owns
- The item format, the answer contract, and retrieval, which `plan-intake` owns in its `references/intake.md`
- Deciding when to fire, which the operator owns since the skill never auto-triggers
