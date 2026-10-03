---
title: Canvas
description: The canvas server, its content format, and the verbs that list, arrange, select, and capture frames
---

# Canvas

`canon canvas` serves a local canvas of pages and HTML frames and gives an agent the verbs the operator's mouse has. A page is a folder under `.canon/canvas/`, a frame is one HTML file in it, and `layout.json` beside them holds each frame's box.

## Serve

`canvas serve` serves the canvas on `127.0.0.1`, walks ports like `canon serve`, refuses a `Host` other than loopback on its own port, and runs until interrupted. Each frame gets the project's token stylesheet injected, being this toolkit's tokens in its own checkout, else `.claude/design/base.css` plus anything under `.claude/design/project/`, else none with a notice. An open canvas reloads a frame whose file changes.

The write routes the shell posts to also refuse a request carrying an `Origin` other than the server's own, and a body that is not JSON.

## List and add

`canvas list --json` emits every page with its frames. `page add`, `page rename`, and `frame add` (`--width`, `--height`) each emit one record under `--json`, refusing a name that is not one path segment, a page that already exists, or a root that is not a directory, with the reason on stderr.

## Arrange and select

`frame move <page> <name> --x <px> --y <px>` rewrites one frame's position in `layout.json` and keeps its size. An omitted axis stays where the frame is. It refuses a frame or page that does not exist and a layout that does not parse.

The shell writes through the same writer when the operator drags a frame. Both take a lock file beside the layout, read it, merge their change, and replace it, so a drag released while a verb writes loses neither position. A writer that cannot get the lock within two seconds refuses with reason `busy`.

`canvas selection --json` emits `{ ok, selection }` with the page, frame, file, box, and path of the frame the operator selected, or `selection: null` when nothing is selected or the selected frame has since been removed. Read it when the operator says "this one".

## Capture

`canvas capture <page>/<frame>` renders one frame as a PNG, and `canvas capture <page>` renders every frame on the page. Each goes through a server started for the call, so the injected tokens are in the image, and renders at the frame's own width from the layout, so a media query resolves there. It never captures the file on disk.

`--out` is the PNG for a frame and a folder for a page, defaulting to session scratch. `--json` emits `{ ok, captures }` with the path and pixel size of each frame. Each PNG is the frame's whole document, so its height follows the document and not the frame's box. The font check `canon capture` makes applies, so a frame naming a font the machine lacks fails with that reason. A refused capture reports `no-page` or `no-frame` for a target that does not exist, `no-server` when the server for the call cannot start, and `capture-failed` for an error the engine throws, such as a browser that will not launch.
