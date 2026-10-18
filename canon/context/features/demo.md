---
title: Demo
description: The beats compiler and browser driver behind canon demo, the demo folder it writes, and the traps in painting a pointer inside the page
---

# Demo

## Overview

`canon demo` drives a project's running application from a committed plan and writes a recording and a still. A draft of beats compiles to the plan, and post-steps derive the mp4, the gif, and extracted frames. The commands and refusals are in `canon demo --help`, and the premise is measured in `.canon/groundwork/38-demo-recorder/06-decision.md`.

## Layout

### `src/demo/`

Reads a beats draft, compiles it to a plan, drives the plan through the browser, and derives the mp4, gif, and frames from the recording.

- `compile` turns beats into a `plan.json` and refuses to overwrite one without `--force`, since its numbers were tuned by watching a recording, and `--out` names a directory in every verb
- The pointer moves through the engine's own pointer in derived steps, the step count being the plan's `pointer.travelMs` over a round trip measured on the first real move
- A plan with no `click`, `fill`, or `hover` paints no pointer, a scroll step centers its target instantly, and the caption is a DOM overlay beside the pointer with the engine's `showActions` off
- The mp4 is unconditional and degrades to a warning without `ffmpeg`, `--gif` is opt-in, and `canon demo frames` extracts one PNG a second for `read-frames`
- The driver writes a `<video-basename>.timeline.json` sidecar with each step's box in video-frame pixels, and a plan's `colorScheme` takes `light` or `dark`, with a second theme being a second plan

### `demos/<slug>/`

Holds one demo, with the raw take in the ignored `take/` and a composed render in the ignored `renders/`.

- Four files are committed, being `beats.md`, `plan.json`, an optional HyperFrames `index.html`, and the one gif a README embeds
- The gif is named `demo.gif`, since the folder-echoed filename gate rejects a repeated folder name
- `record-screencast` passes `--slug` to `compile`, because the default slug reads the draft filename and would name every demo `beats`
- Composition craft lives in `claude/skills/video-craft/`, whose `references/adopted.md` records where it overrides a HyperFrames default

### Other folders

Two folders the feature leans on are shared with other commands.

- `src/browser/` owns the engine helpers shared with `canon inventory` and `canon drive`
- `src/driver/` owns `canon drive`, which runs a plan of steps and probes against a running page for `pick-by-eye` and `review-ui`
- `src/capture/` ships beside `src/demo/` and imports `chromium` from `playwright-core`

## Gotchas

- The pointer is a page element installed before navigation, so a site element at its id or a higher stacking context interferes, and an already-open page needs a reload
- A target below the fold needs a `scroll` step ahead of it, since resolving through the bounding box assumes it is in the viewport
- A page keyed on a stored theme ignores `colorScheme`, and an earlier beat clicking a toggle overrides it
- `src/capture/render.ts` must import from `playwright-core`, because `@playwright/test` is a development dependency and throws `ERR_MODULE_NOT_FOUND` in a target
- `src/demo/drive.e2e.test.ts` skips when no browser binary is present and CI installs none, so a green pipeline is no evidence it ran
