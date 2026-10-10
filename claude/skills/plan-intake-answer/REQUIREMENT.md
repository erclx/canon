---
name: plan-intake-answer
description: Scope boundary for answering a filed intake from chat, and the write-back contract that keeps the file rather than the conversation as the record
---

# Plan intake answer requirement

## Gap

Without this skill, an operator answers a filed intake by opening each cluster file and typing under each item, so a dump spanning six clusters is six files navigated in turn and the cost scales with how well the pass split the domains. The folders that go unanswered are the large ones, which are the ones a breadth pass exists to produce.

A session asked to help with that fails in shapes the intake standard already names. It reads an empty slot as agreement and reports items decided that nobody reached. It writes an answer into the conversation and never into the file, so the record still reads as unread and the next session re-asks. It types the answer into `00-overview.md`, where retrieval walks item headings and finds nothing. It overwrites a slot the operator already filled, discarding a decision already made.

The write itself fails a fourth way that no prose rule prevents. Every worker runs in a linked worktree where the file-editing tools refuse a main-root path, and a stream editor expands an unescaped ampersand in the replacement to the whole match and exits zero when it matches nothing. A body instructing either route reports success and loses the answer.

The batching fails a fifth way. A folder holding thirty unread items put as thirty questions is unanswerable, and put as one flat batch it hides which cluster the operator is in and leaves a file half answered when attention runs out.

## Must

- Offer every item carrying an empty answer slot, not only the ones carrying an open question, since the standard's one-token accept exists for a verdict with no question attached
- Batch by cluster in the folder's own numbering, so the operator has a stopping point that leaves whole clusters unread rather than a file half answered
- Cap a batch at four items, which is what a structured question tool takes
- Rank the item's own suggestion or verdict first and give every option what it costs, since the pass already made a recommendation and burying it asks the operator to re-derive it
- Land every selection through a verb that resolves the root in-process and rewrites the whole line, which is the only route that works from a linked worktree
- Write one cluster per call, since concurrent calls against one file race on the read and keep only the last answer
- Carry the cluster and the label together, because items are labeled per file and a label alone names an item in every cluster at once
- Pass a label exactly as its heading spells it, letter suffix included, since a pass that splits a finding after the fact labels the halves rather than renumbering the file
- Report what stays unread by count after each cluster

## Must not

- Fill a slot the operator did not answer, including the remainder of a batch they abandoned
- Infer an answer from the conversation having happened, which is the inversion the intake standard states against the plan standard
- Overwrite a slot already carrying an answer, which is a decision already made
- Write anywhere in the folder but an item's answer slot, and never into the index, which carries none

## Guards

- No intake folder at all, stop and name the skill that files one
- The named folder carrying no unread item, stop rather than re-asking answered items

## Out of scope

- Filing a dump and writing the items, which is `plan-intake` and owns every other write into the folder
- Promoting an answered item onto the board, which is `task-board` and runs after the answers land
- The item format, the answer contract, and retrieval, which the `plan-intake` skill's `references/intake.md` owns and this skill cites
- The comparable answer slots in groundwork and feature plans, which carry their own contracts and are a separate measurement
- Deciding when to fire. The skill is user-invoked through `disable-model-invocation`, so answering is the operator's call rather than a description match.
