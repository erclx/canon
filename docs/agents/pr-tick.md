---
title: The pull request checklist tick
description: How canon pr tick marks the checklist boxes a UI pass drove, the stamp that names the commit each passed at, why a render at a newer head clears a tick, the refusal reasons it names, and why a taste box is never ticked
---

# The pull request checklist tick

`canon pr tick` ticks the boxes of the visual checklist on the pull request's
evidence comment. `review-ui` calls it once its verdict has posted, for every
box that passed at the head it drove, so the person merging reads a checklist
a driver worked through instead of one that stays empty.

```bash
canon pr tick 1341 --boxes 1,2,4 --head <sha> --json
```

Box numbers come from the `boxes` field of `canon pr evidence --json`, which
numbers the checklist's box lines in order. A caller never counts lines itself.

## What a tick looks like

A ticked box ends in the commit it passed at, visible on the comment:

```markdown
- [x] click "Pricing" in the header → the pricing page opens · passed at `<short-sha>`
```

The stamp is visible rather than an HTML comment because the person it is for
reads the merge record, and a hidden head would tell the machine what the
reader cannot see. The reader matches the stamp only as the trailing segment of
a line, so a box whose own text says `passed at` is left alone.

## When a tick is cleared

A tick is a claim about one commit, so a render at another commit does not
carry it forward. `canon pr evidence` settles the checklist before it renders:

- A tick stamped for the render's head stays.
- A tick stamped for any other head is cleared and loses its stamp.
- A tick with no stamp, such as one an author or the operator added by hand,
  stays only when the comment it came from described the render's head.

A render at the same head after `--preview` keeps every tick. A push that
reaches the branch without a render leaves its ticks in place until the next
one, and the stamp still shows which head earned them.

## What it refuses

`reason` on the record is what a caller branches on, not the exit code:

| Reason         | What it means                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `ticked`       | The boxes were ticked, with the remote tip in `head`.                                                        |
| `stale-head`   | `--head` is not the branch tip on the remote. Nothing is written.                                            |
| `taste-box`    | A named box ends in `(taste)`. Nothing is written.                                                           |
| `no-box`       | A named number is past the end of the checklist. Nothing is written.                                         |
| `no-checklist` | The evidence comment carries no checklist.                                                                   |
| `no-comment`   | No comment on the pull request carries the evidence marker.                                                  |
| `bad-boxes`    | `--boxes` is not a list of positive whole numbers, or `--head` is not a hex sha of seven characters or more. |

A taste box is a judgment of look or feel that a driver reports as needing a
person's eyes. Refusing it in the verb makes that rule a check rather than a
sentence a driver can talk itself out of, and a refusal writes none of the
boxes named beside it.

The head is compared against the tip read from the remote rather than the pull
request object, which lags a push by up to a minute. A push landing between
that read and the write leaves a tick at an older head until the next render
clears it, the same window `canon pr head` documents.

The verb edits the marked comment in place with a `PATCH`, the way
`canon pr local --remove` does, and ticking a box again restamps it.
