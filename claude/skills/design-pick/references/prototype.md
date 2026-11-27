---
title: Clickable prototype
description: The one prototype a picked app surface gets after its pick, covering where it lives on the board, the confirmed flow list it covers, its invented data, how it behaves, the scripted click-through that checks it, and the drift scan that keeps the static frames from silently disagreeing with it
---

# Clickable prototype

Read before building a prototype off a picked app or product surface. An operator understands an app design fastest by clicking it, and a prototype built by hand grows by request, while the static frames go on showing flows the prototype has dropped.

The prototype answers behavior and copy, and the static frames answer the states it cannot show, such as an error page or an empty account. Once both exist, a change request lands on the prototype first, and the frames it contradicts are listed before handover, per `## Drift` below.

## Place

The prototype is one board page named `prototype` in the run's project, recorded on the run's list. A `name-taken` refusal takes the next free suffix, as Step 2 of `SKILL.md` states for a round page.

- Write one responsive HTML document, never one per width, so a fix lands once and every class shows it
- Add one frame per device class as `frameboard frame add <page>/prototype-<px> --width <px> --device on --scroll`, at the widths `widths.md` resolves, laid out as `drawing.md` lays a group
- Write the same document to each frame's `path`. Never use a `--widths` linked width, which draws no device body.
- Inline every style, script, and asset, as the default path in `SKILL.md` states for any frame

A frame holds its device's screen height under the one rule in `drawing.md` beside this file, so the prototype scrolls inside its frame the way the app scrolls inside a screen. Fit nothing.

## Scope

Confirm the flow list with the operator before writing the document, through the structured question surface as one multi-select. A prototype with no agreed list grows one request at a time and gets rebuilt each time.

- Default to five flows: navigation between the main screens, create, edit, delete with undo, and the surface's primary feature
- Name the primary feature from the pick's own screens, such as compose for a mail client, and say which screen it starts on
- Build only the confirmed flows. A control outside them renders, does nothing, and says so on screen in a short line such as `Not in this prototype`.
- Show on a fixed corner note which flows the prototype covers, so the operator never mistakes a dead control for a bug

A request arriving after the build that adds a flow goes back through the same question, so the list on screen stays the list built.

## Data

Every record is invented, and none comes from a real product, account, or person, per `design-gather`. Write enough rows to fill each screen at desktop, plus one long value per list to show truncation.

- Fix the prototype's now to one date and time, and show it on screen beside the flow note, so a relative date such as `2 days ago` reads the same on every open
- Hold state in memory alone, so a reload resets every flow to its starting rows. Write nothing to `localStorage`, which survives the reload and hides a broken reset.
- Make the starting rows reproduce the screens the pick drew, so the operator meets the picked design on first open

## Behavior

The prototype carries the picked shell's breakpoints, so each device frame shows the layout that class ships with, and the phone frame's navigation is the phone pattern the pick drew.

- Gate every transition on `prefers-reduced-motion`, per `ui-craft`, and keep the change of state when the motion is off
- Make every toast dismissible by a visible control and by `Escape`, and keep an undo toast up until it is dismissed or acted on
- Give delete its undo through the toast, restoring the row at its old position
- Theme off the `data-theme` attribute the board sets, as `SKILL.md` states for every frame, and store no theme

## Check

Script a click-through of every confirmed flow in each device frame before handing the prototype over, and hand over nothing that has not passed. Open each frame at the board's served address, as `## Holding a pick that scrolls sideways` in `widths.md` states, and check the address names the frame before trusting a read.

- Drive each flow with `canon browser -s=<run> click`, then assert its end state with `--raw eval`, such as the row count after a delete and again after its undo
- Read `canon browser -s=<run> console` after the last flow in each frame, and count any error as a failed check
- Run `canon browser -s=<run> reload` and assert the starting rows are back, which proves the reset `## Data` requires
- Measure sideways scroll in each frame as `widths.md` states, the phone frame again at 320

Then list every native `select` and picker `input` in each frame, such as a date, time, or color field. The browser draws its open state, so the prototype's styling stops at the closed field.

- Hold the handover until each listed control has a frame drawing its open state or a styled replacement
- Accept a native control the design keeps on purpose with its open-state frame, and never demand a replacement
- Say `no native pickers` when the list is empty, which passes the step

Report each flow, each frame, and pass or fail in the run's output. A failed flow is fixed and the whole check runs again, since a fix to one flow can break another sharing its state.

## Drift

The prototype is the reference for behavior and copy from the moment it exists, so every later change lands on it first. A static frame left behind then shows a flow nobody builds, and a session planning against the frames inherits it.

Before every handover, the first and each one after an edit, list each static frame of the picked design that carries copy or a control label the prototype no longer renders.

1. Collect the visible text of every screen in the prototype, walking each confirmed flow.
2. Collect the visible text of each static frame of the pick from its HTML file on the board.
3. Report each string a static frame carries and the prototype does not, grouped by frame, such as a removed button or a renamed screen.

The close keeps the picked page, so its static frames stay readable at every later handover. The design record holds images, which a text scan cannot read. Report each frame no board page holds any more as unread by name, never as clean.

Redraw or retire each listed frame through `design-record` before handover, or name it to the operator as stale. A list that comes back empty with no frame unread says only that no text drifted. The scan cannot see a moved control or a changed layout, so a clean scan is a floor and never proof the frames agree.
