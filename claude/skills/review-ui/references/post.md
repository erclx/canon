---
title: Post the UI review
description: Step 7 of review-ui, which picks the heading, gives the body shape, ends every body on the head marker, scans it, and posts it as a pull request review
---

# Post the UI review

Step 7 of `review-ui`.

## The heading

The heading reports whether the branch owes anything, the way the code review's does.

- `## UI review` when a box failed, the sweep found a console error or an overflow, the worktree check read `changed`, a box was not driven for a cause on the page, or the pass drove no box at all.
- `## UI review closed` otherwise.

A needs-eyes box leaves the review closed, and so does a box not driven for a cause off the page, such as an address that did not answer or a `(local only)` box on a hosted preview, as long as something else was driven.

- Each is owed to the person who merges, and no commit can settle it, so opening the heading would hold the draft mark at every head
- Name each such box in the count line's not-driven count and in its Not driven entry
- Do not append the pull request number, which GitHub already renders

### A pass that drove no box

A pass with 0 failed, 0 need your eyes, 0 passed, and any box not driven looked at nothing, so it has not covered the head. It takes `## UI review` whatever the cause, including a checklist of only `(local only)` boxes on a hosted preview.

- Put a line naming the cause directly under the count line, such as the addresses tried and what each returned, ahead of the address line
- The cure is a re-drive on an address that answers, which Step 1 of `review-ui` allows past this verdict
- Message the controller with the cause and send the worker no `review-address`, since the verdict holds no box a fix worker could change
- `canon pr lift` refuses a close of this shape as `ui-undriven`, so a violation holds the draft mark
- A checklist with no box at all, which counts 0 not driven too, is an empty pass and takes the closed heading

## The body

Write it to `.canon/tmp/pr/review-ui/body-<number>-<short-sha>.md` at the main worktree root, sent as a heredoc the way `session-worktree` states for a main-root write. Load the `write-human` skill for the prose and follow `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md` for punctuation.

```markdown
<## UI review, or ## UI review closed, by the rule above>

F failed · E need your eyes · P passed · N not driven
Driven at `<short-sha>` on <address>, rendered by <renderer>.

### Failed

**<n>. <the box as written, shortened>**
<the value read against what the box expects>

![box <n>](link)

### Changed in the worktree

- `<path>`

### Needs your eyes

**<n>. <box> (taste)**

| Dark             | Light             |
| ---------------- | ----------------- |
| ![](<dark link>) | ![](<light link>) |

### Not driven

**<n>. <box>**: <the reason, and whether the cause sits on the page or off it>.

<details>
<summary>Passed (P)</summary>

| Box                   | Proof                                                  |
| --------------------- | ------------------------------------------------------ |
| <n>. <box, shortened> | <the value read, and the evidence `<stem>` it matched> |

</details>

<details>
<summary>Sweep and guessed wording</summary>

**Sweep**

- <route>, <width>: <console error, overflow, or probe reading to confirm>

**Guessed wording**

- Box <n>: <what the line left out and what the pass assumed>

</details>

🤖 Driven by Claude Code

<!-- review-ui: head=<head> -->
```

The post takes the length limits alone, with a box's reason under 350 characters and split into the reading and its cause where it runs longer, and keeps its H3 verdict groups and tables.

The body opens on its count line, in that order, so the operator reads what they owe before anything else. The second line carries the address, the head, and the renderer, and says the address was driven unverified when it came from the local rung or the launch.

- Drop each section holding no box, along with its heading. The order is fixed as Failed, Changed in the worktree, Needs your eyes, Not driven, then the folded blocks.
- A box takes exactly one section by its verdict, so a box that fails and also ends in `(taste)` appears once, under Failed
- Quote page text in backticks as content, never as the pass's own words

### A failed box

A box in a section opens on its number and the box as written, in bold, with the reading beneath it in words. A failed box that rests on a read has no image.

- A failed box resting on a frame shows it inline under its heading, the `![box <n>](link)` embed with the link exactly as `canon pr frames` returned it
- That link names the frame's path on the frames branch, which stays put while other pull requests' frames are dropped and carries this pass's stamp
- A later pass therefore never changes the image

### The drive copy and the worktree check

The two `canon pr drive-copy` reads at the start of Steps 4 and 7 each leave a mark on the body, so the operator knows what the drives touched.

- When Step 4 read `copied`, add `Drove a throwaway copy of <copied paths>.` as its own line directly under the address line, naming each path in backticks
- When Step 7's check read `changed`, list every path from `paths` under Changed in the worktree, in backticks, with no reading beside it. The heading opens, and Step 8 ticks nothing.
- When either read refused, add `Worktree check did not run, <reason>.` on a line of its own under the address line, so a skipped check never reads as a clean one

### A needs-eyes box

A needs-eyes box shows its dark and light shots in a two-cell table ahead of anything else it carries, since the operator decides from them without opening the app. A box whose evidence holds one theme still renders both cells.

- A cell is the `link` Step 5 pushed, or for a theme the worker's evidence shows, `https://github.com/<owner>/<repo>/blob/<head>/<path>?raw=true`
- `<path>` there is the matching state item's `path` off the evidence record
- A refused push leaves its cell reading `not shown, <reason>`, so the table keeps its shape, and the box's line names what the frame showed
- Never cite the local frame path, since a path under `.canon/` is a board identifier the label scan rejects

### The folded blocks

The Passed block holds one row per passed box, with its measurement and the evidence stem it matched in backticks, so every reading stays one click away. A row citing a stem links it as the evidence image in the form above when the record holds the item.

- Omit the Passed block when nothing passed, and the Sweep block when it found nothing
- Omit the Guessed wording block when every box named its route and width, and drop the folded block when both are empty

### An all-pass body

A pass where every box passed is the heading, the count line, the folded Passed block, and the marker, with no empty headings:

```markdown
## UI review closed

0 failed · 0 need your eyes · 8 passed · 0 not driven
Driven at `<short-sha>` on <address>, rendered by <renderer>.

<details>
<summary>Passed (8)</summary>

...

</details>
```

The count line is read by two verbs, `canon pr tick` for the passed count and `canon pr lift` for the driven test, so keep it exactly in the form `F failed · E need your eyes · P passed · N not driven`. A line that drifts reads as no counts, and both checks then stand down.

The count line and the sections beneath it hold the same totals, and Step 10's printed line is the same four counts. A pass where every box needs eyes and nothing else is owed takes the closed heading.

## The marker

End every body on `<!-- review-ui: head=<head> -->`, carrying the full sha Step 1 resolved. A body that replaces a standing close by `PUT` carries it too, at the head this pass drove.

The orchestrator's poll reads it off the last non-empty line to decide whether the verdict covers the current head. The submission stamp cannot answer that, since GitHub stamps it with whatever the head is at the moment of posting.

## Posting

Run `canon labels scan --body-file .canon/tmp/pr/review-ui/body-<number>-<short-sha>.md` against the body first, which applies the rule in `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md`. Nothing gates a file under `.canon/tmp/` before the review-event run does. Fix the body and scan again on a finding.

- Post it as a review rather than an issue comment, since the poll reads the UI family off reviews
- Skip the post when Step 1's newest verdict reads `## UI review closed` at an older head and this pass closes too, and read `${CLAUDE_SKILL_DIR}/references/close-out.md` instead
- Posting first in that case leaves two closes, both naming a head
- Record the instant just before the post, in UTC, as `<posted-at>`, since Step 9 keeps only review-event runs created after it
- The code review posts its own review on the same head and fires a run of the same gate, which is why that cutoff matters

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
gh api -X POST 'repos/{owner}/{repo}/pulls/<number>/reviews' -f event=COMMENT -F body=@.canon/tmp/pr/review-ui/body-<number>-<short-sha>.md --jq .html_url
```

The post goes through the REST reviews endpoint, since the `gh pr` review subcommand runs on GraphQL and fails where a cloud session's GitHub proxy refuses it.

- `-F` reads the file into the body, where `-f` would post the path itself
- The ticks come after the post, in Step 8, so the verdict and the ticks report the same `<head>`. A pass that stops before posting ticks nothing.
- Never pass `event=APPROVE` or `event=REQUEST_CHANGES`, which carry a state the poll does not read and a weight this pass has not earned
