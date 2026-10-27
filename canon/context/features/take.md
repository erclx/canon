---
title: Take
description: The canon take verb that films a web app by frame stepping, its click log and camera track, the pull request reel with a drawn pointer, and the begin-frame traps
---

# Take

## Overview

Owns `canon take`, which films each beat of a take plan into a 4K, 60 fps clip with a click log and a per-frame camera track. Its boundary is the clip, and HyperFrames composes and renders everything past it. The one exception is the pull request reel, which `--reel` joins from the clips with the pointer drawn on.

The `ui-film` plugin skill drafts the beats and calls the verb, and `src/commands/take.ts` holds only the verb's wiring, including `canon take camera`, which rebuilds a track from a log at a playback rate.

## Layout

### `src/take/`

Reads a take plan, films each beat from a fresh load, and writes the clip, the log, the camera track, and the closing frame as `still.jpg` per beat, listed in `take.json`. With `--reel`, `reel.ts` joins every third frame into one 960-wide WebP and `pointer.ts` draws the cursor from the camera track, with no zoom, since that is HyperFrames' craft.

- The stepper launches chrome-headless-shell under begin-frame control over raw CDP, since Playwright cannot ask for it on a page it opens, and screenshots each frame at device scale 2
- A beat asking for `screencast`, or a stepped frame slower than 2 s, films through Playwright's screencast at 1920x1080 instead, and the beat's record names the route
- One choreography performs every step through a stage each route supplies, so the pointer moves on the same curve in both routes and in the log the edit redraws it from
- The camera turns a log into one view per frame on preset O4 at a depth the clip's resolution caps, and pushes the view with the cursor at its outer 10% when the spring lags a long reach
- Frames stream into the system FFmpeg rather than landing on disk, and FFmpeg's absence refuses before any browser launches

### `src/take/zoom/`

Holds OpenScreen's zoom timing at `ca8104c` under its MIT license, trimmed to the region strength, the connected-pan easing, and the spring. `NOTICE.md` lists what changed, including the spring solved in closed form rather than through the `motion` package.

### Other folders

One folder here does no work of its own.

- `src/take/fixtures/` owns the static page the end to end take films

## Gotchas

- Frame time continues Chromium's monotonic clock, read off the load event's timestamp, since Bun's `process.hrtime` counts from its own start and a frame stamped on it freezes every animation
- Send an input, step a frame, then await the input, since under begin-frame control an input is acknowledged by a frame and awaiting it first deadlocks
- A JPEG frame is full range and H.264 is read as TV range, so the encoder scales between them, and a test reading luma through FFmpeg's `format=gray` stretches it again and clips both ends
- The stepper advances virtual time plainly, since pausing on a fetch held the clock into the stall fallback. The tests raise that limit to 8 s, so the fetch test's reply has to outlast it.
- The shell's path is rebuilt from `playwright-core`'s `browsers.json` and cache layout, so a Playwright upgrade that moves the layout reads as `browser-missing`

### Stalls and the fallback

Two traps sit on the path from a stalled frame to the screencast.

- A stall leaves the stepper's sends pending until the shell closes and rejects them, so each one carries a handler, or the take dies on an unhandled rejection after it already refused
- The screencast fallback opens the address a second time, so a single-use link is spent before its steps run, and the refusal carries `fallback` rather than blaming the target alone
