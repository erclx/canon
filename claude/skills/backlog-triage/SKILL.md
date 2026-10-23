---
name: backlog-triage
description: Files a measured verdict for every backlog row into an intake folder, suggesting decline, archive, keep, or promote and leaning toward decline, then applies the verdicts the operator approved through the task verbs. Use when asked to "triage the backlog", "prune the backlog", "which backlog rows are still worth doing", "clear out the backlog", or "apply the backlog triage". Do NOT use to file a brain dump, which is `plan-intake`, to answer the filed items, which is `plan-intake-answer`, or to create or decline one named task, which is `task-board`, or archive one, which is `task-complete`.
metadata:
  family: decide
---

# Backlog triage

A backlog only grows while nothing can decline a row. This pass reads every row against the current tree, files one verdict per row for the operator, and later applies what they approved.

The record is an ordinary intake folder at `.canon/intake/<nn>-backlog-triage/`, so three sibling references bind it.

- `${CLAUDE_SKILL_DIR}/../plan-intake/references/intake.md`, read before writing any file in the folder, holds the item format, the frontmatter, the index shape, and the answer contract
- `${CLAUDE_SKILL_DIR}/../task-board/references/board.md`, read before applying, holds the backlog and the ordering file
- `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`, read before applying, holds the `Declined:` line

## Guards

- Resolve `.canon/tasks/` and `.canon/intake/` at the main worktree root, from `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside git
- If `.canon/tasks/backlog.md` does not exist at that root, stop: `❌ No backlog at .canon/tasks/backlog.md. Nothing to triage.`
- Never fill a `You:` slot, and never read an empty one as agreement, so silence never decides a row. Answering runs through `plan-intake-answer` or the operator's own edit.
- Branch on each `canon` record's `ok` and `reason` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

## Step 1: detect the phase

Run `canon intake list --json` and read the newest folder by ordinal whose slug ends in `-backlog-triage`. Where the binary carries no such subcommand, stop and report it, since a second folder would strand the first and apply needs the same verb.

| State of the newest folder                | Route                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| None, or fully applied                    | Run the file phase                                                                                         |
| Unread above zero                         | Stop: `❌ <n> items in <slug> are unread. Run /canon:plan-intake-answer, then re-run this skill to apply.` |
| Malformed above zero                      | Stop: `❌ <n> items in <slug> carry no answer slot. Repair them in the cluster files before applying.`     |
| Every item answered, some not yet applied | Run the apply phase                                                                                        |

### When an item counts as applied

Test each item rather than trusting a count, since a run can stop partway. An item apply skipped for an unreadable answer stays unapplied until the operator rewrites it.

- Its task has moved under `.canon/tasks/declined/` or `.canon/tasks/archive/`
- Its live task file carries a `## Findings` line naming the folder slug
- Its task file sits in none of the three folders and `backlog.md` no longer names it, since the dangling line is all apply has left to remove

## File phase

Writes only inside `.canon/intake/<nn>-backlog-triage/`, so it runs under any role, including a planner session.

### Step 2: claim the folder

Run `canon records ordinal intake backlog-triage --claim --json` and take its `name`. The verb creates the folder in the same act, so two sessions opening at once never share one. Where the binary carries no such subcommand, report it and stop rather than picking an ordinal by hand.

### Step 3: read every row

List each link in `.canon/tasks/backlog.md` and open its task file. Read its origin line (`Plan:`, `Groundwork:`, `Intake:`, or `Issue:`), its `## Outcomes`, and its `## Findings`. Read `.canon/tasks/priority.md` once, so a promote can name what sits at the bottom of `## Needs a plan`.

A row whose link resolves to no file gets an item anyway, carrying `decline` and naming the missing path, since the backlog line is the only thing left pointing at it.

### Step 4: measure each row

Measure every claim the task makes against the tree and `git log` during this pass, never carrying a figure from the task file forward, since it states what was true when filed. Name the commit the pass measured against in the overview body.

- Grep for the construct its defect names and count the sites
- Check whether each open outcome's behavior exists
- Search the log for a commit or pull request that shipped it under another task

For each row that reproduces, gather the evidence Step 5 reads, and record each piece that is absent as absent rather than inferring it.

- An issue, a run, or a person it bit, named in its origin line or `## Findings`
- A commit or pull request that worked around it rather than fixing it
- The shipped path a defect sits on, being a route or page users call, or a rule, seed, scaffold, or verb other repositories copy or run

### Step 5: pick the verdict

Keep and promote carry the burden of proof, and a defect that still exists does not meet it. A row filed against the tree nearly always reproduces, so a reproduction test alone keeps almost every row. A row earns keep or promote only by naming a cost or a reach from Step 4's evidence.

The two grounds, and what each takes:

- Cost. A wrong result this pass observed by running the verb or reading committed output, or an issue, run, person, or workaround commit it hit, not measured fixed.
- Reach. The defect sits on a shipped path, so everyone reaching it receives a wrong instruction, a broken or unbounded behavior, or a wrong output, hit or not.

A plausible cost names nothing. A row arguing what could go wrong off a shipped path, with no observed output and no hit, is declined however likely it sounds.

### What is not a reach

Three things are not a reach, and a row resting on one needs a cost instead.

- A missing feature on a shipped surface, which leaves the path working and adds a capability, a document kind, or guidance
- A defect that changes nothing a user or a target receives, such as dead code on a shipped path
- A defect that shows only in this repository's own config, workflows, scripts, or fixtures

A missing protection is a defect, not a missing feature, and is a reach. Read a row that way when the shipped path lacks a run-time bound, check, or guard, such as a limit, a timeout, or input validation, so it can fail, run unbounded, or return a wrong output.

A missing feature earns keep through the cost arm when a user asked for it in an issue or a report, or worked around its absence. A feature nobody asked for is declined, and neither a passing mention nor a request the project's own planning filed with no user behind it counts.

### The four verdicts

Age is evidence in neither direction. An old hit reads the same as a new one, by whether the pass measures it as still able to recur.

Each verdict takes one condition:

- keep. The defect reproduces this pass, with a count or a path, and the row names a cost or a reach with its observation, hit, or shipped path.
- promote. It qualifies for keep, and what it was waiting on has cleared, naming what cleared it.
- archive. Every open outcome is measured shipped, naming the commit or pull request per outcome position.
- decline. Anything else, including a reproduction naming no cost or reach, a defect the tree no longer holds, superseded work, or the filing alone.

### Step 6: write the items

Write one item per row in the intake item format, one cluster file per domain the task touches, numbered in read order. Head each item `### N. <task stem>` so apply can find the task from the heading alone.

- **`Problem:`** states what this pass measured, with the count, path, or commit behind it
- **`Fix:`** states what applying the verdict does to the board
- **`Worth it:`** names the cost or reach the verdict rests on in one clause, or says the row names neither. A `yes` or `later` alone carries no verdict.
- **`Open:`** reads `decline, archive, keep, or promote?` on every item
- **`Suggested:`** opens with exactly one verdict token, then the reason. An archive lists every outcome position it closes, as `archive 1, 3: shipped in #NNN`.
- **`Overlaps:`** names a live board task that already carries the work, where one does
- **`You:`** ships empty

Write `00-overview.md` last, per the intake standard, with the verdict counts by token and an open-questions list linking each item. Where the pass runs out of context before the index, write `99-next-session.md` naming the last row filed, since a compaction drops the rest.

## Apply phase

Writes the board and task files, so it refuses when this session's name starts with `planner-` or `worker-`. Read the name from `canon sessions list --self --json` before writing anything, and stop: `❌ Apply writes the board, which the <role> role bans. Run it from an operator or orchestrator session.`

A refused or failed read proceeds, since it is indistinguishable from a solo project running no named sessions. Every write here is a main-root write, so route a change inside an existing file the way `session-worktree` states, and report it rather than proceeding silently when that skill does not resolve.

### Step 7: read the answers

Read `${CLAUDE_SKILL_DIR}/references/apply.md` on reaching this step, for how each answer reads, what each verdict runs, and how a refusal routes. The file phase skips it.

### Step 8: run each verdict

Run each verdict through the task verbs the reference names, writing the `## Findings` line last on every verdict with a task file behind it.

### Step 9: route on a refusal

Report every refusal on its item and continue, then close with `canon tasks validate --json`, per the reference.

## Output

File phase:

```plaintext
📂 Opened .canon/intake/<nn>-backlog-triage/

**Filed:** <N> rows across <N> clusters, measured against <sha>
**Suggested:** <n> decline, <n> archive, <n> keep, <n> promote

Next: /canon:plan-intake-answer to answer the `You:` slots, then /canon:backlog-triage to apply
```

Apply phase, naming the path every write landed at:

```plaintext
✅ Applied .canon/intake/<nn>-backlog-triage/

**Declined:** .canon/tasks/declined/<stem>.md
**Archived:** .canon/tasks/archive/<stem>.md
**Kept:** .canon/tasks/<stem>.md
**Promoted:** .canon/tasks/<stem>.md, bottom of ## Needs a plan
**Skipped:** <item>, <reason>
```

Drop a line that carries no rows.
