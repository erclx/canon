---
title: Canvas
description: The canvas server and browser shell, the page and frame content format, token resolution into frames, and the verbs and skill that drive it
---

# Canvas

## Overview

`canon canvas` serves a local surface of pages and HTML frames that the operator drags, selects, and edits in the browser, and gives an agent a verb for each thing the mouse does.

It exists for Claude to draw frames the operator reviews, so a planner proposes no further design-tool features unless asked. The verb reference is `canon canvas --help`, and `claude/skills/canvas-board/references/canvas.md` fixes the content format.

## Layout

### `src/canvas/`

Owns the server, the content reader and writers, element addressing, the inline-style editor, token resolution, capture, fit, and arrange.

- A page is a folder under `.canon/canvas/` at the main worktree root, a frame is one `.html` file in it, and `layout.json` holds each frame's box
- Every writer of `layout.json` takes a lock, merges, and replaces the file in one rename, since the server and a CLI verb are two processes
- An element is addressed by its document-order index plus the frame file's hash, and an older hash is refused as `stale-address`
- The server injects one token stylesheet first in each frame's `head` and embeds the vendored faces, so the capture browser and the viewer render one face
- The serve process holds the undo history, which only its edit, move, and resize routes record into, and a restore refuses as `changed` rather than overwrite a newer state

### `src/canvas/client/`

The browser shell, bundled by Bun from `index.html` when the server starts.

- The shell has a pages panel with a read-only Theme tab, a layers tree per frame, the surface, a details panel, and a tool strip
- Selection is written to the project so Claude reads it as "this one", and a click inside a frame selects the element and goes no further
- One pure key map serves the surface and every frame document, claiming undo, redo, panel toggle, nudge, and resize while a panel field keeps its letters
- Outlines and handles size against the zoom, and a frame Claude rewrites reloads alone with pan and zoom unchanged
- A `canvas editing` mark shows as a badge on the frame's label and lapses after five minutes, since a crashed session never clears it

### `src/canvas/client/inspector/`

The element inspector, whose fields are the keyboard path for edits.

- A field commits on Enter or leaving it, sends nothing when unchanged, and Escape restores it
- A commit writes the element's inline style or text and leaves the rest of the file alone, and writing `border-radius` or `padding` drops its longhands
- A token color writes `var(--name)`, or a `color-mix()` with `transparent` below full opacity, and any other picker change writes a hex
- The color picker edits in HSV and converts to LCH from published formulas rather than a dependency
- Fill writes `100%`, Fit writes `fit-content`, and the alignment grid maps its cells through `flex-direction`

### `claude/skills/canvas-board/`

Owns the procedure a session follows.

- Start the server before writing any frame, then fetch the printed address and check the shell, since a failed build answers `/` with an empty `200` while captures still pass
- Run `canvas fit` to set each box height from the rendered document, then `canvas arrange`, since a fit that grows a frame leaves the rows below overlapped
- `fit` flags `viewport` where a viewport unit sizes something, `font` where the body names a machine family, and `wide` for content past the box, and never widens a box
- `capture` runs through a server started for the call at the frame's layout width, and refuses a frame whose first text family is unset or generic
- A picked direction leaves for the project's design record, since `.canon/canvas/` is gitignored and nothing on it is citable from a tracked file

### Other folders

Two skills and one rule sit around the canvas.

- `claude/skills/draft-and-pick/` lays candidates out as frames on one page and takes the pick
- The opt-in rule `canvas` on `.canon/canvas/**` points at the `canvas-board` house style, is listed in no stack, and a project takes it with `--add canvas`

## Gotchas

- `canvas serve` refuses a missing dependency as `missing-client-deps`, so run the install in a fresh worktree first
- A saved edit reloads the frame twice and remounts the inspector, so a control that keeps focus retakes it on mount and an open popover keeps its state in module scope
- Happy-dom ignores stylesheets, drops `color-mix()`, and lacks `showPopover()`, so only the browser walk in `src/canvas/shell.e2e.test.ts` proves a rule applies
- A walk case asserts on a write request's JSON body and status, since reading the response body hung once the change event made the shell reread the page list
- A table without its `tbody`, or a `head` with no `body` after it, makes the browser build an element the file never states, and a pick there refuses as `address-mismatch`
