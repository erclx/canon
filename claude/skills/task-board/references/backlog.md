---
title: Backlog reference
description: When a task sits on the unordered backlog.md rather than the board, why the two surfaces split, and the backlog's shape
---

# Backlog reference

Applies to `.canon/tasks/backlog.md`, the unordered list beside `priority.md`. The board's groups, cells, and ordering are in `board.md` beside this file.

A task sits on the board when it would plausibly be planned within the next few waves, and on `backlog.md` otherwise. Restate that judgment whenever the board is swept, since a backlogged task rises when the work in front of it lands and a board row falls when it stops being near-term.

## Why a split

A test over age or origin was the alternative, and neither predicts what gets picked next. Leaving everything on the board produces a group too long to rank.

- The split keeps the board short enough for its order to be read, at the cost of a second surface
- The trade pays only while the backlog carries no order, no groups, and no readiness claim

## Shape

Nothing is deleted. A backlogged task keeps its file, findings, and frontmatter, and the row points at that file. The folder has no history, so a row dropped without landing somewhere readable is gone.

The backlog is a flat list of links under one heading, sorted by filename. The order matches the index, so no position on it reads as a queue.

```markdown
---
title: Backlog
description: One line on what the backlog holds
---

# Backlog

Unordered. Nothing here is scheduled, and a task rises to `priority.md` when it becomes near-term.

- [vXX.Y <slug>](vXX.Y-<slug>.md)
- [vXX.Y <slug>](vXX.Y-<slug>.md)
```

Add no fourth readiness group in place of this file. A backlog makes no readiness claim, only that nobody has scheduled the task, a fact about attention rather than whether the work can start.
