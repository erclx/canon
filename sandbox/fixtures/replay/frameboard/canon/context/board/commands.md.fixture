---
title: Commands
description: The action registry, the command palette and shortcuts sheet, and undo and redo
---

# Commands

## Overview

Owns how every button, menu item, and key reaches the board, being the action registry, the Cmd+K palette and `?` shortcuts sheet that list it, and the undo and redo actions. What an action does belongs to the entry owning its surface.

## Layout

### `src/client/actions/`

Owns the action registry every toolbar button, menu item, and key runs through, and the palette and shortcuts sheet read.

- An action is `{ id, label, group, keys?, run, enabled?, checked?, command? }`, a row registers its own and removes them on unmount, and a row needing a field adds it as optional
- `command` is the label and icon the palette shows, and the palette lists only enabled actions carrying it, so a row opts each action in and a key nobody runs by name stays out
- A control whose action no row has registered yet renders disabled with its name and key, so it lights once that row registers
- `bindKeys` binds the registry into the board window at start and into a frame's window in Play, Esc alone there
- A key shared by several actions runs the first registered whose `enabled` is true, so each row's `enabled` has to be honest about its mode for Esc to mean one thing at a time

### `src/client/palette/`

Owns the two overlays that list the registry, being Cmd+K's command palette and the `?` shortcuts sheet, mounted once over both routes.

- Cmd+K jumps to any project, page, or frame and runs board actions such as new page, theme toggle, and zoom, while inspector edits stay in the inspector
- The palette shows Frames with their page, Pages, Actions with their key chips, and Projects, and the home view lists Projects and app-level actions alone
- A frame row sets the selection on its page, navigates, and runs `view.zoomToSelection` once the page's canvas attaches, and a hidden frame has no row, since the next board would prune it
- `palette.open` and `help.shortcuts` register at the app level in `main.tsx`, and `overlay.ts` holds which overlay is open
- The sheet reads each key from the registry and greys a row whose action no row has registered yet, while gesture rows carry their own text

### `src/client/history/`

Owns `edit.undo` on Cmd+Z and `edit.redo` on Cmd+Shift+Z, registered for the whole app since the home view undoes too, lit from the server's `history` counts and following the page an undo brings back.

## Gotchas

- `bindKeys` skips a press inside a field or an open dialog, which keeps Esc from the palette and the sheet off `selection.clear` and `mode.exitPlay`
