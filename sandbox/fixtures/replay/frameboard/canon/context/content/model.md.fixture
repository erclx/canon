---
title: Content model
description: Board folders, projects, pages, frames, layout files, assets, and how an element is addressed
---

# Content model

## Overview

Owns what sits on disk and how Frameboard reads it, being the board folder, the projects, pages, and frames inside it, each page's layout file, each project's assets, and the address of one element inside a frame. Everything else in the tool reads and writes through this model.

## Layout

### `src/shared/`

Owns the types and schemas for the layout file and every record the CLI and server exchange, with the schemas under `src/shared/records/`.

- Every record carries `"version": 1` and reads through a loose schema, so a newer Frameboard's keys survive a write by an older one
- Projects, pages, and frames share one name rule in `src/shared/names.ts`, so the verbs and the naming check agree on which names are valid
- Two names collide when they match case-insensitively, because the default macOS volume is case-insensitive, and `assets` is reserved as a page name
- `project.json` gains a `createdAt` once, from `project add` or the first `serve` of an empty folder, and an older project reads as made at no time, never at a file's birth time

### `src/server/board/`

Owns reading, watching, and writing the board folder. A board folder is whatever one server shows, sitting in a repository as `.frameboard/`, standalone, or at any path through `--root`.

- A project is a folder in the board folder, not a repository, a page is a folder in a project, and a frame is one `.html` file in a page
- Each page holds `layout.json` keyed by frame name and a `notes.json` of pinned notes, both beside the frames, since writing a note into one would shift every element address after it
- A frame file with no layout entry reads as unplaced at desktop size and 80 px past the last placed frame, and `frame add` persists the same box through `placeNext`
- Frame order is stacking order, so reordering in the layers panel changes what draws on top and leaves positions alone, while pages reorder in the pages list
- `board.json` lets a verb find a standalone board by walking up from the working folder, and a project's `project.json` lists its pages in display order and may hold `checks`

### `src/server/edit/`

Owns the edit writer, which parses a frame with parse5 and writes new bytes only inside the edited attribute value or text span. It never serializes the tree, which rewrites the file's formatting, and never uses Bun's `HTMLRewriter`, which Node lacks.

- Every reader addresses an element by its `querySelectorAll('*')` index plus the SHA-256 hex of the file's raw bytes, skipping in a live frame the `data-frameboard` elements spliced into `head`
- An element's name is its `data-name`, else a text-only element's text cut to 40 characters, else an `img`'s `alt`, else its tag, and `elementTree` returns each name and parent under `body`
- An edit against a hash the file no longer has is refused as stale, so a hand edit never lands on an element an agent has since moved
- The writer parses its own output again and refuses `verify-failed` unless the tree differs only at the target, so an input the guards never met is refused rather than written corrupted
- A note anchors to a frame or to an element by its address, and falls back to the frame when the file's hash has changed

### `src/server/notes/`

Owns the notes record, its anchors, and delivery to a listening session, apart from `board/` since the three change together.

- `<page>/notes.json` is `{ version: 1, notes }`, each note naming its `frame`, `anchor`, `text`, `from`, `author`, `session`, `to`, `state`, and `thread`, with its times
- An id is `n_` and 8 hex characters, unique across the board, so a verb finds a note by scanning every page's file, and `number` is one past the page's highest on a root note and `null` on a reply
- A reply is a note in the same file, `thread` naming its root, so the agent's answer needs no second store
- `state` is `open`, `queued`, `delivered`, or `done` on a root, a reply carries `open`, and a developer reply naming a session re-queues the root to it
- Every writer, being the board routes, delivery, and the `notes` verbs, goes through `updateRecord`'s lock, and a file that does not parse is refused as `notes-invalid`, never overwritten

### Other folders

Project files sit beside the pages.

- `assets/` in a project owns images, GIFs, video, SVG, fonts, and stylesheets that any frame may link, and is the one path outside a page a frame may use
- A drop into `assets/` accepts images, GIF, SVG, video, audio, fonts, stylesheets, and scripts, and refuses HTML and the rest by name
- A dropped name is cut to the board's name rule, and one already taken in any letter case takes the first free `-2`, `-3`, so a drop never overwrites a file an agent wrote
- Lock files, temp files, and dot folders hold generated files, and the watcher and scanner skip them, the watcher reading `.run/claims.json` alone

### `.run/`

Holds what a running board writes about itself, and ignores itself through its own `.gitignore`.

- The address file `serve` writes holds the URL, pid, and token at mode 0600, beside the claims `editing` writes
- `.run/thumbnails/` holds the home view's captures by frame and theme, emptied at each start, since a frame edited while no server ran would show a stale one
- `.run/board-key.json` holds the board key at mode 0600 and survives restarts, so a tab's cookie does too. Deleting it and restarting `serve` revokes every board's cookie

## Gotchas

- Every writer of `layout.json` takes a lock file beside it, merges, and replaces atomically, since two writers replacing the whole file each lose the other's edit
- A layout that does not parse is a defect to report, never an empty file to overwrite, since overwriting erases every box it held
- A frame that states a `head` must state a `body`, and every table its `tbody`, because the browser builds a missing one and shifts every address after it
- A stylesheet several pages use goes in `assets/`, never in one page folder, since that folder is renamed, moved, and deleted with its page
- The edit writer swaps a leading BOM for a space and refuses bytes that fail a UTF-8 round trip, since either would shift the parse or rewrite bytes far from the target
