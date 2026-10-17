---
title: Demo
description: Beats compiler and browser driver behind canon demo, why the plan is a second committed artifact, and the gotchas in painting a pointer inside the page
---

# Demo

## Overview

`canon demo` drives a project's running application and writes a recording and a still. The command surface, its flags, and its refusal reasons live in `docs/agents/demo.md`. This entry holds why it is shaped the way it is.

The browser engine already in this repository can produce a video from a driven page with no editor and no desktop recorder, which is the premise the whole feature rests on. See `.canon/groundwork/38-demo-recorder/06-decision.md` before changing anything structural.

## Layout

- `src/demo/` owns the beats reader, the compiler, the pointer and its bundled cursors, the cursor theme reader, the browser driver, and the container post-steps
- `src/browser/` owns the engine helpers shared with `canon inventory` and `canon drive`
- `demos/<slug>/` owns one demo. The raw take lands in the ignored `take/` and a composed render in the ignored `renders/`.
- `record-screencast` passes `--slug` to `compile`, since the default slug reads the draft filename and would name every demo `beats`

### A demo folder

A demo folder holds four committed files.

- `beats.md` and `plan.json`
- An optional HyperFrames `index.html`
- The one gif a README embeds, named `demo.gif` because the folder-echoed filename gate rejects a repeated folder name

Ignoring `take/` in a target is open, since no tooling stack carries a gitignore seed.

## Decisions

### The plan is a second artifact

A beat is drafted through four discovery questions and pre-seeded so a person edits down. Adding a selector, a URL, a wait condition, and a timing to every beat destroys that property.

The compiler also has to translate, since the engine's overlay carries the action it performed rather than the beat's caption. A translation step is a compiler rather than a field.

### The plan is committed

Scratch under `.canon/tmp/` fails the deletable test on its timing. The numbers are tuned by watching a recording, and the draft cannot reproduce a tuned value.

That is why `compile` refuses to overwrite an existing plan without `--force`, since a recompile is the same loss by another route.

### `--out` names a directory

`--out` names a directory in both verbs and never a root. A root on `run` and a directory on `compile` would resolve the plan's own directory a second time and nest the output path inside itself. `drive` takes resolved paths rather than a root plus a relative path.

### Color scheme and second themes

The plan's `colorScheme` rides the context's own preference path rather than seeding a page's stored theme. `drive.ts` passes it to `newContext` only when the plan sets it, so the page's `prefers-color-scheme` query answers and no page-specific storage key is written.

- Seeding storage was the rejected alternative, since it would tie a plan to one site's theme key
- The cost is that a page keyed on a stored theme ignores the field, and a plan whose earlier beat clicks a toggle overrides it
- It accepts `light` and `dark` only, and `compile` leaves it unset so a recompile does not change a recording

A second theme is a second plan rather than a flag on the recording run. A run-time override would be a new option with one caller, while two plans stay committed and diffable. The cost is beats copied between `demos/agent-view/plan.json` and `demos/agent-view-light/plan.json`, which nothing keeps in step.

### Shipping to targets

The command's purpose is running in someone else's project, so `src/demo/` ships and a target inherits a browser binary install. The browser engine is a runtime dependency rather than a development one, and `src/capture/` ships too, sharing the same import.

- `src/capture/render.ts` imports `chromium` from `playwright-core`, not the development dependency `@playwright/test`, which would throw `ERR_MODULE_NOT_FOUND` in every target
- The capture `--selector` default is `.window`, since no selector is universal enough to guess for someone else's markup
- The accepted cost is `bunx playwright install chromium` before a target's first run. Measured at `dbe83429` on 2026-09-01.

### The pointer moves through the engine

The pointer moves through the engine's pointer, never the element-clicking helper. The helper resolves a target and jumps to it. Interpolated movement is the entire trick, and one step is what makes a cursor teleport.

The bundled artwork is drawn rather than lifted from a theme. A theme lives on one machine, and a target has none to point at on first run. `--cursor` reads one for an operator who has it.

### Pointer travel is a duration

The step count is derived rather than fixed. A step is a round trip to the browser, so a fixed count set a message rate rather than a duration, and the same plan produced recordings 26 percent apart on byte-identical input.

`compile.ts`'s `deriveSteps` divides the plan's `pointer.travelMs` by a round trip `drive.ts` measures on the first real move, not on a blank page, since layout, paint, and page script are what a step pays for.

### The caption overlay

The caption is a DOM overlay next to the pointer's, not the engine's own annotation. `showActions` names the Playwright call it made, never the beat's narration. `drive.ts` installs a second `addInitScript` beside the pointer's and updates it after each step's action runs, before the hold that follows.

### `showActions` is off

The pointer and the caption each replace half of it. Leaving it on would carry four overlays where two are wanted, the engine's dot beside a real cursor and its `Mouse move` title beside the beat's narration.

`plan.annotations` survives as a shape the type carries and nothing reads, since `parsePlan` always replaces it with the `ANNOTATIONS` constant.

### A plan that points at nothing

A plan that points at nothing paints no pointer. The injected element installs off-screen on `DOMContentLoaded`, and the mouse move to `START` after each navigate first makes it visible, so a plan of navigates, scrolls, and holds would park a cursor in a corner for the whole recording.

`movesPointer` gates that seed on the plan carrying a `click`, `fill`, or `hover`, the set `moveTo` is reached from, and calibration never runs either since it fires lazily inside `moveTo`. A cursor resting on a row of text and one parked in a corner are the same defect, and only the second looks fixed.

### Scroll steps

A scroll step centers its target rather than revealing it, and passes `behavior: 'instant'`. `scrollIntoViewIfNeeded` scrolls the least it can, which leaves a tall target flush against the bottom edge. On this repository's own recording that was 225 pixels of dead space above the content and 2 below, and centering gives 170 and 165.

The behavior is explicit because the scroll runs in the page, and an in-page scroll honors the document's `scroll-behavior`. A project setting it to `smooth` would get a call returning before the scroll finished. Nothing here sets it, so the recorder cannot catch that on its own pages.

### mp4 is a post-step

mp4 is a post-step, not a compiler or driver concern. `container.ts` shells out to `ffmpeg` through `execa` once the driver has written the webm, and writes beside it rather than instead of it.

A missing or failing converter degrades to a warning rather than failing a run whose recording already succeeded.

### The gif is opt-in

The split from mp4 is destination rather than cost. A gif runs several times the size of the webm it derives from, and one destination needs one, a README on a host that strips a video tag. `--gif` gates it while the mp4 stays unconditional.

The filter generates a palette from the source and applies it rather than quantizing per frame, since a per-frame palette makes a recording of flat interface colors band and shimmer.

### The timeline sidecar

The per-step timeline lives in a sidecar file the driver writes, and the run record only names its path. A composition reads `<video-basename>.timeline.json` off disk long after the run, so the file is the durable copy, and a record printed once on stdout would be gone by then.

- `drive()` writes it right after the video's `saveAs`, so a run with no video writes none and the browser test can assert the file on disk
- Its clock starts when `context.newPage()` returns, since the recording begins with the page
- Each entry's box is the bounding box `moveTo` already resolved, in viewport pixels that equal the video frame's coordinates

### Frame extraction is its own verb

Reading a recording back is a separate act from writing one, so frame extraction is a third verb rather than a `run` flag. `canon demo frames` defaults to one PNG a second, matched to how long a tuned recording runs.

- It names each frame `<video-basename>-frame-<NNN>.png` beside the video, under the same `demos/*.png` gitignore entry the still claims
- `read-frames` is the routed caller. It reads every frame with the Read tool and reports a plain description, never a verdict, since a frame read is evidence rather than a pass or fail.

### Composing

Composition craft lives in `video-craft`, which overrides two of HyperFrames' own defaults on sourced grounds. `claude/skills/video-craft/references/adopted.md` records each conflict beside its source, so a later change argues there rather than in the skill body.

- A push onto an action stays above the teleport floor HyperFrames' zoom rule states and never runs past 1 second, since two renders pushing in over 2.2 and 1.4 seconds were both judged slow
- Music sits at least 20 dB under a voice, the WCAG 1.4.7 floor, where the `media-use` narrated bed default sat about 18 dB under
- Restating a rule HyperFrames already carries was rejected, since their skills update on their own cadence and a copy goes stale

## Gotchas

### A gif's size follows the palette

A gif's size is driven by the palette and its dithering, not by how much is drawn. `palettegen` picks 256 colors from whatever is on screen and `paletteuse` dithers everything outside that set, so removing a drawn element does not reliably shrink it.

Measured on this repository's own recording at 960 wide and 12 frames a second, 75 frames throughout, it came to 3.19MB with dithering and 2.70MB without. Ten frames a second gave 3.08MB and 800 wide gave 2.38MB.

- `dither=none` ships, on the reasoning in `src/demo/container.ts`
- Width is the larger remaining lever and is not taken, since the terminal rows are what the recording exists to have read. Frame rate is nearly no lever.
- Two recordings of one plan are separate runs, so a size difference is not attributable to one change without holding the source video, which is gitignored

### The pointer inherits the page's world

The pointer is a page element. A site with its own element at that id, a stacking context that outranks it, or a style rule reaching it will interfere. It also installs before navigation, so driving an already-open page needs a reload.

- A repeated attribute in the bundled artwork renders as a broken image rather than raising
- A second `fill` on a path once did that, and `src/demo/pointer.test.ts` now walks each state's markup for it
- Resolving a target through its bounding box assumes it is in the viewport. A target below the fold needs a `scroll` step ahead of it.
- A scrolled page moves the pointer under a fixed-position element in ways nothing has exercised

### Open timing and cursor gaps

Three of nineteen cursor states are handled. A drag, a resize, or a wait shows an arrow, and the two animated states have no still frame at all.

Pause and typing timing are unsolved. `HOLD_MS`, `FINAL_HOLD_MS`, and `TYPE_DELAY_MS` are tuned to look right on one fixture, and they separate a demo that reads as deliberate from one that reads as slow.

### Tests and frames

`src/demo/drive.e2e.test.ts` skips when no browser binary is present and CI installs none, so a green pipeline is not evidence it passed. Run it locally.

- Multiple launches in one test run risk an unexplained wedge. A `drive` call once timed out after other launches finished clean, with no cause found.
- Recent runs with five launches finished clean in eleven to twelve seconds, which narrows the shape without ruling it out
- `extractFrames` clears its own naming pattern before ffmpeg runs, not after
- `-y` only overwrites the indices a run produces, so a shorter re-extraction would leave the previous tail, and `read-frames` could not tell where the real frames stopped

### File contracts

Each file in `src/demo/` holds one contract. `beats.ts` reads the draft `draft-screencast` writes, `compile.ts` holds the plan type, the beats-to-plan transform, and plan validation, and `drive.ts` holds every browser reference the feature adds.

- `pointer.ts` decodes cursors, scales hotspots, and builds the injected script, with `cursors.ts` the artwork and `theme.ts` the `--cursor` reader
- `timeline.ts` holds the entry shape, the sidecar name, and its writer
- `container.ts` holds the mp4, `--gif`, and PNG post-steps the compiler and driver never see
- `src/commands/demo.ts` is wiring only, and `src/browser/engine.ts` holds the install command, the absent-engine cases, and the keyboard-modality press
