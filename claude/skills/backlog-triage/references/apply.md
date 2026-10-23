---
title: Backlog triage apply reference
description: How the apply phase of a backlog triage reads the operator's answers, runs each verdict through the task verbs, writes the findings line, and routes a refusal
---

# Backlog triage apply reference

Applies to Steps 7 through 9 of `backlog-triage`, the phase that writes the board and task files once every item in a `<nn>-backlog-triage` intake folder carries an answer. The role guard and the main-root write route stay in the skill body.

## Step 7: read the answers

Run `canon intake list <slug> --json` and read each item's `answer` and `suggested`. Never guess a verdict from prose.

| Answer                                      | Reading                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `ok`                                        | Takes the suggested verdict                                          |
| `ok` on a `suggested` opening with no token | Malformed, so report the item and skip it, never treating it as keep |
| Opens with a verdict token                  | Overrides the suggestion                                             |
| An archive override naming no positions     | Reported and skipped                                                 |
| Any other answer, such as a free-text note  | Reported and skipped                                                 |

An item already applied, by the test in the skill's Step 1, is skipped silently, which is what makes a re-run write nothing twice.

## Step 8: run each verdict

Take the task stem from the item heading. Every verdict leaves the folder slug on its task, which is how Step 1 and `task-board`'s unlinked-origin scan both see the folder as acted on.

The command and board write for each verdict:

- decline. `canon tasks decline <stem> --reason "<reason>, backlog triage <slug> item <cluster>#<n>" --json`, which clears the backlog line.
- archive. `canon tasks outcome <stem> --close <p> ... --json` for the named positions, then `canon tasks archive <stem> --json`.
- keep. Append the `## Findings` line naming what reproduced, leaving the backlog line.
- promote. `canon tasks place <stem> --group needs-a-plan --bottom --waiting "<what cleared>. Last" --json`, which clears the backlog line.

### Archive and missing files

An archive treats outcomes already closed as closed rather than refusing, so it still runs. Archive leaves `backlog.md` alone, so drop the task's backlog line once it succeeds, then append the `## Findings` line naming the evidence to the archived file.

A decline whose stem resolves to no file in `.canon/tasks/`, `declined/`, or `archive/` would refuse as `no-match`, so skip the verb. Drop the dangling line from `backlog.md` directly and report it as removed with no task behind it. Any other verdict on such an item is reported and skipped, since there is no file to act on.

### The findings line

Write it as `- **<YYYY-MM-DD>, backlog triage <slug>:** <verdict>, <evidence>`, the bold label form `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md` fixes. It is the last write on every verdict with a task file behind it.

Step 1 reads the line as applied, so a line written ahead of a refused move would mark a row done that never moved.

### Promote and a live orchestrator

Before any promote, check the roster the way `task-board` step 4 does, for a live session in this repository whose name starts with `orchestrator-` and whose `sessionId` is not this one.

When one is found, write the `## Findings` line but not `priority.md` or `backlog.md`, and message that session with the row and its cell so it places the row itself.

## Step 9: route on a refusal

Report every refusal on its item and continue with the rest, since one row's refusal says nothing about another's.

| Refusal                                               | Route                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `decline` with `no-match`                             | The task already moved elsewhere, so report and skip                                  |
| `outcome` refusing, or `archive` with `open-outcomes` | Too few positions named, so report those still open and leave the row, never guessing |
| A promote whose row already sits in `priority.md`     | Report it, skip the move, and still write the `## Findings` line                      |

A missing-file item never reaches the verb, per Step 8.

### Closing the run

Close with `canon tasks validate --json` and report every finding it raises against a row this run touched.

After a shell write under `.canon/tasks/`, regenerate the index with `canon indexes regen --no-stage --root <main-root> <main-root>/.canon/tasks/index.md`, since no hook fires on `Bash`.
