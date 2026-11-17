---
title: Groundwork board
description: When a groundwork track draws to settle a question, the board project it keeps, its page layout, how a question is asked, and what it copies into the folder so the decision outlives the board
---

# Groundwork board

Read before the first frame a groundwork track draws. Most tracks measure and never draw, so a track with no judgment question never opens this file. The `board.md` and `drawing.md` it names sit in `${CLAUDE_SKILL_DIR}/../design-pick/references/`, and this file restates none of their rules.

## When a track draws

Draw only when an open question is a judgment the operator settles by looking, such as a choice between visible options. A measurement never draws, since a frame of a number settles nothing a table does not.

- Write the question in its topic file first, with its lean, and draw the options that lean weighs
- A `design-pick` round started inside the track follows that skill's own branch and removes its round on close. This file covers the track's own project alone.

## Where it draws

A track draws on the board when `canon/config/design.toml` exists or `.canon/board/` exists at the main root. With neither, it starts no server and draws standalone HTML mocks under `scripts/mocks/<question>/`, and the README's `## Method` says the track drew without a board.

Reach and start the board per `board.md`, with two differences. `<project>` is `groundwork-<nn>`, the track's own ordinal, never the `project` key of `design.toml`, so a track's pages stay apart from pick rounds and accepted frames.

- Read `frameboard list --root <board> --json` with no `--project`, run `project add` when the list lacks the project, and name it in the README before the first frame
- File the project under the `Groundwork` home folder once it exists, made or found, per `## Home folders` in `board.md`
- Note `reused` off the serve record, since the close ends only a server this track started

A refusal that ends the board ends the drawing on it rather than the track. Report it and draw on as a project with no board does, where `board.md` stops.

### A project another track left

A deleted track frees its ordinal while its kept project stays on the board, so a later track can claim the same `<nn>` and find `groundwork-<nn>` already there. The README names the project the track drew in, and that line decides whose it is.

- Treat a found `groundwork-<nn>` the track's own README does not name as foreign, and never write into it
- Take `groundwork-<nn>-<slug>` instead, run `project add` for it, and name it in the README before the first frame

### The write scope on the board

The track writes into the project its README names alone. It never writes a frame into a pick round's project, the `project` key's project, or a page holding an accepted design, and a decision reaches those through `design-pick` or `design-record` once it ships.

## Pages

A project holds a `concept` page for the track's current lean, then one page per question it draws, named `q<n>-<topic>` after the question's number and its topic file's slug. This is a default rather than a rule.

- A track drawing one question may draw on one page, named for that question
- Take widths, layout, frame names, and heights from `drawing.md`, naming an option frame as a drive's option, `<topic>-<arm>-<px>`
- Delete the empty page `project add` leaves once the first page holds a frame, as `drawing.md` states

## Asking

Ask one question per prompt, as `drawing.md` states under Asking. Name the page and its frames in the turn's text and in each option, and record the operator's answer under the question in its topic file before drawing the next.

## Copying into the folder

The operator can edit or delete frames after the track closes, so a decision citing the board alone loses its evidence then. The folder has to stand alone.

1. Capture the page with `frameboard capture --page <page> --composite --out <scratch>`, and copy the image to `evidence/<topic>/q<n>-options.png`.
2. Copy each drawn frame's source into `scripts/mocks/<question>/`.
3. Cite both paths from the topic file and from `06-decision.md`, never a board address alone.

A capture cited from the board with no copy under `evidence/` makes the track non-conforming, whatever else it holds. Fix it before close, since the copy is the only one a later reader is sure to find.

## Close

Keep the project the README names, `groundwork-<nn>` or its `-<slug>` fallback, since the operator looks back at a track's frames there. End the serve command only when `reused` read false.

- Name the project and its board in the README's file map, beside the `evidence/` and `scripts/` paths that hold the copies
- A `design-pick` round inside the same track is still removed by that skill's close
