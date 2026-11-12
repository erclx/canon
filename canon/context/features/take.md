---
title: Take
description: The canon take verb that films a web app by frame stepping, its click log and camera track, the pull request reel with a drawn pointer, and the begin-frame traps
---

# Take

## Overview

Owns `canon take`, which films each beat of a take plan into a 4K, 60 fps clip with a click log and a per-frame camera track. Its boundary is the clip, and HyperFrames composes and renders everything past it. The one exception is the pull request reel, which `--reel` joins from the clips with the pointer drawn on.

The `ui-film` plugin skill drafts the beats and calls the verb for a launch video. `pr-evidence` films the pull request reel with `--reel` and `--max-seconds 12`, which refuses as `over-cap` past 12 s of clips. `src/commands/take.ts` holds only the wiring, including `canon take camera`, which rebuilds a track at a playback rate.

## Layout

### `src/take/`

Reads a take plan, films each beat from a fresh load, and writes the clip, the log, the camera track, and `still.jpg` per beat, listed in `take.json`. With `--reel`, `reel.ts` crops each frame to a camera rebuilt at `REEL_DEPTH` 2, draws the cursor through that view, and joins every third frame into a 960-wide WebP, lossy past `REEL_MAX_BYTES`.

- The stepper drives chrome-headless-shell over raw CDP, since Playwright cannot ask for begin-frame control, and shoots frames at device scale 2, or 1 on a request's `deviceScale`
- A `screencast` beat, or a stepped frame past 2 s, films through Playwright at 1920x1080, its record naming the route, and `frame-clock.ts` moves each wall-time frame stamp onto the stage clock
- One choreography performs every step through each route's stage, logging each point a glide sends for the drawn cursor and resting 300 ms before a press, 500 ms after, and 400 ms before a fill types
- The camera zooms onto a press over the glide reaching it, and in the reel onto the box a key moved focus to, at a depth the clip's width over the output's caps, and pans only at a steady scale
- Stepped frames stream into the system FFmpeg, screencast frames spool beside the clip until the stop, and FFmpeg's absence refuses before any browser launches

### `src/take/fixtures/`

Owns the static pages the end to end takes film, two of which post each input they receive back to the test's server, and `film-suite.ts`, the harness the five `film-*.e2e.test.ts` files share.

- `motion.html` is the release-checklist page every motion rule is measured on, and `motion-server.ts` serves any fixture with canon's token sheet and Geist from where they live
- `motion.html` reports the animation frame each input paints in, since a stepped page's `performance.now()` runs ahead of the clip while inputs are dispatched
- `scrollbars.html` posts its scrollbar gutter, 0 on both routes since a take hides scrollbars until a beat sets `scrollbars: true`, which a stepped beat that falls back to the screencast keeps
- `watch.ts` films `motion.json` on that page and renders each beat with its zoom and cursor burned in, for judging a camera change by eye
- `pr-reel.ts` films each changed fixture with its `<stem>.json` plan, or `motion.json`, through the worktree's engine into the reel the lift owes, since canon's config paints `src/take/**`

### `src/take/film-*.e2e.test.ts`

The film suite is five files, one per describe block, so vitest runs them in parallel.

- A stepped case films at `deviceScale: 1` unless it asserts a 3840x2160 clip or still, or stalls the page into a refusal. `canon take` and the reel keep scale 2.
- `bandLuma` takes its crop in CSS pixels and scales it to the clip it reads, so one crop reads the same element at either scale
- `film-drag` runs in the `timed` project of `vitest.e2e.config.ts`, after every parallel file, since its screencast pacing assertion fails beside them. A case like it joins that list.

## Gotchas

- The frame ticks start at the load event's monotonic stamp and rise to the page clock at the pause, since a tick on Bun's clock freezes animation and ticks lagging the page film every later fade dead
- Send an input, step a frame, then await the input, and begin a frame only once the last settles, since awaiting first deadlocks and Chromium refuses a second frame as pending
- A JPEG frame is full range and H.264 is TV range, so the encoder scales between them. From FFmpeg 7.1 a conversion keeps the source range, so every call reading or writing a still names `out_range`.
- The stepper advances virtual time plainly, since pausing on a fetch held the clock into the stall fallback. Stepped tests raise that limit to 8 s, save the fallback test, which stalls at 2 s.
- A moved Playwright cache reads as `browser-missing`, and a reworded `No usable sandbox!` or `Chromium sandboxing failed!` reads as `take-failed`, not `sandbox-blocked`
