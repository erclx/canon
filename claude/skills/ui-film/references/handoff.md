---
title: UI film handoff
description: What HyperFrames receives from a take, the shape of the click log and camera track, and how a composition applies the camera and draws the cursor
---

# UI film handoff

Read at Step 5 of `ui-film`. Canon stops at the clip, and a HyperFrames composition does the rest. This file states what the composition receives and how it uses each part, so a session composing later needs nothing from the session that filmed.

## What the takes folder holds

`take.json` lists every beat in plan order, with the folder, the route that filmed it, and the frame count. Each beat's folder holds four files.

| File          | Holds                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| `clip.mp4`    | H.264 at 60 fps, 3840x2160 when frame stepped, 1920x1080 when screencast     |
| `log.json`    | Every move, click, typing burst, and scroll, with each target's box          |
| `camera.json` | One camera per frame of the clip, with the cursor and the click ring         |
| `still.jpg`   | The clip's closing frame, the check on each take, which no composition needs |

Every coordinate in the log and the track is in CSS pixels of a 1920x1080 page, whatever size the clip is. Every time is in milliseconds on the clip's own clock, so frame `n` sits at `n * 1000 / 60`.

## The camera track

Each frame carries `scale`, the view's top-left `x` and `y`, the `cursor`, and `ring`.

- `scale` is 1 for the whole page and 1.8 at the deepest zoom, or about 1.35 on a screencast beat, and holds at 1 on a beat whose plan set `push: false`
- `x` and `y` place the view's corner on the page, so the view spans `1920 / scale` by `1080 / scale` from there
- `cursor` is the pointer's position on the page
- `ring` runs from 0 to 1 across the 450 ms after a click and is `null` otherwise

The track is final. It already carries the easing, the spring, and the hold, so a composition sets each frame's values and never tweens between them.

## Where the composition lives

The HyperFrames project sits in the same workspace as the takes, so one folder holds everything a video is made from.

```bash
bunx -y hyperframes init .canon/video/<slug>/composition
```

- Use `bunx` when bun is available, falling back to `npx -y hyperframes init ...` otherwise
- Prefix the path with the main worktree root when running from a linked worktree, as `ui-film`'s write scope states
- Read each clip from `../takes/<dir>/clip.mp4`, relative to the project, rather than copying it in
- Leave renders in the project's `renders/` folder, which `canon records push` skips along with `takes/`, `snapshots/`, `node_modules/`, and any video file
- An image the composition adds under `assets/`, such as a logo, is backed up with the project's source

Compose from a session started at the main worktree root. From a linked worktree or an isolated background session, `Write` and `Edit` refuse every file in `composition/` and redirect to a worktree copy no later session reads, so never take that redirect.

Where composing from the main root is not possible, write each file whole through the route `${CLAUDE_SKILL_DIR}/../session-worktree/references/main-root-writes.md` states.

## Applying it in a composition

Load `hyperframes-core` for placing the clip and `hyperframes-keyframes` for the wrapper's transform before writing the composition.

1. Size a stage at 1920x1080 and place the clip inside a non-timed wrapper that fills it, with `transform-origin: 0 0`. Time the video, never the wrapper too.
2. Drive the wrapper from the track on the composition's registered timeline, setting `scale(s) translate(-x px, -y px)` at each frame's time from the clip's start.
3. Draw the cursor as its own element outside the wrapper, at a constant size, positioned at `(cursor.x - x) * s` and `(cursor.y - y) * s` on the stage.
4. Draw the click ring the same way while `ring` is not null, growing and fading with its value.

The cursor stays outside the wrapper because a cursor inside it would scale with the zoom, which is the reason no clip carries one.

## What the composition still owns

- The order and the cuts between takes, the captions, and any music or voice
- Whether a take plays whole or trimmed. A trim keeps the track aligned only when it shifts the track by the same frames.
- Motion blur stays off, by the operator's call on these takes
