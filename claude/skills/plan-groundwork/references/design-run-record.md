---
title: Design run record
description: How a launch naming a finished design-pick run opens a track that closes in one pass, what the exemption keys on, and what each file carries
---

# Design run record

Applies to open mode of `plan-groundwork` when a launch names a finished `design-pick` run. Read it before the qualifying test runs.

## Scope

Governs the record of a run whose picks are already settled. A topic with no such run takes the qualifying test as written.

## The exemption

A settled run fails the qualifying test by construction, since every question is answered. The track exists to keep which arm won and what it beat, so the test is skipped for a launch that names one of these:

- The picked board page of the run, as a `<project>/<page>` ref
- The run's archive path under `.canon/`, where `design-pick` Step 6 keeps the picked round

Neither proves anything for a topic that was never drawn, so an ordinary settled topic still stops on the test.

## One pass

Open mode writes `README.md`, `01-current-state.md`, and `06-decision.md` in one pass, with no resume between them. The track closes in the session that opens it.

- `01-current-state.md` measures the archive: the frames kept, the widths drawn, and the arms each pick beat
- `06-decision.md` states each pick with the arms it beat, the measurements behind the pick, and the operator's reason when they gave one
- Renders and the archive copy sit under `evidence/`, and the file cites them there

## Under `role-planner`

A pick never lands through `design-record` under `role-planner`, so this record is the only trace of the run. The track writes nothing under `canon/design/`.
