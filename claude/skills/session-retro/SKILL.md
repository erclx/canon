---
name: session-retro
description: Lists this session's toolkit friction as a ranked shortlist, matched against open feedback issues, and files each pick through `canon-feedback`. Use when asked "anything worth filing" or to "run a retro". Do NOT auto-trigger, and do NOT use to file one report already chosen.
metadata:
  family: upkeep
---

# Session retro

Turn what this session cost into toolkit feedback with evidence behind it. The scan, the filter, and the issue match run here. Filing belongs to `canon-feedback`, which this skill hands each pick to and never stands in for.

## Guards

- Run only on the operator's request. Never start this pass at a handoff, a compaction, or the end of a task.
- Read only the session's own context and the open issue list. Do not probe the project, list files, grep, or read toolkit surfaces to find or enrich a candidate.

## Step 1: collect candidates

Read the session for friction that actually happened, being each of these that the session holds:

- An extra session, a relaunch, or a second worker on one row
- An extra review round, or a fix the review sent back
- A wait, such as a stalled verb, a timeout, or a check waited on by hand
- A wrong output a later step had to repair, or a refusal from a verb, a gate, or a hook
- An operator intervention, being a correction, a repeated question, or a manual step

Write each as one line naming what happened and what it cost. A friction the session only imagines is no candidate.

When the session holds none, say `No toolkit friction in this session, so nothing to propose.` and stop. Never stretch a candidate to fill the list.

## Step 2: filter

Read `${CLAUDE_SKILL_DIR}/references/filter.md` on reaching this step, for the six tests, the order they run in, and the shortlist's shape. Test 5 needs the issue list from Step 3, so run tests 1 to 4 first.

Record the first test each dropped candidate fails. A candidate dropped without its test reads as one that was never weighed.

## Step 3: match the open feedback issues

Read the open queue through the CLI, never through `gh`, since only the CLI knows the toolkit's repository:

```bash
canon feedback --list --json
```

Branch on the record's `ok` rather than the exit, which a shell function wrapping `canon` can flatten to zero.

- `ok: true`. Match each surviving candidate against the `issues` by surface and by failure. A candidate a listed issue already covers becomes a follow-up on that issue's `number`, never a new report.
- `ok: false`. Say `The open-issue match did not run: <message>` above the shortlist, and propose every survivor as new with that stated.
- No record, or the binary carries no `--list`. Treat it as `ok: false` with the message `canon feedback --list is not available`.

Read an empty `issues` array as a queue with nothing open, which is a match that ran.

## Step 4: present the shortlist

Run tests 5 and 6 on each survivor, then rank and cap per `filter.md`. Show the shortlist and the dropped list in the shape it fixes, and stop for the operator's pick. File nothing the operator did not pick.

Label the pick question's options with the shortlist's short titles, so the operator picks by the names the list shows. The question tool takes at most four options, so a shortlist of five offers its first four and leaves the fifth to the free-text answer.

## Step 5: file each pick

Invoke `canon:canon-feedback` once per pick, carrying the candidate's evidence from this session in full, being the commands, the outputs, the rounds, and the cost.

Each pick becomes a public issue. Strip every project path and project name from the carried evidence first, and name the project by kind, as `canon-feedback` does for its project field.

- A new report goes through as a new issue
- A follow-up names its issue number, so `canon-feedback` builds the follow-up block
- A project-only candidate the operator picks anyway goes to the project's own board through `task-board`, never to the toolkit

Report each URL `canon-feedback` returns on its own line, and each pick it refused with the reason it gave.
