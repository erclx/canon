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

Reads a take plan, films each beat from a fresh load, and writes the clip, the log, the camera track, and the closing frame as `still.jpg` per beat, listed in `take.json`. With `--reel`, `reel.ts` joins every third frame into one 960-wide WebP and `pointer.ts` draws the cursor from the camera track, with no zoom, since that is HyperFrames' craft.

- The stepper launches chrome-headless-shell under begin-frame control over raw CDP, since Playwright cannot ask for it on a page it opens, and screenshots each frame at device scale 2
- A beat asking for `screencast`, or a stepped frame slower than 2 s, films through Playwright's screencast at 1920x1080, cut at the stage clock past the recorder's 1 s pad, its record naming the route
- One choreography performs every step through each route's stage on one pointer curve, aiming a scroll at the part of its target inside the window, since a page-tall `body` is centered below it
- The camera turns a log into one view per frame on preset O4 at a depth the clip's resolution caps, and pushes the view with the cursor at its outer 10% when the spring lags a long reach
- Frames stream into the system FFmpeg rather than landing on disk, and FFmpeg's absence refuses before any browser launches

### `src/take/zoom/`

Holds OpenScreen's zoom timing at `ca8104c` under its MIT license, trimmed to the region strength, the connected-pan easing, and the spring. `NOTICE.md` lists what changed, including the spring solved in closed form rather than through the `motion` package.

### Other folders

One folder here does no work of its own.

- `src/take/fixtures/` owns the static pages the end to end takes film, one of which posts each input it receives back to the test's server

## Gotchas

- Frame time continues Chromium's monotonic clock, read off the load event's timestamp, since Bun's `process.hrtime` counts from its own start and a frame stamped on it freezes every animation
- Send an input, step a frame, then await the input, and begin a frame only once the last settles, since awaiting first deadlocks and Chromium refuses a second frame as pending
- A JPEG frame is full range and H.264 is read as TV range, so the encoder scales between them, and a test reading luma through FFmpeg's `format=gray` stretches it again and clips both ends
- The stepper advances virtual time plainly, since pausing on a fetch held the clock into the stall fallback. Stepped tests raise that limit to 8 s, save the fallback test, which stalls at 2 s.
- The shell's path is rebuilt from `playwright-core`'s `browsers.json` and cache layout, so a Playwright upgrade that moves the layout reads as `browser-missing`
