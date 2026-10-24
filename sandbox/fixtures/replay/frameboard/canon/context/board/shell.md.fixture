---
title: Board shell
description: Home view, the board screen and canvas, Edit and Play, the panels, find, and the toolbar
---

# Board shell

## Overview

Owns the browser app around the frames, being the home view, the board screen and canvas, its panels, find, and the toolbar. Its look belongs to `canon/DESIGN.md`. Commands are in `canon/context/board/commands.md`, an agent's work on the board in `canon/context/board/agent-work.md`, and the server behind it in `canon/context/board/server.md`.

## Layout

### `src/client/home/`

Owns the home view, where every project shows as a card with a thumbnail of its frames or as a list row. Opening a card opens its board, and the board's home button is the one way back and between projects.

- A card shows the project's name and when it was last edited, and a list row adds the day `project.json` says it was made, empty for an older project
- A card's well fits its first page's frames as a group, each capture drawn over its white box, which stays the placeholder until one lands. A list row's mark draws the boxes alone
- `thumbnails.ts` asks for the shown theme's stamps on mount, a theme flip, a reconnect, and a frame new, resized, or reloaded. Each landing reaches the live store over the socket

The header and each card's menu run the `project.*` actions.

- The header carries the grid and list switch, New project, and the theme toggle, and an empty board shows the terminal command beside New project
- New project adds the next free `untitled` and opens its name in the rename field, and an `invalid-name` refusal stays inline under the field while any other raises the toast
- A right click, the menu key, or Shift+F10 on a card or row opens `project-menu.tsx`, and F2 and Delete rename and delete a focused card
- Of the `project.*` actions only `project.new` carries a palette command, since the palette takes focus off the card

### `src/client/board/`

Owns the board screen and its canvas, with `mode.ts` holding Edit, Play, the tool, and Hide UI, and `view.ts` the canvas view controller the zoom controls call. Selection on the canvas is described in `canon/context/board/hand-actions.md`.

- The Frame tool, key F, places an empty frame with its top left at the click, at the chosen phone 390, tablet 834, or desktop 1440 preset, then selects it and returns to Move
- In Play a frame behaves like a page, nothing selects, and notes and claim outlines hide
- Frames beyond one viewport of the view swap their iframe for a placeholder once a gesture rests 150 ms

### `src/client/board/left-panel/`

Owns the left panel, being its header with the way home and Hide UI, then the Design, Theme, and Assets tabs, with `page-actions.ts` registering the `page.*` actions.

- Design holds a pages list with a search and a layers tree, split by a divider that remembers its height, and Theme holds the project's tokens read-only
- A page is added after the current one, renamed on a double-click or F2 through `src/client/components/rename-field.tsx`, deleted with Delete, and dragged into place through `reorder.ts`
- Assets, in `src/client/board/assets/`, lists the project's `assets/` files as tiles with a thumbnail, name, and `<type> · <size>` line, and a tile click copies `../assets/<name>`, each segment encoded
- A drop on the tab, or the header's `+` picker, posts the files through `writeBoard`, and a tab with no write access shows why and adds nothing while a tile still copies
- Refusals show as an inline line under the drop hint rather than a toast, and a drop reloads every frame through the existing `assets/` watch

The layers tree lists the top of the stack first. A row click selects its frame and Shift-click adds it, a double-click or F2 renames it, a drag restacks it, and its eye and lock show on hover and stay while on. A hidden frame's row dims and does not select.

### `src/client/board/find/`

Owns find, being the panel Cmd+F puts in place of the left panel's tabs under the same header, its query, and the pick, which change together.

- `GET /api/find` searches the frame files through `src/server/edit/find.ts`, so a culled frame is found, matching frame names, element names, and each element's own text
- A hidden frame is left out, and an element named by its own text hits as text alone, so it is listed once
- Hits group by page, the page on the canvas when they arrived first, and a pick runs `board/jump.ts`, shared with the palette, selecting by the index and hash the search read
- The field owns Esc, since the registry skips keys typed in a field, and Cmd+F turns Hide UI off

### `src/client/board/chrome/`

Owns what floats over the canvas, being the toolbar, the Play banner, the Hide UI pills, the zoom control, and the avatar menu.

- The toolbar floats bottom center on the canvas column with Move, Hand, Frame, Note, Undo, Redo, Zoom to fit, the theme toggle, and the Edit and Play toggle
- A primary drag on the canvas pans only under the Hand tool

### `src/client/`

Owns the app shell and the controls around the canvas.

- The inspector header shows the zoom level and zoom menu, beside an avatar with the initials of git's `user.name`, which signs notes
- Both side panels resize by dragging from 200 to 400px, default 240, remember their width, and reset on a double-click
- Hide UI, through Cmd+\ or a button, hides both panels and keeps the project name, toolbar, avatar, and zoom level

### Other folders

The favicon files sit beside the app.

- `src/client/public/` owns the files served at the site root, being the favicon set rendered from `icon.svg`

## Gotchas

- A frame's script keeps its reach through `parent.document` and same-origin `fetch`, which the board accepts as the developer's own agents' work
- Pan and zoom write the layer's CSS transform from the `d3-zoom` handler, so a gesture renders nothing, and a plain wheel pans while a pinch, a wheel carrying `ctrlKey`, zooms
- Edit covers the frames with a hit layer so a press reaches the selection gestures, and Play lifts it, so a click focuses a frame's window, where the board binds Esc since its own keys never arrive
- `cn` reads the custom `text-body` and `text-label` steps as colors, keeping a kit part's `text-sm` beside one but dropping one before a color. Use `text-xs` for 12px, `text-[11px]` for 11px
