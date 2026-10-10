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

Write it to `.canon/tmp/pr/review-ui/body-<number>-<short-sha>.md` at the main worktree root, sent as a heredoc the way `session-worktree` states for a main-root write. Load the `write-human` skill for the prose and follow `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md` for punctuation.

```markdown
<## UI review, or ## UI review closed, by the rule above>

P passed, F failed, E need eyes, N not driven. Drove <address> at <short-sha>, rendered by <renderer>.

| Box                                          | Evidence                                      |
| -------------------------------------------- | --------------------------------------------- |
| **Fail.** 1. <the box as written, shortened> | <the value read against what the box expects> |
| **Needs eyes.** 2. <box>                     | <what the frame showed, in words>             |
| **Pass.** 3. <box>                           | Evidence `<stem>` <what it showed, in words>  |

**Frames**

- Box 2, needs eyes:

  ![](link)

**Sweep**

- <route>, <width>: <console error, overflow, or probe reading to confirm>

**Guessed wording**

- Box <n>: <what the line left out and what the pass assumed>

🤖 Driven by Claude Code

<!-- review-ui: head=<head> -->
```

The table has two columns and each Box cell opens on its verdict in bold with a period: `**Pass.**`, `**Fail.**`, `**Needs eyes.**`, or `**Not driven.**`. A column holding only those short words loses its width beside two long ones and GitHub breaks its header mid-word, so the verdict rides in the Box cell instead.

An Evidence cell resting on a frame holds words only, so the table's text columns keep the body's width. A frame Step 5 pushed goes in the Frames block below the table, one `Box <n>, <verdict>` label then the `![](<link>)` embed for each framed box, with the link exactly as `canon pr frames` returned it. It names the frame's path on the frames branch, which stays put while other pull requests' frames are dropped and carries this pass's stamp, so a later pass never changes the image.

The row still says what the frame showed, so it reads without the image. A state the worker's evidence already shows names the evidence stem in backticks and embeds nothing, since the evidence comment carries that image. A push that refused leaves the words alone and names the reason. Omit the Frames block when no box pushed a frame. Never cite the local frame path, since a path under `.canon/` is a board identifier the label scan rejects.

A pass where every box needs eyes and nothing else is owed takes the closed heading:

```markdown
## UI review closed

0 passed, 0 failed, 3 need eyes, 0 not driven. Drove <address> at <short-sha>, rendered by <renderer>.
```

Omit the Sweep block when it found nothing, and the Guessed wording block when every box named its route and width. Quote page text in backticks as content, never as the pass's own words.

## The marker

End every body on `<!-- review-ui: head=<head> -->`, carrying the full sha Step 1 resolved. The orchestrator's poll reads it off the last non-empty line to decide whether the verdict covers the current head, and the submission stamp cannot answer that, since GitHub stamps it with whatever the head is at the moment of posting.

## Posting

Run `canon labels scan --body-file .canon/tmp/pr/review-ui/body-<number>-<short-sha>.md` against the body first, which applies the rule in `${CLAUDE_SKILL_DIR}/../../standards/publish.md`, since nothing gates a file under `.canon/tmp/` before the review-event run does. Fix the body and scan again on a finding. Then post it as a review rather than an issue comment, since the poll reads the UI family off reviews:

Record the instant just before the post, in UTC, as `<posted-at>`. Step 9 keeps only review-event runs created after it, since the code review posts its own review on the same head and fires a run of the same gate.

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
gh api -X POST 'repos/{owner}/{repo}/pulls/<number>/reviews' -f event=COMMENT -F body=@.canon/tmp/pr/review-ui/body-<number>-<short-sha>.md --jq .html_url
```

The post goes through the REST reviews endpoint rather than the `gh pr` review subcommand, which runs on GraphQL and fails where a cloud session's GitHub proxy refuses it. `-F` reads the file into the body, where `-f` would post the path itself.

The ticks come after the post, in Step 8, so the verdict and the ticks report the same `<head>`. The post never ticks, and a pass that stops before posting ticks nothing.

Never pass `event=APPROVE` or `event=REQUEST_CHANGES`, which carry a state the poll does not read and a weight this pass has not earned.
