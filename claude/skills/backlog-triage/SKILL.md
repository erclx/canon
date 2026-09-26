---
name: backlog-triage
description: Files a measured verdict for every backlog row into an intake folder, suggesting decline, archive, keep, or promote and leaning toward decline, then applies the verdicts the operator approved through the task verbs. Use when asked to "triage the backlog", "prune the backlog", "which backlog rows are still worth doing", "clear out the backlog", or "apply the backlog triage". Do NOT use to file a brain dump, which is `plan-intake`, to answer the filed items, which is `plan-intake-answer`, or to create, archive, or decline one named task, which is `task-board`.
---

# Backlog triage

A backlog only grows while nothing can decline a row. This pass reads every row against the current tree, files one verdict per row for the operator, and later applies what they approved.

The record is an ordinary intake folder at `.canon/intake/<nn>-backlog-triage/`. Read `${CLAUDE_SKILL_DIR}/../../standards/intake.md` before writing any file in it, since it holds the item format, the frontmatter, the index shape, and the answer contract this skill is bound by. Read `${CLAUDE_SKILL_DIR}/../../standards/board.md` and `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` before applying, since the first holds the backlog and the ordering file and the second holds the `Declined:` line.

## Guards

- Resolve `.canon/tasks/` and `.canon/intake/` at the main worktree root, not `pwd`. Run `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside a git repo.
- If `.canon/tasks/backlog.md` does not exist at that root, stop: `❌ No backlog at .canon/tasks/backlog.md. Nothing to triage.`
- Never fill a `You:` slot, and never read an empty one as agreement. Answering runs through `plan-intake-answer` or the operator's own edit, which is what keeps silence from deciding a row.
- Branch on each `canon` record's `ok` and `reason` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

## Step 1: detect the phase

Run `canon intake list --json` and take the folders whose slug ends in `-backlog-triage`. Read the newest by ordinal. Where the installed binary carries no such subcommand, stop and report it, since opening a folder beside one awaiting apply leaves the first stranded and applying needs the same verb.

- **No folder, or the newest is fully applied.** Run the file phase.
- **Unread above zero.** Stop: `❌ <n> items in <slug> are unread. Run /canon:plan-intake-answer, then re-run this skill to apply.`
- **Malformed above zero.** Stop: `❌ <n> items in <slug> carry no answer slot. Repair them in the cluster files before applying.`
- **Every item answered, some not yet applied.** Run the apply phase.

An item is applied once its task has moved under `.canon/tasks/declined/` or `.canon/tasks/archive/`, or once its live task file carries a `## Findings` line naming the folder slug. A task whose file sits in none of the three folders counts as applied only once `backlog.md` no longer names it, since its dangling line is the one thing apply has left to remove. Test that per item rather than trusting a count, since a run can stop partway. An item apply skipped for an unreadable answer stays unapplied, so the folder stays in the apply phase until the operator rewrites that answer.

## File phase

Writes only inside `.canon/intake/<nn>-backlog-triage/`, so it runs under any role, including a planner session.

### Step 2: claim the folder

Run `canon records ordinal intake backlog-triage --claim --json` and take its `name`. The verb creates the folder in the same act, so two sessions opening at once never share one. Where the installed binary carries no such subcommand, report it and stop rather than picking an ordinal by hand.

### Step 3: read every row

List each link in `.canon/tasks/backlog.md` and open its task file. Read its origin line (`Plan:`, `Groundwork:`, `Intake:`, or `Issue:`), its `## Outcomes`, and its `## Findings`. Read `.canon/tasks/priority.md` once, so a promote can name what sits at the bottom of `## Needs a plan`.

A row whose link resolves to no file gets an item anyway, carrying `decline` and naming the missing path, since the backlog line is the only thing left pointing at it.

### Step 4: measure each row

Measure every claim the task makes against the tree and `git log` during this pass. Grep for the construct its defect names and count the sites, check whether each open outcome's behavior exists, and search the log for a commit or pull request that shipped it under another task. Never carry a figure from the task file forward as current, since the task states what was true when it was filed.

Name the commit the pass measured against in the overview body.

### Step 5: pick the verdict

Keep and promote carry the burden of proof. A row nobody can argue for from this pass's measurement is declined.

- **keep**: the defect or gap reproduces this pass, stated with a count or a path.
- **promote**: it reproduces, and the thing it was waiting on has cleared, naming what cleared it.
- **archive**: every open outcome is measured shipped, naming the commit or pull request per outcome position.
- **decline**: anything else, including a defect the tree no longer holds, work superseded by another task, and a row whose argument rests only on its original filing.

Age is evidence in neither direction. A row untouched for months is not more declinable than one filed yesterday, and a row filed yesterday is not more worth keeping.

### Step 6: write the items

Write one item per row in the intake item format, one cluster file per domain the task touches, numbered in read order. Head each item `### N. <task stem>` so apply can find the task from the heading alone.

- `Problem:` states what this pass measured, with the count, path, or commit behind it
- `Fix:` states what applying the verdict does to the board
- `Worth it:` carries the verdict's reason in one clause
- `Open:` reads `decline, archive, keep, or promote?` on every item
- `Suggested:` opens with exactly one of the four verdict tokens, then the reason. An archive suggestion lists every outcome position it closes, as `archive 1, 3: shipped in #NNN`
- `Overlaps:` names a live board task that already carries the work, where one does
- `You:` ships empty

Write `00-overview.md` last, per the intake standard, with the verdict counts by token and an open-questions list linking each item. Where the pass runs out of context before the index, write `99-next-session.md` naming the last row filed, since a compaction drops the rest.

## Apply phase

Writes the board and task files. Refuses when this session's name starts with `planner-` or `worker-`: read it from `canon sessions list --self --json` before writing anything, and stop: `❌ Apply writes the board, which the <role> role bans. Run it from an operator or orchestrator session.` A refused or failed read proceeds, since it is indistinguishable from a solo project running no named sessions.

Every write here is a main-root write. Route a change inside an existing file the way `session-worktree` states, and report it rather than proceeding silently when that skill does not resolve.

### Step 7: read the answers

Run `canon intake list <slug> --json` and read each item's `answer` and `suggested`.

- An answer of `ok` takes the suggested verdict. A `suggested` that opens with no verdict token is malformed: report the item and skip it, never treating it as keep.
- An answer opening with a verdict token overrides the suggestion. An override to archive names its own outcome positions, and one that names none is reported and skipped.
- Any other answer, such as a free-text note, is reported and skipped. Never guess a verdict from prose.
- An item already applied, by the test in Step 1, is skipped silently, which is what makes a re-run write nothing twice.

### Step 8: run each verdict

Take the task stem from the item heading. Every verdict leaves the folder slug on its task, which is how Step 1 and `task-board`'s unlinked-origin scan both see the folder as acted on.

- **decline**: `canon tasks decline <stem> --reason "<reason>, backlog triage <slug> item <cluster>#<n>" --json`. The verb clears the backlog line.
- **decline on a missing file**: when the stem resolves to no file in `.canon/tasks/`, `declined/`, or `archive/`, the verb would refuse as `no-match`, so skip it. Drop the dangling line from `backlog.md` directly and report it as removed with no task behind it. Any other verdict on such an item is reported and skipped, since there is no file to keep, archive, or promote.
- **archive**: `canon tasks outcome <stem> --close <p> ... --json` for the named positions, then `canon tasks archive <stem> --json`. Outcomes already closed report as closed rather than refusing, so archive still runs. Archive leaves `backlog.md` alone, so drop the task's backlog line once it succeeds, then append the `## Findings` line naming the evidence to the archived file.
- **keep**: append the `## Findings` line naming what reproduced. The backlog line stays.
- **promote**: move the backlog line to the bottom of `## Needs a plan` in `.canon/tasks/priority.md`, with a `Waiting on` cell stating what cleared and ending in `last`, then append the `## Findings` line.

Write the `## Findings` line as `- <YYYY-MM-DD>, backlog triage <slug>: <verdict>, <evidence>`. It is the last write on every verdict with a task file behind it, since Step 1 reads it as applied and a line written ahead of a refused move would mark a row done that never moved.

Before any promote, check the roster the way `task-board` step 4 does: a live session in this repository whose name starts with `orchestrator-` and whose `sessionId` is not this one. When one is found, write the `## Findings` line but not `priority.md` or `backlog.md`, and message that session with the row and its cell so it places the row itself.

### Step 9: route on a refusal

Report every refusal on its item and continue with the rest, since one row's refusal says nothing about another's.

- `decline` refusing with `no-match`: the task already moved elsewhere. Report and skip. A missing-file item never reaches the verb, per Step 8.
- `outcome` refusing, or `archive` refusing with `open-outcomes`: the verdict named too few positions. Report the positions still open and leave the row on the backlog. Never retry with guessed positions.
- A promote whose row already sits in `priority.md`: report it, skip the move, and still write the `## Findings` line.

Close with `canon tasks validate --json` and report every finding it raises against a row this run touched. After a shell write under `.canon/tasks/`, regenerate the index with `canon indexes regen --no-stage --root <main-root> <main-root>/.canon/tasks/index.md`, since no hook fires on `Bash`.

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
