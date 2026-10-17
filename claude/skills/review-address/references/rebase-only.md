---
title: Rebase-only run
description: The reply body, closing confirmation, and output line review-address takes when its guard sent it straight to the rebase with no review findings to map
---

# Rebase-only run

Read from Steps 6, 7, and 8 of `review-address` when the second guard sent the run straight to step 5 with no findings open. A run carrying findings skips this file.

## Reply body

A rebase-only run has no findings to map, so it takes a different body rather than an empty list. Open it with `## Rebase`, since nothing on the pull request is being responded to and `## Review response` claims a review this run never read.

- State which half of the staleness test fired, being a branch that stopped merging or one `main` changed files under
- Name what landed on `main`, then the files resolved by hand and those the regen rebuilt
- Close with `🤖 Addressed by Claude Code` on its own line, the same as a review response

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
