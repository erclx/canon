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
- A `design-pick` round on one of the pass's items draws in the pass's project too, on that item's page, per `from-finding.md` beside `board.md`

## Where it draws

A pass draws on the board when `.canon/board/` exists at the main root. Without it, it starts no board and says on the item that none exists, since a standalone mock is outside the folder and the write scope.

Reach and start the board per `board.md`, and pass `--root <board>` on every `frameboard` verb, since a verb sent with no root creates a `.frameboard/` folder wherever the session stands. The drawing skill's own start step names no root, so this file's rule decides.

- `<project>` is `drive-<nn>`, the default `${CLAUDE_SKILL_DIR}/../app-drive/references/config.md` gives with the intake's ordinal
- Never take the name a standalone pick derives, so a pass's pages stay apart from standalone picks and accepted frames
- Read `frameboard list --root <board> --json` with no `--project`, run `project add` when the list lacks the project, and name it in the overview before the first frame
- File it under the `board-folder` key of the `[drive]` table, `Drives` when absent, per `## Home folders` in `board.md`, so a drive and a pass land in one place
- Note `reused` off the serve record

### A project another intake left

A deleted folder frees its ordinal while its kept project stays on the board, so a later intake can claim the same `<nn>` and find `drive-<nn>` already there. The overview names the project the pass drew in, and that line decides whose it is.

- Treat a found `drive-<nn>` the overview does not name as foreign, and never write into it
- Take `drive-<nn>-<slug>` instead, run `project add` for it, and name it in the overview before the first frame

A refusal that ends the board ends the drawing on it rather than the pass. Report it on the item.

## Pages

Read `drawing.md` beside `board.md` before the first frame, for the widths, layout, frame names, and heights. It states pages for a pick and a drive only, so this file fixes the intake's.

- Draw one page per item, named `<n>-<topic>` after the item's number and a short topic, and delete the empty page `project add` leaves once the first page holds a frame
- Name an option frame as a drive's option, `<topic>-<arm>-<px>`
- Never draw `00-current` or `00-next` in the pass itself. A later `design-pick` round on an item adds both, per `from-finding.md`.

## The server after the pass

Leave a server this pass started running, since the operator settles an item by looking after the pass has ended and `plan-intake-answer` reads no board. Put the board's `url` in the pass output beside each item drawn for, so the operator reaches the live frames. An ended server is the operator's to restart.

## The write scope on the board

The pass writes into its own project alone. It never writes a frame into a standalone pick's project, the `project` key's project, or a page holding an accepted design, and a decision reaches those through `design-pick` or `design-record` once it ships.

## Copying into the folder

The operator can edit or delete frames after the pass, so an item citing the board alone loses its evidence then.

1. Capture the page with `frameboard capture --page <page> --composite --out <scratch>`, and copy the image to `evidence/<surface>/<nn>-<topic>.png`, per `### The evidence folder` in `intake.md`.
2. Cite that copy from the item, never a board address alone.
