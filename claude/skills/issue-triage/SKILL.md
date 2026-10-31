---
name: issue-triage
description: Files the open GitHub issues on the current repository into an intake folder as one measured item each, narrowed by an optional label, capped per pass, and skipping any issue the board already carries. Use when asked to "triage the issues", "work through the open issues", "file the GitHub issues", "triage the bug label", or "what issues are open". Do NOT use to open a new issue, which is `git-issue`, to answer the filed items, which is `plan-intake-answer`, or to triage the task backlog, which is `backlog-triage`.
metadata:
  family: decide
---

# Issue triage

An issue queue only grows while nothing reads it against the tree. This pass measures each open issue and files it as one item for the operator, who answers it before anything is built.

The record is an ordinary intake folder at `.canon/intake/<nn>-<slug>-triage/`. Read `${CLAUDE_SKILL_DIR}/../plan-intake/references/intake.md` before writing any file in it, since it holds the item format, the frontmatter, the index shape, and the answer contract this skill is bound by.

- Read GitHub issues and write only inside the claimed folder, posting no comment, close, or label to GitHub
- Measure each issue against this repository, since the repository it was filed on is the one its fix lands in

## Arguments

Both are optional and come in either order.

- A label narrows the queue to issues carrying it. With none, every open issue is in the queue and the slug is `issue`.
- A label sets the slug too, lowercased with each run of other characters made one hyphen, so `good first issue` gives `good-first-issue`. Pass the raw label, quoted, to `--label`.
- A number sets the cap, the most issues one pass files. With none, the cap is 25, about what one answering session gets through.

## Guards

- Resolve `.canon/tasks/` and `.canon/intake/` at the main worktree root, from `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside git
- If `gh` is not on PATH, stop: `❌ gh CLI not found. Install it to read the issue queue.`
- If `gh auth status` fails, stop: `❌ gh is not authenticated. Run gh auth login.`
- If `gh repo view --json nameWithOwner` fails, stop: `❌ No GitHub repository here. Run from a checkout with a GitHub remote.`
- If no open issue matches, stop: `✅ No open issues.`

### Slots and records

Two more guards hold through every step.

- Never fill a `You:` slot, and never read an empty one as agreement. Answering runs through `plan-intake-answer` or the operator's own edit.
- Branch on each `canon` record's `ok` and `reason` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

## Step 1: list the queue

```bash
gh issue list --state open --limit 1000 --search "sort:created-asc" --json number,title
```

Add `--label "<label>"` when one was given, and name that label in the empty-queue stop. The list carries no bodies, so a large queue costs a line per issue rather than its whole text.

Sorting by creation keeps the oldest issues when the queue passes the limit. When the list returns 1000 rows, the queue may hold more, so Step 3 writes its left-over count as a floor.

## Step 2: drop what the board already carries

An issue is carried when its number appears in a live or archived task's `Issue:` line under `.canon/tasks/`, or in an item heading of an existing `.canon/intake/` folder, written `(#NNN)`. Search both at the main root.

Set each carried issue aside with its carrier, a task path or a folder and item.

- Name every one in the overview, so a re-run while an earlier folder sits unanswered files nothing twice
- Read its comments with `gh issue view <NNN> --json comments`, and name their count and newest date beside its carrier, so a follow-up posted after the carrier was filed is seen
- File no item for a comment on a carried issue, since an item would file the issue twice against a live task

When every issue is carried, stop: `✅ Every open issue is already on the board.`

## Step 3: apply the cap

Sort the remaining issues by number, oldest first, and keep the first issues up to the cap, so the reports that waited longest drain first. Count the issues past the cap as left over, and name them in the overview and the output.

- Give the count and the lowest number left over, so a drained queue and a capped one never read the same
- Write the count as `at least <n>` when Step 1 hit its limit

Then read each kept issue whole, since a follow-up posted as a comment is part of the report:

```bash
gh issue view <NNN> --json number,title,body,labels,comments
```

## Step 4: claim the folder

Run `canon records ordinal intake <slug>-triage --claim --json` and take its `name`. The verb creates the folder in the same act, so two sessions opening at once never share one. Where the installed binary carries no such subcommand, report it and stop rather than picking an ordinal by hand.

## Step 5: measure each issue

For each kept issue, measure its claim against the tree during this pass, never carrying a figure from the issue forward, since it states what was true when filed.

Measure each comment's claim the same way, whoever posted it, and fold it into the issue's one item rather than filing a second. When a comment contradicts the body, measure the later claim and name the comment as the source on `Problem:`.

- Grep for the construct its defect names and count the sites
- Check whether the behavior it asks for exists
- Search the log for a commit or pull request that shipped it under another task
- Run the issue's repro in a form that writes nothing when it is one command that works here, and say on `Problem:` what it showed
- Mark the item `not reproduced here` when the repro needs more, per `## Repro versus groundwork` in the intake standard

Classify each against this repository's own surfaces:

- **Direct fix.** A size, not an answer, so it suggests `plan` and `Fix:` says a short plan covers it. One surface, one file, no architectural choice. A typo, a stale reference, a one-line correction.
- **Plan-worthy.** Multiple files, a new module or command, a behavior change, or a cross-surface move.
- **Needs clarification.** The observed and expected behavior conflict or the surface is unnamed. The item asks the operator for the missing detail.

Name the commit the pass measured against in the overview.

## Step 6: write the items

Write one item per issue in the intake item format, one cluster file per domain the fix touches, numbered in read order. Head each item `### N. <defect> (#NNN)` so an answer finds its issue.

- `Problem:` states what this pass measured, with the count, path, or commit behind it
- `Fix:` states the class from Step 5 and the change it names
- `Open:` reads `plan, ask, or decline?` on every item
- `Suggested:` opens with exactly one of those tokens, then the reason
- `You:` ships empty

Write `00-overview.md` last, per the intake standard. It carries the counts by token, an open-questions list linking each item, the commit measured against, every issue skipped in Step 2 with its carrier, and the left-over count from Step 3. Where the pass runs out of context before the index, write `99-next-session.md` naming the last issue filed.

## Output

```plaintext
📂 Opened .canon/intake/<nn>-<slug>-triage/

**Filed:** <N> issues across <N> clusters, measured against <sha>
**Skipped:** <n> already carried
**Left over:** <n> past the cap of <cap>, from #<lowest>
**Suggested:** <n> plan, <n> ask, <n> decline

Next: /canon:plan-intake-answer to answer the `You:` slots
```

Drop the `Left over:` line when nothing was past the cap.

An answered plan item promotes through `task-board` with an `Issue: #NNN` line, and the shipping pull request's `Closes #NNN` drains the queue. This skill still closes nothing. `plan-intake-answer` offers the close of a declined issue when the decline is answered, and the operator's yes posts it.

## Notes

- This skill files and never reimplements. `plan-intake-answer` owns the answers and `task-board` owns the task a plan item becomes.
