---
title: The pull request evidence layout
description: How canon pr evidence groups screenshots into one block per view with a row per width and a column per theme, when a base column appears, where a name outside the form lands, how the commit line links, and when the blocks open
---

# The pull request evidence layout

`canon pr evidence` renders the screenshots of a pull request as blocks a
reviewer reads by view. The record behind them, and the reasons a run can
refuse, are in `canon docs pr-evidence`.

## One block per view

A case name that ends in `-dark-<width>` or `-light-<width>` belongs to the
view named by everything before that suffix, so `menu-open-light-1440` is the
`menu-open` view. The name is split from the right because a view may carry
hyphens of its own.

Each view is one `<details>` block. Its summary carries the view and its case
count, a row holds one width in ascending number order, and a column holds one
theme:

```markdown
| Width | Dark | Light |
```

A view with any case already at the base takes a base and a head column per
theme, and a case the pull request added shows `*(new)*` in its base cell:

```markdown
| Width | Dark base | Dark head | Light base | Light head |
```

A cell with no case in it stays empty. A theme no case of the view carries has
no column. A state under a named directory titles its blocks
`<state> / <view>`, so two states holding one view never repeat a name.

## Names outside the form

A case name that does not split into a view, a theme, and a width lands in a
flat `Case | Base | Head` block for its state, or `Case | Head` when every case
in it is new. Nothing is dropped, so `board.png` or a name with no width still
shows.

## The commit line

Under `## Evidence`, the Base and Head line names each commit as a short sha
that links to the full commit:

```markdown
**Base:** [`<base>`](https://github.com/<repo>/commit/<base-sha>) · **Head:** [`<head>`](https://github.com/<repo>/commit/<head-sha>)
```

A reader opens what the screenshots were taken against in one click. The base
is the merge base the compare endpoint returns, not trunk's tip.

## When the blocks open

Every block opens while the comment carries six images or fewer, counting one
per case for the head plus one per case that is not new. Past that every block
closes, so the whole comment is open or closed together.

## What reads the body back

The case count that `would-empty` compares is the number of head images in the
body. It holds for the grouped rows, where one row carries up to two cases, and
for every layout posted before, so a comment rendered under an older shape
still counts. The bold `**Base:**` label and the `<details>` blocks are
unchanged, which keeps the address reader and the review skills working on both
layouts. An older comment keeps its shape until the next run edits it in place.
