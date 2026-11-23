---
title: Intake board
description: When an intake pass draws to settle an item, the board project it keeps, how it reaches the board, and the copy it keeps in the folder so the item outlives the board
---

# Intake board

Read before the first frame an intake pass draws. Most passes measure and never draw, so a pass with no item settled by looking never opens this file. The `board.md` and `drawing.md` it names sit in `${CLAUDE_SKILL_DIR}/../design-pick/references/`, and this file restates none of their rules.

## When a pass draws

Draw only when an item's fix is a choice the operator settles by looking, such as a choice between visible options. A measurement never draws, since a frame of a number settles nothing a table does not.

- The pass needs no ask from the operator to draw, and says in its output which items it drew for
- Write the item's problem and its suggested pick first, then draw the options the suggestion weighs
- A `design-pick` round follows that skill's own branch. This file covers the pass's own project alone.

## Where it draws

A pass draws on the board when `canon/config/design.toml` exists or `.canon/board/` exists at the main root. With neither, it starts no board and says on the item that none exists, since a standalone mock is outside the folder and the write scope.

Reach and start the board per `board.md`, and pass `--root <board>` on every `frameboard` verb, since a verb sent with no root creates a `.frameboard/` folder wherever the session stands. The drawing skill's own start step names no root, so this file's rule decides.

- `<project>` is `drive-<nn>`, the default `${CLAUDE_SKILL_DIR}/../app-drive/references/config.md` gives with the intake's ordinal
- Never take the `project` key of `design.toml`, so a pass's pages stay apart from pick rounds and accepted frames
- Read `frameboard list --root <board> --json` with no `--project`, run `project add` when the list lacks the project, and name it in the overview before the first frame
- File it under the `Drives` home folder once it exists, per `## Home folders` in `board.md`
- Note `reused` off the serve record, since the pass ends only a server it started

A refusal that ends the board ends the drawing on it rather than the pass. Report it on the item.

## The write scope on the board

The pass writes into its own project alone. It never writes a frame into a pick round's project, the `project` key's project, or a page holding an accepted design, and a decision reaches those through `design-pick` or `design-record` once it ships.

## Copying into the folder

The operator can edit or delete frames after the pass, so an item citing the board alone loses its evidence then.

1. Capture the page with `frameboard capture --page <page> --composite --out <scratch>`, and copy the image to `evidence/<surface>/<nn>-<topic>.png`, per `### The evidence folder` in `intake.md`.
2. Cite that copy from the item, never a board address alone.
