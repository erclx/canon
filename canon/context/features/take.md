---
title: Take
description: The canon take verb that films a web app by frame stepping, its click log and camera track, the pull request reel with a drawn pointer, and the begin-frame traps
---

# Take

## Overview

Owns `canon take`, which films each beat of a take plan into a 60 fps clip with a click log and a per-frame camera track, 4K unless a beat shrinks its window. Its boundary is the clip, and HyperFrames composes and renders everything past it. The one exception is the pull request reel, which `--reel` joins from the clips with the pointer drawn on.

The `ui-film` plugin skill drafts the beats and calls the verb for a launch video. `pr-evidence` films the reel under `--max-seconds 15`, which refuses as `over-cap` past it. `src/commands/take.ts` holds only the wiring, including `camera`, which rebuilds a track at a rate, `check`, which fails a beat's timing, and `stills`, which reads a reel.

## Layout

### `src/take/`

Films each beat of a take plan from a fresh load, writing its clip, log, camera track, and `still.jpg`, listed in `take.json`. With `--reel`, `reel.ts` crops each frame to a camera at `REEL_DEPTH` 2, draws the cursor, and joins every third frame into a WebP 960 wide, or the `--reel-width` named, lossy past `REEL_MAX_BYTES`.

- The stepper drives chrome-headless-shell over raw CDP, since Playwright cannot ask for begin-frame control, and shoots frames at device scale 2, or 1 on `deviceScale` or after a recording stall
- A `screencast` beat, or a stall past 2 s no stepped retry clears, films through Playwright at its window, naming the route, and `frame-clock.ts` moves each frame stamp onto the stage clock
- One choreography runs each step on each route's stage and logs every glide point. A glide takes 600 ms to 1.2 s, and a fill rests, steps off its field, and settles before typing.
- The camera zooms onto a press over the glide reaching it, and in the reel onto the box a key moved focus to, at a depth the clip's width over the output's caps, and pans only at a steady scale
- Stepped frames stream into the system FFmpeg, screencast frames spool beside the clip until the stop, and FFmpeg's absence refuses before any browser launches

### `src/take/check.ts`

`check.ts` holds the timing rules over a beat's log and track, each limit a frame under the engine's pacing. `stall.ts` runs FFmpeg `freezedetect` over each typing burst and drag of a beat not filmed stepped. FFmpeg's default -60 dB read a whole 4K typing burst as frozen, so it reads at -100 dB.

### `src/take/stills.ts`

`stills.ts` is the reel's reading half. It reads the frame count and each frame's start off the WebP chunks, since FFmpeg decodes no animated WebP, and refuses a file that is not one before any browser starts.

- Pixels come from Chromium's `ImageDecoder` by frame index, since a timed capture lands frames off. The page is a routed https address, since a blank page refuses a `file://` image.
- Playwright imports inside the decode, so a target without the engine still loads `take.ts`
- A reel filmed with identical neighbors folds them into one frame at encode, so the count is the frames written and not the reel's duration at its frame rate
- The pick spaces frames evenly with the first and last included, and each once when the count passes the reel's frames
- A still or sheet already on disk refuses as `would-overwrite` unless `--overwrite` is passed, and a refusal writes nothing

### `src/take/fixtures/`

Owns the static pages the end to end takes film, four of which post each input they receive back to the test's server, and `film-suite.ts`, the harness the ten `film-*.e2e.test.ts` files share. `camera-scenarios.json` films the camera rules' eleven scenarios on `camera.html`, named so `pr-reel.ts` never pairs the two.

- `motion.html` is the release-checklist page every motion rule is measured on, and `motion-server.ts` serves any fixture with canon's token sheet and Geist from where they live
- `motion.html` reports the animation frame each input paints in, since a stepped page's `performance.now()` runs ahead of the clip while inputs are dispatched
- `scrollbars.html` posts its scrollbar gutter, 0 on both routes since a take hides scrollbars until a beat sets `scrollbars: true`, which a stepped beat that falls back to the screencast keeps
- `watch.ts` films a fixture stem's plan on its page, `motion` by default, and renders each beat with its zoom and cursor burned in, for judging a camera change by eye
- `pr-reel.ts` films the reel the lift owes through the worktree's engine, from each changed fixture's `<stem>.json` or a `--plan <file>`, and refuses `unplanned` when neither covers the change

### `src/take/film-*.e2e.test.ts`

The film suite is ten files, one per describe block, so vitest runs them in parallel.

- A stepped case films at `deviceScale: 1` unless it asserts a 3840x2160 frame, stalls the page into a refusal, proves the scale 1 retry, or tests paint at scale 2. `canon take` and the reel keep 2.
- `film-network` holds or aborts the data request `pending.html` makes on load, on both routes, and reads the state off the page color in each still
- `film-canvas` films `canvas-board.html` at scale 2, since its canvas drawn at device resolution is the paint load under test, on each route and with one load of its one-use link
- `bandLuma` takes its crop in CSS pixels and scales it to the clip it reads, so one crop reads the same element at either scale
- `film-drag`, `film-glide`, and `film-step` run in the `timed` project of `vitest.e2e.config.ts`, after the parallel files, since their timing limits fail under load. A case like them joins that list.

## Gotchas

- The frame ticks start at the load event's monotonic stamp and rise to the page clock at the pause, since a tick on Bun's clock freezes animation and ticks lagging the page film every later fade dead
- Send an input, step a frame, then await it under the stall limit, or 30 s for a move, which acks on a 2.5 s flush when it misses its frame. Awaiting first deadlocks. Begin one frame at a time.
- A JPEG frame is full range and H.264 is TV range, so the encoder scales between them. From FFmpeg 7.1 a conversion keeps the source range, so every call reading or writing a still names `out_range`.
- Virtual time advances plainly, since pausing on a fetch held it into a stall, and a loop timed on `performance.now()` never ends under it. Stepped tests stall at 8 s, past a loaded settle frame.
- A moved Playwright cache reads as `browser-missing`, and a reworded `No usable sandbox!` or `Chromium sandboxing failed!` reads as `take-failed`, not `sandbox-blocked`
