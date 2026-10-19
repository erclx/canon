---
title: Rebase-only run
description: The reply body, closing confirmation, and output line review-address takes when its guard sent it straight to the rebase with no review findings to map
---

# Rebase-only run

Read from Steps 6, 7, and 8 of `review-address` when the second guard sent the run straight to step 5 with no findings open. A run carrying findings skips this file.

## Reply body

A rebase-only run has no findings to map, so it takes a different body rather than an empty list. Open it with `## Rebase`, since nothing on the pull request is being responded to and `## Review response` claims a review this run never read.

- Open on one sentence naming the commit rebased onto and what landed on `main`, and which half of the staleness test fired, being a branch that stopped merging or one `main` changed files under
- Give one short line each to the files resolved by hand, those the regen rebuilt, and those replayed with no conflict, each under 200 characters
- Close with `🤖 Addressed by Claude Code` on its own line, the same as a review response

```markdown
## Rebase

Rebased onto main at `<short-sha>`, because <why>.

- Resolved by hand: `<path>`. <What the resolution kept, in one sentence.>
- Rebuilt by the regen: `<path>`, `<path>`
- Replayed with no conflict: `<path>`

🤖 Addressed by Claude Code
```

The heading stays outside the `## Review` family, so the close-out's equality test on the first line never matches it.

## Closing confirmation

Claiming findings were addressed on a pull request carrying none is false on a surface nothing else checks. Append this line at Step 7 in place of the findings confirmation, then re-run the scan:

```bash
printf '\n✅ Rebased onto origin/main, CI green. No review findings were open.\n' >> .canon/tmp/pr/reply/reply-<number>.md
```

## Output

Drop the findings line rather than reporting zero findings addressed, and lead with the rebase:

```plaintext
Rebased PR #<number> onto origin/main. <N> files resolved by hand, <N> rebuilt by the check.
```
