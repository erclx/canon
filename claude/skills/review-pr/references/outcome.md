---
title: Outcome check
description: How review-pr Step 3 tests the shape a pull request body's Outcome section shows against what the diff produces, and which mismatch becomes a finding
---

# Test the outcome shape

Part of Step 3 of `review-pr`. The session reads this file after `## Key changes` and only when the body carries `## Outcome`.

Outcome shows the new shape of a record, a verb's output or flags, a config, or a report, with placeholders for the values. The diff can falsify it the way it falsifies a ticked box, so read it even though the Summary and Technical context stay unread. The rules for when a body carries it sit in `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`.

## Compare the shape

Read the record, output, or config the section names at `<headRefOid>`, through `git show <headRefOid>:<path>` or the code that emits it, and compare it with what the section shows.

- A field, flag, or line the section shows and the diff does not produce is a `should-fix` under the `**PR body**` block, since a reader takes the section for the new shape
- A field, flag, or line the diff produces and the section leaves out is a `should-fix` under the same block when a reader writing that shape would need it
- A placeholder standing where a fixed value sits, or the reverse, is a `minor` under the same block
- An Outcome showing a UI result is a `minor` under the same block, since the evidence comment carries that result

## What takes no finding

- A body carrying no Outcome, since the section is optional
- A changed shape the body leaves without one, since whether to write it is the author's judgment
- A mixed change showing its text shape and pointing at the evidence comment in one line
- A fenced line past the width limit, since `canon labels scan` fails it before review
