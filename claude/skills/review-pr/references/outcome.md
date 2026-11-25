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

The fence form takes a finding the scan cannot reach, since it sees a command only by its prompt and reads no JSON.

- A fence mixing kinds under one identifier, such as a command with no prompt beside its output, is a `minor` under the same block
- A JSON record laid out other than as `jq .` prints it is a `minor` under the same block, since a placeholder value leaves nothing a parser could check

## A measurement table

A `perf` pull request carries a table of measurements under Outcome in place of a produced shape, per `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`. Skip the shape comparison above for it. The diff produces no such table, so comparing would draw a `should-fix` on every compliant body.

Read the table against the claim in the Summary instead.

- A headline number the table does not support, or a table with no run behind its figures, is a `should-fix` under the `**PR body**` block
- A row reading `not measured` with its reason beside it takes no finding
- A row reading `pending` is named in the review, and the close waits on the filled row, since `canon pr lift` refuses `measurement-pending` while one stands
- A `pending` row linking no Actions run is a `should-fix` under the same block, since nothing says what it waits on

## What takes no finding

- A body carrying no Outcome, since the section is optional
- A changed shape the body leaves without one, since whether to write it is the author's judgment
- A mixed change showing its text shape and pointing at the evidence comment in one line
- A fenced line past the width limit, since `canon labels scan` fails it before review
- A `fence-language`, `fence-prompt`, or `fence-output`, which the same scan fails before review
