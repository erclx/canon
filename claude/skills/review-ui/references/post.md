---
title: Post the UI review
description: Step 7 of review-ui, which picks the heading, gives the body shape, ends every body on the head marker, scans it, and posts it as a pull request review
---

# Post the UI review

Step 7 of `review-ui`.

## The heading

The heading reports whether the branch owes anything, the way the code review's does.

- `## UI review` when a box failed, the sweep found a console error or an overflow, or a box was not driven for a cause on the page, such as a target the snapshot does not hold.
- `## UI review closed` otherwise.

A needs-eyes box leaves the review closed, and so does a box not driven for a cause off the page: an address that did not answer, or a `(local only)` box on a hosted preview. Each is owed to the person who merges rather than to the branch, and no commit on the branch can settle it, so opening the heading would hold the draft mark at every head. Name each such box in the summary line's not-driven count and in its row's evidence. Do not append the pull request number, which GitHub already renders.

## The body

Write it to `.canon/tmp/pr/review-ui/body-<number>-<short-sha>.md` at the main worktree root, sent as a heredoc the way `session-worktree` states for a main-root write. Load the `write-human` skill for the prose and follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for punctuation.

```markdown
## UI review

P passed, F failed, E need eyes, N not driven. Drove <address> at <short-sha>, rendered by <renderer>.

| Box                                | Verdict    | Evidence                                      |
| ---------------------------------- | ---------- | --------------------------------------------- |
| 1. <the box as written, shortened> | fail       | <the value read against what the box expects> |
| 2. <box>                           | needs eyes | `<frame path>`                                |

**Sweep**

- <route>, <width>: <console error, overflow, or probe reading to confirm>

**Guessed wording**

- Box <n>: <what the line left out and what the pass assumed>

🤖 Driven by Claude Code

<!-- review-ui: head=<head> -->
```

Omit the Sweep block when it found nothing, and the Guessed wording block when every box named its route and width. Quote page text in backticks as content, never as the pass's own words.

## The marker

End every body on `<!-- review-ui: head=<head> -->`, carrying the full sha Step 1 resolved. The orchestrator's poll reads it off the last non-empty line to decide whether the verdict covers the current head, and the submission stamp cannot answer that, since GitHub stamps it with whatever the head is at the moment of posting.

## Posting

Run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the body first, since nothing gates a file under `.canon/tmp/`. Then post it as a review rather than an issue comment, since the poll reads the UI family off reviews:

```bash
gh pr review <number> --comment --body-file .canon/tmp/pr/review-ui/body-<number>-<short-sha>.md
```

Never post through `--approve` or `--request-changes`, which carry a state the poll does not read and a weight this pass has not earned.
