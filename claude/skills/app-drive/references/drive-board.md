---
title: Drive board
description: How app-drive draws on its own board project, from the start at the first visible finding through the page order, the caption on each row, the frame lift with every earlier pick applied, the capture, and the refusals that end the board
---

# Drive board

Read when `app-drive` reaches the first finding with something visible, decided or not, before any frame on the board. The drive's project stays apart from standalone picks, so this file covers the drive's own pages alone. The `drawing.md` and `board.md` it names sit in `${CLAUDE_SKILL_DIR}/../design-pick/references/`.

## Starting the board

A drive will draw on the board when the config names `board-project` or `.canon/board/` exists at the main root. With neither, the drive starts no server and draws as Step 3's cases state.

Read `board.md` for reaching and starting the board, and `drawing.md` before the first frame. A drive differs from a `design-pick` run in four ways.

- `<project>` is the config's `board-project` with `<nn>` filled in, never the project name a pick derives, so a drive's pages stay apart from standalone picks and accepted frames
- Where `frameboard list` holds a versioned project of the stem, such as `landing-v2`, ask whether the drive continues it as `landing-v3`, and never write into the earlier one
- Test the root with `git check-ignore -q <board>/` before serving, slash kept for a folder not made yet. The write scope forbids an unignored root, and `drive-check` reports its frames under `changed`.
- That test, a stop either reference names, or no `frameboard` and no `bunx` on PATH ends the board rather than the drive. Report why, leave the row empty, and draw as a project with no board does.

Note `reused` off the serve record, since the close ends only a server this run started. Delete an `untitled` project `serve` left only while it holds one empty page. File the drive's project under the config's `board-folder` once it exists, made or found, per `## Home folders` in `board.md`.

### Before the first frame

Do these once, while the copy still runs, since a copy the close removed has no shipped page to lift.

1. Write the board's address and project as the drive log's `Board` row.
2. Hand the operator the board's address.
3. Draw the shipped page whole on `00-current`, as `drawing.md` states.

On a finding raised after the close, with the copy gone, add that finding's section alone to `00-current`, as `from-finding.md` beside `drawing.md` states.

## Drawing on the board

The drive's project holds `00-current`, a page per topic, and `00-next`, as `drawing.md` states. A topic's section is the drive's `<surface>`, the name `evidence/<surface>/` takes. Read `frameboard list --root <board> --json` with no `--project`, which refuses before the project exists, and run `project add` when it lacks it.

- Add each page and frame by the name, place, and height `drawing.md` gives, each row's caption first, and take theming and font from `design-pick`'s Step 2
- Lift the copy's rendered markup per `${CLAUDE_SKILL_DIR}/../design-pick/references/live-arms.md`, since the board cannot reach a stylesheet inside the copy
- Capture with `frameboard capture --page <page> --composite --theme <theme> --out <scratch>`, in the theme the board is judged in, and copy that image to `evidence/<surface>/<nn>-options.png`
  - Capture each continuation page the same way into `evidence/<surface>/<nn>-options-<k>.png`, where `<k>` is the page's own suffix, so `<page>-2` takes `<nn>-options-2.png`
- Hide an earlier finding's frames with `frameboard frame hide` for that capture, and clear them with `--off`
- Draw `00-next` once the operator's picks settle, and copy both whole-page captures into `evidence/baseline/` as `00-current` and `00-next`, where a `-` or `.` suffix such as `-1440.light` is read

### Each pick reaches the copy before the next lift

A frame lifted after a pick lands shows the page the operator is building toward. Lifted from the shipped build instead, a later topic's frames would undo every pick made before them.

- Apply each landed pick to the copy's markup or stylesheet, and rebuild it with the `Launch` row's command, before lifting the next finding's frames
- Lift a later topic's current set from that copy, so it shows every earlier pick
- Leave every frame already drawn as it stands, an earlier topic's current set and `00-current` included, since each was drawn against the page the operator saw then
- Say in a later finding's `Saw` when it was met on a part an earlier pick changed, since the shipped build does not carry that part
- Apply nothing for an undecided finding, since no option has been picked

### Addresses and refusals

Give the operator each page's address in the turn the page is added, read off `frameboard show` as `drawing.md` states. The operator then opens a page while it holds only what was just drawn, rather than asking for the link.

Repair a `font-missing` capture as `design-pick`'s Step 3 does, and answer a refusal `board.md` reads as it states. Any other refusal ends the board as the start does, so redraw in the copy and take the options shot there. On `browser-not-found`, name `bunx playwright install chromium` as the repair.
