---
title: Design config
description: The canon/config/design.toml keys board and project, their defaults, and how a design-pick run resolves the board it drafts on
---

# Design config

Read before the first `frameboard` verb a `design-pick` run sends. A project names the Frameboard board its design sync reads in `canon/config/design.toml` at the main worktree root, and the run reads that file and never writes it.

```toml
board = ".canon/board"
project = "picks"
```

## Keys

| Key       | Holds                                                   | Default          |
| --------- | ------------------------------------------------------- | ---------------- |
| `board`   | The board folder a round drafts on, under the main root | `.canon/canvas/` |
| `project` | The Frameboard project a round's pages go in            | `picks`          |

Each key falls back on its own, so a file naming `board` alone moves the board and keeps the project at `picks`.

- Resolve `board` against the main worktree root even when the run sits in a linked worktree, since the board folder is gitignored and a linked worktree holds no copy of it
- Leave `project` at `picks` on a named board unless the operator wants otherwise, so rounds sit on the board the sync reads and stay apart from the accepted frames
- Stop on a file that does not parse or a key that is not a string, naming the file's path. Falling back there would draft the round where the sync never looks.
- The archive lands at `.canon/<project>/<page>/`, so it follows `project`. Stop on a `project` naming a `.canon/` folder another record owns, such as `plans` or `tasks`.

## When the file is absent

The run drafts on `.canon/canvas/` in `picks`, the board every project used before the file existed, and asks nothing.

Set the file when the project's design sync reads a board other than `.canon/canvas/`. A round drafted there lands through `design-record` without a redraw, and Step 6 of the skill body keeps the winning page for the sync's mapping.
