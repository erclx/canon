---
title: Table limits
description: The four limits a markdown table takes, being cell length, row count, a list after a table, and a wide code token, with the fix each one takes
---

# Table limits

None of the density limits in `markdown.md` reads inside a table, so content too long for a bullet tends to move into a cell. Four table limits close that gap. `canon markdown audit` measures them on the paths density covers, outside fences, and reports each one without failing a push for now.

## Limits

Each limit is a count or a shape a scan settles, read the way a renderer draws the table. An escaped pipe stays inside its cell, and pipe lines with no delimiter row are not a table.

| Rule             | Limit                                                 |
| ---------------- | ----------------------------------------------------- |
| Cell length      | 120 visible characters, counting a link by its label  |
| Rows             | 8 body rows, not counting the header                  |
| List after table | A list is never the next block after a table          |
| Wide token       | No code span in a cell holds a run past 30 characters |

A paragraph or a heading between a table and a list clears the third limit, and a blank line alone does not.

## Fixes

Each limit has its own fix, and none of them is trimming characters until the count passes.

- Move a long cell's overflow into a bullet under the table's lead sentence, or under a lead of its own
- Split a long table into groups, each under a lead sentence naming its group, since a heading inside a table splits it and H4 is banned
- Give a list that follows a table a lead sentence of its own
- Move a wide token out of the table into a bullet, since a preview either widens its column or splits it at a hyphen or a slash
