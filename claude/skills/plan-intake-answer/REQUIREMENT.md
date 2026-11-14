---
name: plan-intake-answer
description: Scope boundary for answering a filed intake from chat, and the write-back contract that keeps the file rather than the conversation as the record
---

# Plan intake answer requirement

## Gap

An operator answers a filed intake by opening each cluster file and typing under each item, so the largest folders go unanswered. A session asked to help reads an empty slot as agreement, answers in chat and never the file, or overwrites a slot already filled.

The write fails where no prose rule catches it. A worker's file-editing tools refuse a main-root path from a linked worktree, and a stream editor exits zero on no match, so the answer is lost behind a success report. Thirty items in one flat batch leave a file half answered.

### Read in chat

An item is written for the file, dense in paths and counts. An operator who reads the chat more than the files asks by hand for each item in plain words, as its problem, its fix, and why a declined one was declined.

## Must

- Offer every item with an empty slot, batched by cluster in the folder's numbering and capped at four items, so a stop leaves whole clusters unread
- Open each question with a lead-in an operator who has not opened the file can follow, then rank the item's own suggestion first and give every option its cost
- Land each selection through a verb that resolves the root in-process and rewrites the whole line, one cluster per call, with the label as the heading spells it
- Report what stays unread by count after each cluster, and stop when there is no folder or no unread item
- Offer to close the issue an item headed `(#NNN)` names once its answer begins `decline`, with the drafted comment shown first, so closing takes one word

### On a decided cluster

A drive that ends with every finding decided has already asked each question once.

- Ask a cluster whose every unread item points at a decision in the folder's drive log as one question, uncapped, landing each accept with its source named in the slot

### On a retell

A retell restates the folder and decides nothing.

- Retell a folder on the operator's ask, each item as its problem, its fix, and on a declined one why, in plain words, even when every slot carries an answer

## Must not

- Fill a slot the operator did not answer, or infer an answer from the conversation having happened, a retell included
- Accept a decided cluster without the operator's answer, or read a decision from anywhere but the CLI's resolution of the folder's own drive log
- Overwrite a slot already carrying an answer
- Write anywhere but an item's answer slot, the index included, bar one exception, which is closing a declined item's issue on GitHub after a yes given for that issue in the turn its draft was shown
- Close an issue when the operator says no to the offer, gives no answer, or when the only yes came from another issue

## Out of scope

- Filing a dump and writing the items, which `plan-intake` owns
- Promoting an answered item onto the board, which `task-board` owns
- The item format, the answer contract, and retrieval, which `plan-intake` owns in its `references/intake.md`
- Deciding when to fire, which the operator owns since the skill never auto-triggers
