---
title: Hand actions
description: Selection, undo and redo, hide and lock, arranging and snapping, copying a frame as an image, right-click menus, and the keys behind each
---

# Hand actions

## Overview

Owns what the developer does to frames by hand outside the inspector, being selection, undo and redo, hide and lock, arranging, copying, the right-click menus, and the key or drag behind each.

## Layout

### `src/client/board/element/`

Owns picking, walking, and outlining an element, and with the board folder's `selection.ts` the selection keys and menus on the canvas. Selecting writes nothing, so element addresses stay put, the way Figma and Paper both work.

- A click selects the frame, and Cmd-click or a double-click selects the element under the cursor. Enter goes one level down, Esc one level up, and Tab steps through siblings.
- Shift-click or a marquee drag selects several frames, and move, nudge, align, duplicate, copy, cut, hide, lock, and delete act on all of them
- Arrow keys nudge a frame, Cmd with an arrow resizes it, and Cmd+C, Cmd+X, and Cmd+V copy, cut, and paste frames into any project's current page
- Alt+A, D, W, S align, Alt+H and Alt+V center, and Ctrl+Alt+H and Ctrl+Alt+V distribute, each writing the page's layout alone
- Cmd+Shift+H hides, Cmd+Shift+L locks, and Cmd+Shift+C copies a frame as a PNG in the theme on screen, rendered by the browser `capture` uses

Enter at a frame selects the first child of its `body`, and Esc at a child of `body` selects the frame, so the next Esc clears the selection. Tab wraps within the parent, and Enter and Tab walk only while focus sits on the canvas. Esc closes an open note card before it moves the selection.

An element selection holds the hash the frame rendered, and a reload showing other bytes drops it to the frame, since an agent's write may have shifted every index. Bytes the board's own hand edit or undo left the frame at keep it, as does a reload landing while that write is in flight, since the reload of the bytes it answered is still to come.

### `src/client/board/menus/`

Owns the right-click menus on a frame, the selected element, empty canvas, a page row, and a layers frame or element row, which change together. Each item runs a registered action, greys while it is disabled, and shows that action's key, or the key of the one it stands in for.

- A right-click on a frame not yet selected selects it alone first, and one on the frame around the selected element selects the frame, so an item acts on the selection the way its key does
- Paste here shows Paste's key, sends the right-clicked point with the paste to place the group's top left there, and New frame here and Add a note here act at that point too
- A page row's menu moves the canvas to that page first, since the `page.*` actions act on the page shown, and New page below runs `page.new`
- Flip to light or Flip to dark ends every selected frame in the theme opposite the right-clicked one, lasting until reload and writing nothing
- The menu key and Shift+F10 open a row's menu with focus inside, and a Ctrl-press the gestures keep for snapping opens none

### `src/client/board/structure/`

Owns the frame structure actions, being rename, duplicate, delete, hide, lock, copy, cut, and paste, and the Frame tool, which change together. Copy, cut, and Copy as PNG toast once they land, since nothing on the canvas shows them, and a refused write raises one error toast from its caller.

- Each acts in Edit while the tab may write, on the frames selected on the canvas's page, and none acts while an element is selected, so Backspace never deletes a frame the developer sees as an element
- Delete and cut stay disabled while a selected frame is locked, and the server refuses both with `frame-locked` if sent anyway
- The server holds the clipboard, being each copied frame's bytes and layout entry in memory, so a paste never reads the source and a restart empties it. A cut is a copy and a delete in one undo step.
- A paste lands on the page on the canvas, keeping each frame's box on another page and sitting beside its source on its own, and takes the next free name rather than writing over a frame by that name
- Paste stays disabled until a copy or cut, and again once the socket drops, since the server may have restarted

### `src/client/board/geometry/`

Owns turning pointer and keys into frame boxes, apart from the canvas's pan and zoom.

- `gestures.ts` binds `d3-drag` to the hit layer beside the viewport's `d3-zoom`, and `draw.ts` writes the overlay's DOM from the drag handler
- `snap.ts`, `arrange.ts`, `resize.ts`, and `hit.ts` are pure, and `actions.ts` registers the selection, nudge, and arrange keys
- `write.ts` holds a released box as pending until the server's next board carries it, and sends every hand move or resize through `POST /api/frames/boxes`
- A dragged or resized frame snaps to other frames' edges and centers, and holding Ctrl turns snapping off
- A box edit on a held frame stays pending until the claim drops, then goes with the first `expected` it started from, even after a newer edit replaced it

### `src/server/history/`

Owns the edit history undo reads. Undo and redo cover hand edits, moves, resizes, reorders, renames, adds, duplicates, and deletes, held as small before-and-after records.

- A board verb handed a `Journal` from `src/server/board/journal.ts` reports each change it made, and `History.record` keeps them as one step, at most 100 steps deep
- A change is one layout entry, one page order, one rename, or one path with its content hash, so an agent's write elsewhere in the same file neither blocks an undo nor is reverted by it
- A hand edit in a frame is one change holding the whole file before and after, so its undo restores the file only if nothing wrote it since, and answers the hash it left so the element stays selected
- Every change of a step is checked under its records' locks before any is written, and an undo whose target an agent changed later is refused with `undo-overtaken`, dropped, and named in a toast
- A delete moves the path into `.run/trash/<step>/`, so its undo is a rename back, and the history and the trash both empty when the server starts and stops

Only the board's own writes record. The CLI verbs pass no journal, and neither do a note write or an asset drop, so an agent's change never enters the developer's history.

## Gotchas

- Hide and lock are flags in the page's layout and never write into the frame, so neither binds the agent, whose writes the claim and the file hash govern
- A hidden frame leaves the canvas and composite captures but stays in the layers panel, and a locked one still selects from there
- Elements cannot be hidden, because that would write `display` into the frame, which is layout
- A press on a selected element's outline or corner marks does nothing, and the frame's corners take no resize while an element is selected, since their handles are hidden then
- A hand box write sends the boxes the gesture started from, and the server refuses the whole write with `stale-layout` when an agent moved a frame since, or `frame-locked` for a locked one
