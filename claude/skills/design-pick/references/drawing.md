---
title: Board drawing
description: The one convention app-drive and design-pick draw on a Frameboard board by, covering widths, pages and their order, frame layout, names, heights, how a pick is asked, and when a live prototype stands in for the board
---

# Board drawing

Read before the first frame a `design-pick` round or an `app-drive` drive adds. Both skills draw on one board, so the operator reads every page the same way and never restates a rule mid-pick. `board.md` beside this file carries how the board is reached and started.

## Widths

Draw every frame at the widths `widths.md` beside this file resolves, one per device class the surface supports, from the record's `Draw widths:` line or 390, 768, and 1280. A now frame, an arm, and a page set all take the same widths, and only the operator's word drops one.

- Measure every pick for sideways scroll at 320 as `widths.md` states, unless the surface leaves phone out, and draw no 320 frame
- Say in the run's output which widths the frames take and which source gave them

## Pages

A page is what the operator opens, so its name and its place in the order say what it holds.

| Run               | Pages                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| A standalone pick | `00-next` once a pick settles, then `<slug>` per question, with `<slug>-2` and on                              |
| A drive           | `00-current`, one `<nn>-<section>` page per topic and `<nn>-<section>-2` past the height limit, then `00-next` |
| A track's pick    | The question's `q<n>-<topic>` page, then `q<n>-<topic>-2` and on                                               |

Every page stays on the board after the run closes, so a losing round is still there to reopen. A pick on a drive finding joins that drive's topic page, and one on an intake item joins the item's `<n>-<topic>` page, as `from-finding.md` beside this file states.

A drive numbers and orders its pages by the findings they serve.

- `<nn>` in a drive's page name is the number of the first finding the page serves, such as `01-craft`
- A second finding on a section adds a row to its page rather than a page of its own
- Run `frameboard page move <page> --index <n>` after each `page add`, so `00-current` and `00-next` lead and the topic pages follow by number

`00-current` belongs to a drive's project alone, since a standalone pick has no shipped page to hold.

### The empty page a project starts with

`frameboard project add` makes a project holding one empty page, and it lists first. A project that opens on an empty page reads to the operator as a drive drawing somewhere else.

- Delete that page once the run's first page holds a frame, while it still holds none
- Never delete a page holding a frame, whatever its name

## A drive's whole page

A drive draws the shipped surface whole on `00-current` before the first finding it draws, so every fix is judged against the page it changes. It draws `00-next` beside it once the operator's picks settle, with every pick applied. Both pages' frames take no device and are fitted, so each section shows at its full length.

- Draw one frame per section at each width, never the whole page in one frame. A page frame 12,000px tall is one nobody reads.
- Give each section one row in page order, desktop first, then tablet, then phone
- Put the site header in the first section's frames and the footer in the last's
- Leave `00-current` as the shipped page for the whole drive, and apply each pick to `00-next` alone
- Log the page's measured height at 1280 on both pages under the finding that asked for a shorter page, when one did

Copy both pages' captures into the drive's `evidence/baseline/` as its whole-page comparison.

## A standalone pick's next page

A standalone pick draws `00-next` once its pick settles, so the operator opens one page and sees what won. The page gains a row per question and is never redrawn whole.

- Copy the winning arm's frames there at each width, named `<slug>-next-<px>` after the question's slug, with no arm label drawn inside
- Give each frame no device and fit it, as a drive's whole page does
- Put a question picked again in its old row, replacing the frames there
- Run `frameboard page move 00-next --index 0` after adding the page, so it leads the project

## Layout

Down is page order and across is what is compared. Each design on a page is one group, being a pick round's arm, a drive's current set or option, or a reference site, and the groups sit side by side, left to right.

Place every frame with `--width <px>`, `--x`, `--y`, and `--device on` on its add, the width being its column's and the device being the phone, tablet, or laptop that width names. A frame added without them hugs its content and lands past the rest. Add `--scroll` beside `--device on`, and skip both without a device, per `## Heights`.

### Inside a group

A group runs its widths as columns and its sections as rows, so one row reads as one section at every width.

- Put desktop at the group's x, tablet one desktop to tablet gap past the desktop's right edge, and phone 80px past the tablet's, so at the fallback widths at the group's x plus 0, 1440, and 2288
- Stack the sections down in page order, one row per section, each row starting 80px below the lowest bottom edge in the row above
- Put a shot in its own section's row whatever its width, so a section split into more phone shots than desktop ones holds the extra shots in that row
- Stack a row's extra shots at one width 80px apart, so the row ends at the bottom of its last stacked shot
- Start the next group 400px past the right edge of the group's last column

The desktop to tablet gap is the laptop body's reach, `20 + round((width + 40) * 0.06)` past the desktop frame, plus 44px for the tablet body, and never under 160px. That is 143px at 1280, which the floor raises to 160, and 182px at 1920. The phone gap stays 80px, since tablet to phone needs 64px.

A page set on `00-current` or `00-next` is one group at x 0, in a drive and a standalone pick alike.

### A row that outgrows the page

A composite capture accepts 16,384px on both axes, so a row of groups wraps before it can pass that across, and a page continues before it can pass it down.

- Wrap the row once the next group's right edge would pass 16,000px, measured from the page's draw widths, so a project drawing wider than the fallbacks wraps sooner than a fixed count would
- Start the wrapped row 400px below the lowest bottom edge of the row above, at the x the row above started, so on a topic page at the first arm's x and not the current set's, in the round's arm order
- Continue a lone round that wraps past 16,000px tall on `<page>-2` at a row boundary, per `### A drive's topic page`
- Stop at 16,000px rather than 16,384px, since a device body draws past its frame and the margin absorbs it without a per-device sum

### A pick round

A round draws each arm as one group, in arm order from the left, so the operator reads across for the comparison and down for the page.

- Start every arm's group at the same y, so a section reads across all the arms on one line
- Give a later round its own page, as `## Pages` states, rather than a row on this one

### A drive's topic page

A topic page opens with the section as shipped and puts each round of options to its right. An intake item's page takes the same layout, whether the pass or a later pick draws on it.

- Put the section's current set as the leftmost group
- Put each arm of a round in a group of its own to the right of the current set, in arm order
- Start each later round 80px below the lowest bottom edge of the round before it, its first arm at the x the first round's first arm took
- Keep the current group where it is while the rounds stack down beside it
- Start the next round on `<page>-2` when it would push the page past 16,000px tall, opening that page on the current set again at the left, so its capture stands alone beside the options it shows

## Names

A frame's name carries its width in pixels, so a reader finds the phone frame by name on the board and in a capture alike.

| Frame                     | Name                     |
| ------------------------- | ------------------------ |
| A pick round's arm        | `arm-<id>-<px>`          |
| A pick's winner           | `<slug>-next-<px>`       |
| A drive's shipped section | `<section>-current-<px>` |
| A drive's section, picked | `<section>-next-<px>`    |
| A drive's option          | `<section>-<arm>-<px>`   |
| An intake item's option   | `<topic>-<arm>-<px>`     |

The parts of a drive's names come from the drive itself.

- `<section>` is the kebab name of the page section, the same one the drive's `evidence/<section>/` and `evidence/mocks/<section>/` take
- `<arm>` is a short kebab name for what the option does, such as `pill-row`, unique on its page across every round
- Write the label drawn inside a frame from the frame's name when the frame is written, and rewrite it in the same step as any `frame rename`, since the label is content the rename leaves alone

`design-pick` reads its selection on `arm-<id>-<px>`, so a pick round keeps that form on every page but a joined one, where it takes the option's name above.

## Heights

A frame's height follows whether the board draws a device around it.

- A frame drawn in a device holds that device's screen height and scrolls, taking `--scroll` on its add. Never fit it, since a fit stretches the device body to the content's full length.
- A frame with no device, such as a component or a drive's whole page, is fitted with `frameboard frame fit <frame>` after it is written
- Where a scroll-driven or pinned section defeats the fit, measure its `scrollHeight` at that width and set it with `frameboard frame resize`
- Look at the capture for a frame cut at the bottom before handing anything over, since a cut frame reads as a broken design

A composite capture draws a scrolling frame at its first screen. An arm whose difference sits below the fold reads identical in the stills, so capture it at a scrolled position or judge it on the live board.

## Asking

Ask one finding or one round per question, never several picks batched into one prompt. A question naming frames on three pages sends the operator hunting.

1. Run `frameboard show <page>/<frame>...` on the frames under decision, every width of each, so the open board marks them.
2. Put the page address `show` returned in the turn's text and again in the question, with the frames it marks.
3. Name in each option the frame it stands for, such as `craft-pill-row-1280`.

`show` returns the page's address, and no Frameboard verb returns one opening on the marked frames alone. Name the page and the frames until Frameboard ships that address, then put it in the question instead.

A launch naming no judge asks every round this way, so a pick or a drive launched without one runs as it always has.

### With a judge named

A launch naming a judge by sessionId sends each round to that judge before the operator sees it, per `${CLAUDE_SKILL_DIR}/../role-judge/SKILL.md`. Send the finding the round settles, its frames by name, and the options capture's path, through `canon:session-relay`.

| Judge's reply | Route                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| A correction  | Redraw the round as it names, then send it to the judge again, asking the operator nothing    |
| `close call`  | Ask the operator as the steps above state, naming the judge's pick and reason in the question |
| `clear`       | Hold the pick for the batch review and draw the next round                                    |

Send the judge each decision the operator makes, so its next verdict reads it as precedent.

- Write no `Decision (operator)` line and apply no pick for a held round, since a pick the operator has not reviewed lands as nothing
- Hold a round when the judge goes silent or its session ends, and ask the operator it as the steps above state

### The batch review

End the run on one review of every held pick, ahead of the close.

1. Run `frameboard show` on each held round's picked frames, and list each round with the judge's pick and reason.
2. Ask the operator to accept the list or name the rounds they overrule, through the structured question surface.
3. Write each round's `Decision (operator)` line as the operator's word, being the judge's arm where they accepted it and their own arm where they overruled it.
4. Fill the `Operator` column of the judge's verdict table with `agreed` or the arm they took instead.

## The live prototype

A board frame is one section fitted to its content, so it cannot show how an element behaves across the page. Decide a finding about behavior across sections on a served prototype of the whole page instead.

A picked app or product surface takes the board prototype `prototype.md` beside this file states, being one page of device frames with a checked flow list. The bullets below cover a drive's served copy alone.

- Behavior across sections covers scroll, a sticky or pinned element, a fixed header, and a theme switch
- Serve the prototype from the drive's copy, apply each decision to it as it lands, and hand the operator its address beside the board's
- Copy its source into `evidence/mocks/<section>/` like any mock, since the copy is gone once the drive closes
- Keep composition on the board, where the options sit side by side
