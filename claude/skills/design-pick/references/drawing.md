---
title: Board drawing
description: The one convention app-drive and design-pick draw on a Frameboard board by, covering widths, pages and their order, frame layout, names, heights, how a pick is asked, and when a live prototype stands in for the board
---

# Board drawing

Read before the first frame a `design-pick` round or an `app-drive` drive adds. Both skills draw on one board, so the operator reads every page the same way and never restates a rule mid-pick. `board.md` beside this file carries how the board is reached and started.

## Widths

Draw every frame at the three widths `widths.md` beside this file resolves, being the record's `Draw widths:` line or 390, 834, and 1440. A now frame, an arm, and a page set all take the three, and only the operator's word drops one.

- Measure every pick for sideways scroll at 320 as `widths.md` states, and draw no 320 frame
- Say in the run's output which widths the frames take and which source gave them

## Pages

A page is what the operator opens, so its name and its place in the order say what it holds.

| Run          | Pages                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------- |
| A pick round | `<slug>` for the first round, then `<slug>-2`, `<slug>-3`, and on, in the run's project  |
| A drive      | `00-current`, then one `<nn>-<section>` page per topic, then `00-next` once picks settle |

A drive numbers and orders its pages by the findings they serve.

- `<nn>` in a drive's page name is the number of the first finding the page serves, such as `01-craft`
- A second finding on a section adds a row to its page rather than a page of its own
- Run `frameboard page move <page> --index <n>` after each `page add`, so `00-current` and `00-next` lead and the topic pages follow by number

`00-current` and `00-next` belong to a drive alone. A pick round decides one section and keeps its own page per round, so it draws neither.

### The empty page a project starts with

`frameboard project add` makes a project holding one empty page, and it lists first. A project that opens on an empty page reads to the operator as a drive drawing somewhere else.

- Delete that page once the run's first page holds a frame, while it still holds none
- Never delete a page holding a frame, whatever its name

## A drive's whole page

A drive draws the shipped surface whole on `00-current` before its first finding, so every fix is judged against the page it changes. It draws `00-next` beside it once the operator's picks settle, with every pick applied.

- Draw one frame per section at each width, never the whole page in one frame. A page frame 12,000px tall is one nobody reads.
- Give each section one row in page order, desktop first, then tablet, then phone
- Put the site header in the first section's frames and the footer in the last's
- Leave `00-current` as the shipped page for the whole drive, and apply each pick to `00-next` alone
- Log the page's measured height at 1440 on both pages under the finding that asked for a shorter page, when one did

Copy both pages' capture into the drive's evidence as its whole-page comparison, per `drive-record.md` in `app-drive`.

## Layout

Place every frame with `--x` and `--y` on its add, since `frame add` alone places a frame past every other one in the order it ran. Leave 80px between columns and 80px below the tallest frame of the row above, so a tall phone frame never overlaps the next row.

### A pick round

A round draws each arm once per width, as a grid the operator scans both ways.

- Give each arm one row in arm order, and each width one column in ascending order
- Start each column 80px past the right edge of the column before it

### A drive's topic page

A topic page opens with the section as shipped and puts each round of options to its right.

- Put the section's current set in the column at the far left, desktop at the top and tablet and phone under it
- Put each arm in a column of its own, its desktop at the top of the round and its tablet and phone under that desktop
- Draw each later round below the tallest frame of the round before it, keeping the current column where it is

A page set on `00-current` or `00-next` places desktop at x 0, tablet 80px past the desktop's right edge, and phone 80px past the tablet's, so at the fallback widths at 0, 1520, and 2434.

## Names

A frame's name carries its width in pixels, so a reader finds the phone frame by name on the board and in an archive alike.

| Frame                     | Name                     |
| ------------------------- | ------------------------ |
| A pick round's arm        | `arm-<id>-<px>`          |
| A drive's shipped section | `<section>-current-<px>` |
| A drive's section, picked | `<section>-next-<px>`    |
| A drive's option          | `<section>-<arm>-<px>`   |

The parts of a drive's names come from the drive itself.

- `<section>` is the kebab name of the page section, the same one the drive's `evidence/<section>/` and `evidence/mocks/<section>/` take
- `<arm>` is a short kebab name for what the option does, such as `pill-row`, unique on its page across every round
- Write the label drawn inside a frame from the frame's name when the frame is written, and rewrite it in the same step as any `frame rename`, since the label is content the rename leaves alone

`design-pick` reads its selection and keys its archive on `arm-<id>-<px>`, so a pick round keeps that form.

## Heights

A frame's height is its content's, measured at its own width.

- Run `frameboard frame fit <frame>` after writing each frame
- Where a scroll-driven or pinned section defeats the fit, measure the section's `scrollHeight` at that width and set it with `frameboard frame resize`
- Look at the capture for a frame cut at the bottom before handing anything over, since a cut frame reads as a broken design

## Asking

Ask one finding or one round per question, never several picks batched into one prompt. A question naming frames on three pages sends the operator hunting.

1. Run `frameboard show <page>/<frame>...` on the frames under decision, every width of each, so the open board marks them.
2. Put the page address `show` returned in the turn's text and again in the question, with the frames it marks.
3. Name in each option the frame it stands for, such as `craft-pill-row-1440`.

`show` returns the page's address, and no Frameboard verb returns one opening on the marked frames alone. Name the page and the frames until Frameboard ships that address, then put it in the question instead.

## The live prototype

A board frame is one section fitted to its content, so it cannot show how an element behaves across the page. Decide a finding about behavior across sections on a served prototype of the whole page instead.

- Behavior across sections covers scroll, a sticky or pinned element, a fixed header, and a theme switch
- Serve the prototype from the drive's copy, apply each decision to it as it lands, and hand the operator its address beside the board's
- Copy its source into `evidence/mocks/<section>/` like any mock, since the copy is gone once the drive closes
- Keep composition on the board, where the options sit side by side
