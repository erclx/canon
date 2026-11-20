---
title: UI film handoff
description: What HyperFrames receives from a take, what a refilm regenerates, the footage page the operator reviews, the shape of the click log and camera track, and how a composition applies the camera and draws the cursor
---

# UI film handoff

Read at Step 5 of `ui-film`. Canon stops at the clip, and a HyperFrames composition does the rest. This file states what the composition receives and how it uses each part, so a session composing later needs nothing from the session that filmed.

## What the takes folder holds

`take.json` lists every beat in plan order, with the folder, the route that filmed it, and the frame count. Each beat's folder holds four files.

| File          | Holds                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| `clip.mp4`    | H.264 at 60 fps, twice the window when frame stepped, the window when not    |
| `log.json`    | Every move, click, drag, key press, typing burst, and scroll, with its boxes |
| `camera.json` | One camera per frame of the clip, with the cursor and the click ring         |
| `still.jpg`   | The clip's closing frame, the check on each take, which no composition needs |

A press the plan aimed at a point logs `at` with no `box`, and a drag end aimed at a point logs no `box` or `drop`.

The window is the log's `viewport`, 1920x1080 unless the plan set a smaller one. Every coordinate in the log and the track is in CSS pixels of that window, whatever size the clip is. Every time is in milliseconds on the clip's own clock, so frame `n` sits at `n * 1000 / 60`.

## After a refilm

A refilm replaces the beat's folder whole, so every file in it is rebuilt or gone. `canon take` rebuilds all four. A harness take rebuilds only what its script writes, and a camera track lost that way leaves the cut drawing no cursor, with no warning from the build.

Regenerate a refilmed harness take in this order, since each step reads the one before it.

1. Film the beat again with its script in `harness/`, transcoding its recording to `clip.mp4` beside the new `log.json`.
2. Write `still.jpg` from the new clip, per `harness.md`, and read it the way Step 4 reads each take's still.
3. Rebuild the camera track with `canon take camera <dir>/log.json --out <dir>/camera.json`.
4. Write the footage page again, so its card shows the new take.

Stop a composition before it renders when a take holds a `log.json` and no `camera.json`, and name the take. Rendering it draws no cursor on the beat, which only a close look at the cut reveals.

## The footage page

The operator approves the beats in words and sees no footage until a cut, so a bad take found then has compose work resting on it. Step 5 writes `.canon/video/<slug>/footage.html` from the takes folder, one page where every take plays before anything is composed.

Write the page whole each time Step 5 runs, since a refilm changes its sources. One card per beat carries what a reviewer needs to judge the take.

- Take the beats `take.json` lists, in its order
- Add each folder under `takes/` holding a `clip.mp4` that `take.json` does not list, since a harness beat films outside the verb and never reaches it. Order these by folder name after the listed beats.

The table reads a listed beat's record. A harness beat has no record, so its card takes the folder's name, `harness` as its route, and its length from `ffprobe` on the clip.

| Card part | Read from                                                                           |
| --------- | ----------------------------------------------------------------------------------- |
| Title     | The beat's `name`, as the operator approved it                                      |
| Player    | `<video muted controls preload="metadata">` on `takes/` joined to the beat's `clip` |
| Length    | The beat's `seconds`                                                                |
| Route     | The beat's `route`, with `fallback` named when the record carries it                |
| File      | The clip's path relative to the workspace                                           |
| Flaw      | What Step 4's read of the still found, or nothing when it passed                    |

### Building the page

A stepped clip is 3840x2160 at 60 fps, and a dozen of them looping at once stutters the page.

- Play a card on hover or click and pause it on leave, rather than looping every player at once
- Read every clip by its path relative to the page, so the page plays from the workspace and copies no media
- Copy neither `take.json`'s `url` nor the config's `access` into the page, since either can carry a token
- Add a card per audio file already in the workspace, usually none at this step, and leave a refresh with the music to the composing session
- Keep the page standalone, with no board route, since a board version belongs to the board's own plugin

## The camera track

Each frame carries `scale`, the view's top-left `x` and `y`, the `cursor`, and `ring`.

- `scale` is 1 for the whole page and 1.8 at the deepest zoom, or about 1.35 on a screencast beat, and holds at 1 on a beat whose plan set `push: false`
- `x` and `y` place the view's corner on the page, so the view spans `viewport.width / scale` by `viewport.height / scale` from there
- `cursor` is the pointer's position on the page
- `ring` runs from 0 to 1 across the 450 ms after a click and is `null` otherwise. On a drag it grows to 0.3, holds there from press to release, and runs on to 1 from the release.

A track whose beat set `hand: false` carries `hand: false` at its top level beside `fps`. Its frames hold at scale 1 and still carry a `cursor` point, so a reader of frames alone changes nothing, and the composition draws neither the cursor nor the ring on that beat.

The track is final. It already carries the easing and the hold, so a composition sets each frame's values and never tweens between them.

## Where the composition lives

The HyperFrames project sits in the same workspace as the takes, so one folder holds everything a video is made from. Create it at `.canon/video/<slug>/composition` with the new-project command the `hyperframes` skill names, run the way that skill says for its install, since a plugin install routes the CLI through its own launcher.

- Prefix the path with the main worktree root when running from a linked worktree, as `ui-film`'s write scope states
- Read each clip from `../takes/<dir>/clip.mp4`, relative to the project, rather than copying it in
- Leave renders in the project's `renders/` folder, which `canon records push` skips along with `takes/`, `scratch/`, `snapshots/`, `node_modules/`, and any video file
- An image the composition adds under `assets/`, such as a logo, is backed up with the project's source

### What the workspace keeps

The workspace holds what a re-film and a re-render need, and the rest clears.

- Keep one render per delivered cut in `renders/`, so a 16:9 and a square cut hold one render each
- Keep harness scripts in `harness/` beside `takes/`
- Hold dry runs, debug passes, and candidate media in `scratch/` only until the take or pick they served lands, then clear them
- Promote a dry run to `takes/` before a composition reads it, since `scratch/` clears

A cut in another shape, the README loop, and a grid's loop clips are each a project of their own beside `composition/`, so one shape's edit never reflows another's. Each reads the takes from `../takes/` the same way.

| Project                | Holds                                                    |
| ---------------------- | -------------------------------------------------------- |
| `composition/`         | The main cut, in the takes' 16:9 shape                   |
| `composition-<shape>/` | One other shape, such as `composition-square/`           |
| `readme-loop/`         | The short silent loop a README plays as its hero         |
| `grid-loops/`          | The short silent loops a page's grid plays, one per cell |

Compose from a session started at the main worktree root. From a linked worktree or an isolated background session, `Write` and `Edit` refuse every file in `composition/` and redirect to a worktree copy no later session reads, so never take that redirect.

Where composing from the main root is not possible, write each file whole through the route `${CLAUDE_SKILL_DIR}/../session-worktree/references/main-root-writes.md` states.

## Applying it in a composition

Read the `hyperframes` skill's `references/format.md` for placing the clip and `references/motion.md` for the wrapper's transform before writing the composition.

1. Size a stage at 1920x1080 and place the clip inside a non-timed wrapper sized at the log's `viewport`, with `transform-origin: 0 0`. Time the video, never the wrapper too.
2. Drive the wrapper from the track on the composition's registered timeline, setting `scale(s * k) translate(-x px, -y px)` at each frame's time from the clip's start.
   - `k` is the smaller of 1920 over `viewport.width` and 1080 over `viewport.height`, 1 at the default window
   - A window not 16:9, such as 800x600, fits with bars on two sides. Hold the wrapper in a box `viewport` times `k` in size, centered on the stage with its overflow clipped.
   - Add that box's offset from the stage corner to the cursor and the ring
3. Draw the cursor as its own element outside the wrapper, at a constant size, positioned at `(cursor.x - x) * s * k` and `(cursor.y - y) * s * k` on the stage.
4. Draw the click ring the same way while `ring` is not null, growing and fading with its value.
5. Draw neither on a track carrying `hand: false`.

The cursor stays outside the wrapper because a cursor inside it would scale with the zoom, which is the reason no clip carries one.

### The cursor and ring look

Every film and the pull request reel draw one look, the one Frameboard's launch film drew, so two films never disagree about the pointer.

- The cursor is a `#111` arrow outlined 1.5 units in white, on a 24-unit box drawn 56 px at a 1920-wide stage with its tip on the point, under `drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35))`
- The ring is a 72 px circle with a 4 px `#2f7bf0` border, centered on the point, scaled `0.4 + ring` as a whole at opacity `1 - ring`, so its line thickens only as it fades
- One arrow holds on every frame, since the log records no page cursor and a hand or a text cursor would be a guess

The arrow's path in its 24-unit box is `M4 2 L4 19 L8.5 14.5 L11.5 21 L14 20 L11 13.5 L17.5 13.5 Z`, with its tip at 4, 2.

## What the composition still owns

Read `${CLAUDE_SKILL_DIR}/references/compose-craft.md` for the other shapes, the loops, and a sped-up clip, and `${CLAUDE_SKILL_DIR}/references/captions.md` for the captions, where app footage changes what HyperFrames advises.

- The order and the cuts between takes, the captions, and any music or voice
- Whether a take plays whole or trimmed. A trim keeps the track aligned only when it shifts the track by the same frames.
- Motion blur stays off, by the operator's call on these takes
