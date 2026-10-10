---
name: canon-feedback-triage
description: Files every open GitHub issue labeled `feedback` on the toolkit repo into an intake folder as one measured item each, skipping any issue the board already carries. Use when asked to "triage toolkit feedback", "work through the feedback issues", "process feedback issues", or "what feedback is open". Do NOT use to file new feedback (that is `canon-feedback`), to answer the filed items (that is `plan-intake-answer`), or for general GitHub issue triage unrelated to toolkit feedback.
metadata:
  family: upkeep
---

# Canon feedback triage

Consume the feedback queue that `canon feedback` fills. Each open `feedback` issue is measured against the tree and filed as one item for the operator, who answers it before anything is built.

The record is an ordinary intake folder at `.canon/intake/<nn>-feedback-triage/`. Read `${CLAUDE_SKILL_DIR}/../../standards/intake.md` before writing any file in it, since it holds the item format, the frontmatter, the index shape, and the answer contract this skill is bound by.

Run from the toolkit repo root. This skill reads GitHub issues and writes only inside its claimed folder. It posts no comment, close, or label to GitHub.

## Guards

- Resolve `.canon/tasks/` and `.canon/intake/` at the main worktree root, not `pwd`. Run `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside a git repo.
- If `gh` is not on PATH, stop: `❌ gh CLI not found. Install it to read feedback issues.`
- If `gh auth status` fails, stop: `❌ gh is not authenticated. Run gh auth login.`
- If no open `feedback` issues exist, stop: `✅ No open feedback issues.`
- Never fill a `You:` slot, and never read an empty one as agreement. Answering runs through `plan-intake-answer` or the operator's own edit.
- Branch on each `canon` record's `ok` and `reason` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

## Step 1: list the queue

```bash
gh issue list --label feedback --state open --limit 1000 --json number,title,body,labels
```

Take every issue. An issue without the `feedback` label does not surface here by design.

## Step 2: drop what the board already carries

An issue is carried when its number appears in a live or archived task's `Issue:` line under `.canon/tasks/`, or in an item heading of an existing `.canon/intake/` folder, written `(#NNN)`. Search both at the main root.

Set each carried issue aside with its carrier, a task path or a folder and item. Name every one in the overview, so a re-run while an earlier folder sits unanswered files nothing twice. When every issue is carried, stop: `✅ Every open feedback issue is already on the board.`

## Step 3: claim the folder

Run `canon records ordinal intake feedback-triage --claim --json` and take its `name`. The verb creates the folder in the same act, so two sessions opening at once never share one. Where the installed binary carries no such subcommand, report it and stop rather than picking an ordinal by hand.

## Step 4: measure each issue

For each remaining issue, measure its claim against the tree during this pass. Grep for the construct its defect names and count the sites, check whether the behavior it asks for exists, and search the log for a commit or pull request that shipped it under another task. Never carry a figure from the issue forward as current, since it states what was true when it was filed.

Classify each against the toolkit's own surfaces:

- **Direct fix.** One surface, one file, no architectural choice. A typo, a stale reference, a one-line correction.
- **Plan-worthy.** Multiple files, a new skill or rule, a behavior change, or a cross-surface move.
- **Needs clarification.** The observed and expected behavior conflict or the surface is unnamed. The item asks the operator for the missing detail.

Strip the reporting project's specifics from the fix, being its filenames, frameworks, deploy targets, and label values. The issue describes one project, and the fix serves every project that installs the toolkit.

Name the commit the pass measured against in the overview.

## Step 5: write the items

Write one item per issue in the intake item format, one cluster file per domain the fix touches, numbered in read order. Head each item `### N. <defect> (#NNN)` so an answer finds its issue.

- `Problem:` states what this pass measured, with the count, path, or commit behind it
- `Fix:` states the class from Step 4 and the change it names
- `Open:` reads `fix, plan, ask, or decline?` on every item
- `Suggested:` opens with exactly one of those tokens, then the reason
- `You:` ships empty

Write `00-overview.md` last, per the intake standard, with the counts by token, an open-questions list linking each item, the commit measured against, and every issue skipped in Step 2 with its carrier. Where the pass runs out of context before the index, write `99-next-session.md` naming the last issue filed.

## Output

```plaintext
📂 Opened .canon/intake/<nn>-feedback-triage/

**Filed:** <N> issues across <N> clusters, measured against <sha>
**Skipped:** <n> already carried
**Suggested:** <n> fix, <n> plan, <n> ask, <n> decline

Next: /canon:plan-intake-answer to answer the `You:` slots
```

An answered fix or plan item promotes through `task-board` with an `Issue: #NNN` line, and the shipping pull request's `Closes #NNN` drains the queue. Closing a declined issue on GitHub stays the operator's act.

## Notes

- The `feedback` label is what `canon feedback` and the `toolkit-feedback.yml` issue form both apply.
- This skill files and never reimplements. `plan-intake-answer` owns the answers and `task-board` owns the task a fix becomes.
