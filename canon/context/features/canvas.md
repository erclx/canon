---
title: Canvas
description: The canvas server, the page and frame content format, token resolution into frames, capture, and the skill and standard that drive it
---

# Canvas

## Overview

`canon canvas` serves a local surface of pages and HTML frames that the operator drags, selects, and edits in the browser, and gives an agent a verb for each thing the mouse does. The `canvas` plugin skill tells a session how to drive it, and `standards/canvas.md` fixes the content format both sides write. The verb reference, with every record and refusal, is `docs/agents/canvas.md`.

## Layout

- `src/canvas/` owns the server, the content reader and writers, element addressing, the inline-style editor, token resolution, and capture
- `src/canvas/client/` owns the browser shell, built by Bun's HTML bundler when the server starts
- `claude/skills/canvas/` owns the procedure a session follows
- `.canon/canvas/` at the main worktree root owns the content, gitignored

## Decisions

### Content format

- A page is a folder, a frame is one `.html` file in it, and `layout.json` beside them holds each frame's box. The markup stays a plain file so a session edits a frame the way it edits any other file, and the box lives apart so moving a frame never rewrites its markup.
- Every writer of `layout.json` takes a lock file beside it, reads, merges its change, and replaces the file in one rename. The server and a CLI verb are two processes, so a drag released while a verb writes would otherwise lose one of the two positions.
- The content resolves at the main worktree root from every worktree, the way every record folder does, so a session in a linked worktree draws on the canvas the operator has open rather than on a copy nobody serves.
- An element is addressed by its index in document order, with the frame file's hash beside it. The index shifts when the file changes, so a selection reports `stale` once the hash moves, and a pick or an edit made against an older hash is refused as `stale-address`. A frame written as a fragment or a table without its `tbody` makes the browser build elements the file never states, which is why the standard requires whole documents.

### Token resolution

The server injects one stylesheet first in each frame's `head`, so a frame drawn with `var(--color-*)` shows the project's values and a stylesheet the frame links still wins the cascade. The source is this toolkit's own token module inside its own checkout, else `.claude/design/base.css` plus anything under `.claude/design/project/`, else none with a notice. Parsing a `DESIGN.md` into custom properties was left out, since no mapping from its prose to properties exists.

### Capture

- A frame capture goes through a server started for the call, so the injected tokens are in the image, and renders at the frame's layout width so a media query resolves there. It never captures the file on disk.
- A single-frame PNG is the frame's whole document, so its height follows the content. The composite page image places each frame at its layout position clipped to its box, so a frame's height there follows the box and can differ from its own PNG.
- The font check reads the first family on the frame's `html` element. A frame that sets no root font inherits the browser's default serif, which many machines lack, so the capture refuses it. The standard requires a root font for that reason.

### Skill

- The skill starts the server before writing any frame, then fetches the printed address and checks the shell itself. Captures go through the frame route, so a shell that failed to build answers `/` with an empty `200` while every capture still passes, and only the shell check notices.
- A picked direction leaves the canvas for the project's design document or wireframes. The canvas is a drafting surface, and its folder is gitignored, so nothing on it is citable from a tracked file.

## Gotchas

- `canon records push` does not back `.canon/canvas/`, so a lost checkout loses every page. The skill promises nothing about survival until the backup covers it.
- The shell is bundled from `src/canvas/client/` at serve time, so a dependency missing from `node_modules` serves a blank shell rather than refusing. Run the install in a fresh worktree before serving.
