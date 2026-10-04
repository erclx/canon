---
title: Canvas
description: The canvas server, its content format, and the verbs that list, arrange, select, edit, and capture frames
---

# Canvas

`canon canvas` serves a local canvas of pages and HTML frames and gives an agent the verbs the operator's mouse has. A page is a folder under `.canon/canvas/`, a frame is one HTML file in it, and `layout.json` beside them holds each frame's box. `standards/canvas.md` fixes that content format, and the `canvas` skill carries the procedure a session follows to drive the canvas.

## Serve

`canvas serve` serves the canvas on `127.0.0.1`, walks ports like `canon serve`, refuses a `Host` other than loopback on its own port, and runs until interrupted. Each frame gets the project's token stylesheet injected, being this toolkit's tokens in its own checkout, else `.claude/design/base.css` plus anything under `.claude/design/project/`, else none with a notice. An open canvas reloads a frame whose file changes.

The toolkit's own tokens arrive with the font faces they name embedded, so a frame renders in them on a machine that never installed them. An installed base owns its fonts and gets no faces added.

Before it binds a port, `canvas serve` checks that `preact` and `@preact/signals` resolve from the package the CLI runs from, never from the served project. When either is missing it refuses with reason `missing-client-deps` and names `bun install` in the detail, rather than serving a shell that loads as a blank page.

The write routes the shell posts to also refuse a request carrying an `Origin` other than the server's own, and a body that is not JSON.

## List and add

`canvas list --json` emits every page with its frames. `page add`, `page rename`, and `frame add` (`--width`, `--height`) each emit one record under `--json`, refusing a name that is not one path segment, a page that already exists, or a root that is not a directory, with the reason on stderr.

## Arrange and select

`frame move <page> <name> --x <px> --y <px>` rewrites one frame's position in `layout.json` and keeps its size. An omitted axis stays where the frame is. It refuses a frame or page that does not exist and a layout that does not parse.

`frame resize <page> <name> --width <px> --height <px>` rewrites one frame's whole box in one write, and `--x` and `--y` move it at the same time. An omitted flag keeps the frame's current value. It refuses a width or height that is not a positive number as `invalid-size`, a position that is not a number as `invalid-position`, and a missing frame, a missing page, or a layout that does not parse as `frame move` does.

The shell writes through the same writer when the operator drags a frame or one of its corner handles. Both take a lock file beside the layout, read it, merge their change, and replace it, so a drag released while a verb writes loses neither position. A writer that cannot get the lock within two seconds refuses with reason `busy`.

`canvas selection --json` emits `{ ok, selection }` with the page, frame, file, box, and path of the frame the operator selected, or `selection: null` when nothing is selected or the selected frame has since been removed. Read it when the operator says "this one".

The operator can also pick one element inside a frame, by clicking it on the surface or in the frame's layers tree. The selection then carries `element`, recording the `index` in document order, `tag`, `classes`, and `text` excerpt as they were at the pick. An edit to the frame since can shift that index onto another element, so `stale` turns true once the file's content no longer matches what the pick was made against. Check it before acting on the index.

A pick is refused as `address-mismatch` when the browser builds elements the file never states, such as a `tbody` a table leaves out or the document wrapper around a fragment. The shell sends its own element count beside the index, so a frame the two sides count differently is reported rather than recorded against the wrong element. A pick is refused as `stale-address` when the frame file changed between the frame being served and the pick arriving, since every served frame carries the hash of its file and the shell sends that hash back.

## Edit

`canvas edit <page>/<frame> --element <index> --set <property>=<value>` sets one property of the element at that index, the same index `canvas selection` reports. The properties are `text`, `color`, `background-color`, `font-size`, `font-weight`, `width`, `height`, `padding`, `gap`, `display`, `flex-direction`, `justify-content`, `align-items`, `flex-wrap`, `opacity`, `border-radius`, `border-top-left-radius`, `border-top-right-radius`, `border-bottom-right-radius`, and `border-bottom-left-radius`. A style property is written into the element's inline `style`, replacing that property and leaving the others as they were, and an empty value drops it. Writing `border-radius` or `padding` also drops that shorthand's longhands from the same `style`, so no corner or side left over overrides the new value. Writing a longhand leaves its shorthand in place, since the longhand comes later and wins.

`text` replaces the text of an element holding text alone and refuses one holding other elements as `not-text-only`. Every byte outside the element stays as it was. `--json` emits the page, frame, file, path, and the file's new `hash`.

The operator edits the same set from the inspector, which posts to the same writer with the hash the frame was served with. Dragging a selected element's corner handle writes `width` and then `height` in pixels through that writer, the second edit carrying the hash the first answered. An edit made against a version of the file Claude has since rewritten is refused as `stale-address` and the shell reloads the frame, so nothing lands on a shifted element. Both writers take the frame file's lock, and an edit that keeps the selected element where it was keeps the selection fresh.

A color picked from the project's tokens is written as `var(--<name>)`, and below full opacity as a `color-mix()` of that `var()` with `transparent` at the opacity percent, so it keeps following the theme. A browser older than 2023 drops a `color-mix()` value, which leaves the property unset there. A hex is written as six digits, or eight below full opacity. The inspector's full color picker writes a hex for any color it sets, so the field marks the value raw, and only its alpha keeps a token through the `color-mix()` form.

Inline style beats a class, so an operator's edit masks a class change Claude makes later. Read a frame's inline styles before restyling it, and remove one the change should replace. The inspector marks a color or background set inline with the word `raw` when its value names no `var()` and is not `currentColor` or a CSS-wide keyword, since that value stays fixed when the theme changes. A property outside the set, or a value carrying `;`, `{`, `}`, `<`, `>`, or a line break, is refused as `invalid-edit`.

The Theme tab in the shell lists what the token stylesheet defines, grouped as color, spacing, radius, font family, font size, and other. The page record at `/api/pages` carries the same list as `tokens.groups`.

## Capture

`canvas capture <page>/<frame>` renders one frame as a PNG, and `canvas capture <page>` renders every frame on the page. Each goes through a server started for the call, so the injected tokens are in the image, and renders at the frame's own width from the layout, so a media query resolves there. It never captures the file on disk.

`--out` is the PNG for a frame and a folder for a page, defaulting to session scratch. `--json` emits `{ ok, captures }` with the path and pixel size of each frame. Each PNG is the frame's whole document, so its height follows the document and not the frame's box. The font check `canon capture` makes applies, so a frame naming a font the machine lacks fails with that reason. A refused capture reports `no-page` or `no-frame` for a target that does not exist, `no-server` when the server for the call cannot start, and `capture-failed` for an error the engine throws, such as a browser that will not launch.

`canvas capture <page> --composite` renders the whole page as one PNG, with every frame at its layout position and its own width. The image is the union of the frame boxes with no padding, transparent where no frame sits, and frames that overlap paint in the board's order. It shows the frames only, with no captions and no selection outline. Each frame is clipped to its box as it is on the board, so its height can differ from the per-frame PNG, and each shows in its default theme, since the board's theme toggle is client state the capture never sees. The font check covers the composite page and not the documents inside its frames.

Under `--composite`, `--out` is the PNG itself, defaulting to `<page>.png` beside the per-frame folder in session scratch. `--json` emits `{ ok, composite }` carrying the page, the path, and the pixel size. The flag takes a page alone, and a `<page>/<frame>` target is refused as `invalid-name`. For the length of the call the generated page sits at `.canon/canvas/.composite/`, so it shares an origin with the frames, and the capture removes it after.
