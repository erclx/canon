---
title: Design run record
description: How a launch naming a finished design-pick run opens a track that closes in one pass, what the exemption keys on, and what each file carries
---

# Design run record

Applies to open mode of `plan-groundwork` when a launch names a finished `design-pick` run. Read it before the qualifying test runs.

## Scope

Governs the record of a run whose picks are already settled. A topic with no such run takes the qualifying test as written.

## The exemption

A settled run fails the qualifying test by construction, since every question is answered. The track exists to keep which arm won and what it beat, so the test is skipped for a launch that names the picked board page of the run, as a `<project>/<page>` ref. `design-pick` keeps that page after its close, beside every losing round.

The page proves nothing for a topic that was never drawn, so an ordinary settled topic still stops on the test.

## One pass

Open mode writes `README.md`, `01-current-state.md`, and `06-decision.md` in one pass, with no resume between them. It then runs close Steps 2 to 7 in the same session, so the file map, the route that records or hands off the conclusion, and the plan or its named handoff all follow.

- `01-current-state.md` measures the kept pages: the frames they hold, the widths drawn, and the arms each pick beat
- `06-decision.md` states each pick with the arms it beat, the measurements behind the pick, and the operator's reason when they gave one
- Capture each page the record cites into `evidence/`, and cite it there, since the operator can delete a board page

## Under `role-planner`

A pick never lands through `design-record` under `role-planner`. The board keeps the frames, and the track keeps what the board cannot, which arm beat which and why. The track writes nothing under `canon/design/`.
