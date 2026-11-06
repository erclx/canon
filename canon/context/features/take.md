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

Reads a take plan, films each beat from a fresh load, and writes the clip, the log, the camera track, and `still.jpg` per beat, listed in `take.json`. With `--reel`, `reel.ts` joins every third frame into one 960-wide lossless WebP, with `pointer.ts` drawing the cursor and no zoom, and encodes at quality 60 only past `REEL_MAX_BYTES`.

- The stepper launches chrome-headless-shell under begin-frame control over raw CDP, since Playwright cannot ask for it on a page it opens, and screenshots each frame at device scale 2
- A `screencast` beat, or a stepped frame past 2 s, films through Playwright at 1920x1080, its record naming the route, and `frame-clock.ts` moves each wall-time frame stamp onto the stage clock
- One choreography performs every step through each route's stage, logging each point a glide sends for the drawn cursor and resting 300 ms before a press, 500 ms after, and 400 ms before a fill types
- The camera zooms in over the glide reaching a target and out over the glide leaving it, scaling about the target, at a depth the clip's resolution caps, and pans only at a steady scale
- Stepped frames stream into the system FFmpeg, screencast frames spool beside the clip until the stop, and FFmpeg's absence refuses before any browser launches

### `src/take/fixtures/`

Owns the static pages the end to end takes film, two of which post each input they receive back to the test's server.

- `motion.html` is the release-checklist page every motion rule is measured on, and `motion-server.ts` serves it with canon's token sheet and Geist from where they live
- `motion.html` reports the animation frame each input paints in, since a stepped page's `performance.now()` runs ahead of the clip while inputs are dispatched
- `watch.ts` films `motion.json` on that page and renders each beat with its zoom and cursor burned in, for judging a camera change by eye

## Gotchas

- Frame time continues Chromium's monotonic clock, read off the load event's timestamp, since Bun's `process.hrtime` counts from its own start and a frame stamped on it freezes every animation
- Send an input, step a frame, then await the input, and begin a frame only once the last settles, since awaiting first deadlocks and Chromium refuses a second frame as pending
- A JPEG frame is full range and H.264 is read as TV range, so the encoder scales between them, and a test reading luma through FFmpeg's `format=gray` stretches it again and clips both ends
- The stepper advances virtual time plainly, since pausing on a fetch held the clock into the stall fallback. Stepped tests raise that limit to 8 s, save the fallback test, which stalls at 2 s.
- The shell's path is rebuilt from `playwright-core`'s `browsers.json` and cache layout, so a Playwright upgrade that moves the layout reads as `browser-missing`
