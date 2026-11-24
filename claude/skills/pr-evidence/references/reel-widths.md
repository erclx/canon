---
title: Reel widths
description: How the reel step films one reel per capture width its checklist names, with up to three beats each, a coverage line per reel, and a skip per width the lift settles on its own
---

# Reel widths

Read by `reel.md` once the beats are filtered, before they are ordered. One reel holds one width, since `canon take` refuses two shapes as `reel-shape`, so a checklist naming two widths gets two reels and the evidence comment embeds each at the width it was filmed at.

## Pick the widths

A box films at the width its `<route>, <width>:` opening names, even one outside the set such as 834. One naming none films at 1280, or at 768 or 390 for the widest class a record without desktop supports. Group the filmable boxes by that width, and film one reel per group.

- Drop a width whose device class the `Device classes:` line in `canon/DESIGN.md` leaves out, since `canon pr lift` owes no reel there, and report the box that named it
- Film the widths narrowest first, so the comment reads them in that order
- Pass `--viewport` at 390x844, 768x1024, 1280x800, or 900 tall otherwise, and `--reel-width <width>` under 960

## Beats per width

Run `### Order the beats` in `reel.md` over each width's boxes on their own. Each reel takes up to three beats, so a width never drops out because another width spent the cap.

- Keep each reel at or under 15 seconds, since the take enforces the cap per reel
- Write each width's plan, takes, stills, and reel under `.canon/tmp/pr/reel/<number>/<width>/`, so a refilm of one width leaves the others alone
- Check every reel's stills and timing before pushing any of them

## Coverage per width

Hold the filmed and left-out lists of `### Hold the coverage` once per reel, over the groups holding a box at that width. A group whose boxes all sit at another width belongs to that width's reel and is never left out of this one.

Pass one `--reel-covers` per `--reel`, since `canon pr evidence` reads the Nth covers as describing the Nth reel and refuses `reel-covers-unpaired` when the counts differ.

## Skips per width

The lift owes a reel at every width a drivable box names, filmable or not, so a width that films nothing still owes a reason.

- A width whose boxes the filter emptied skips at that width alone, as `--reel-skip '<width>=no-visible-change'`, or `<width>=no-interactive-box` when none of its boxes is interactive
- A refusal while filming one width skips that width alone, as `<width>=<reason>: <message>`, and every other width still films and posts
- A skip that stops every width, such as `deferred` or `no-server`, goes bare, since the bare line names every width
- A width skip line governs its width over the bare one, and a reel filmed at that width at the head drops it

`canon pr lift` settles each width on its own reel, carry, skip, or waiver, and names the widths still owed as `reelWidths` on `reel-unsettled`.
