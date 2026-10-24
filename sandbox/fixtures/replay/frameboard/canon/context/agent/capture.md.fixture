---
title: Capture
description: Screenshots of frames and pages in either theme
---

# Capture

## Overview

Owns what an agent sees of a frame without a screen, being PNGs of one frame or a whole page, in either theme or both. Capture runs in a real browser.

## Layout

### `src/server/capture/`

Owns the capture browser, the frame host, the render, the font check, the image writer, `fit`, and `inspect`, with the flags and record shapes in `frameboard docs`. The CLI renders through its own loopback host over the frame routes the server mounts, so `capture`, `fit`, and `inspect` need no running server.

- `capture` takes a frame or, with `--page`, every visible frame of a page, since a two-part ref reads as either, and `--composite` places them at their layout positions on the theme's `Canvas`
- A frame opens at layout size from `frameThemeUrl` under an emulated `prefers-color-scheme`, on a host mounting the look and frame routes through `servedFrames`, so the injected script sets the theme
- Every image renders before any is written, landing under the board's `.run/captures/` as `<project>/<page>/<frame>.<theme>.png`, or `<project>/<page>.<theme>.png` for a composite
- `inspect` loads a frame through the same host and `openFrame`, one theme per call, and lists each element with a layout box under the `edit` index, reading the file's hash before and after the load
- `inspect` reports `editable: false` where the browser builds an element the file does not state, such as a `tr` with no `tbody`, since `edit` refuses every index there

The server side shares one browser and renders only on demand.

- `createWarmBrowser` keeps one warm browser, shared on separate queues by `GET /api/frames/png` at scale 2, the thumbnail store at scale 0.5, and the browser checker
- The PNG route takes no token, since it shows only what the frame route serves, and its queue holds a looping caller to one tab
- `thumbnails.ts` renders a frame in one theme only when a home view asks, a batch marks only its reloaded frames stale, and a failed render waits for the frame's stamp to change
- The checker opens frames with `fonts: 'wait'`, measuring the fallback, where every capture verb keeps the refusing default
- A font stack opening with a generic, or with the browser default an unstyled frame computes to, asks for no face. The default is probed in the page, so an explicit "Times New Roman" is skipped too

## Gotchas

- Capture refuses `font-missing` when a text element's first family is neither a loaded web face nor installed per DevTools `CSS.getPlatformFontsForNode`, so a name the platform aliases reads as missing
- Capture uses the pinned headless shell alone, since an installed Chrome or Edge rasterizes text differently, and without it refuses `browser-not-found` with the install command, downloading nothing
- A composite past 16384 px a side refuses `capture-too-large`, since Chromium's screenshot surface stops there
- Inspect prints nothing and refuses `invalid-address` for an index with no layout box, `address-mismatch` when the live tag order leaves the file's, and `stale-address` when the file changed mid-load
- Element counting lives in five places that cannot share code, being `readTextElements`, inspect's reader, the client pick, and the two browser check readers, so changing `LOOK_MARKER` moves all five
