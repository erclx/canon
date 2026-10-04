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
- `src/canvas/client/inspector/` owns the inspector's field, section, size field, alignment grid, color field and picker, value formatting and color parsing, and its own stylesheet, composed by `inspector.tsx`
- `claude/skills/canvas/` owns the procedure a session follows
- `.canon/canvas/` at the main worktree root owns the content, gitignored

## Decisions

### Content format

- A page is a folder, a frame is one `.html` file in it, and `layout.json` beside them holds each frame's box. The markup stays a plain file so a session edits a frame the way it edits any other file, and the box lives apart so moving a frame never rewrites its markup.
- Every writer of `layout.json` takes a lock file beside it, reads, merges its change, and replaces the file in one rename. The server and a CLI verb are two processes, so a drag released while a verb writes would otherwise lose one of the two positions.
- `moveFrame` writes a position and `resizeFrame` writes a whole box, and the shell and the CLI share both. A top or left handle moves the frame as it resizes it, so the resize takes the box in one locked write rather than a move and a resize another writer could land between.
- The content resolves at the main worktree root from every worktree, the way every record folder does, so a session in a linked worktree draws on the canvas the operator has open rather than on a copy nobody serves.
- An element is addressed by its index in document order, with the frame file's hash beside it. The index shifts when the file changes, so a selection reports `stale` once the hash moves, and a pick or an edit made against an older hash is refused as `stale-address`. A table without its `tbody`, or a `head` with no `body` after it, makes the browser build an element the file never states, so the standard requires both and a pick there is refused as `address-mismatch`.

### Token resolution

The server injects one stylesheet first in each frame's `head`, so a frame drawn with `var(--color-*)` shows the project's values and a stylesheet the frame links still wins the cascade. The source is this toolkit's own token module inside its own checkout, else `.claude/design/base.css` plus anything under `.claude/design/project/`, else none with a notice. Parsing a `DESIGN.md` into custom properties was left out, since no mapping from its prose to properties exists. A frame lacking an `html`, a `head`, or a `body` gets each one written into the served bytes with `data-canvas-implied`, which the shell's count skips the way it skips the token stylesheet, while the file on disk is never rewritten. The server counts stay over the file alone, so the edit writer needs no change.

The installed branch embeds each vendored face its sheets name and rewrites each project `@font-face` file as a `data:` URI, confined to `.claude/design/project/` after `realpath`. The embed sits in `resolveFrameTokens` rather than in the server, because the frame route, the Theme tab's `/api/pages`, `canvas capture`, and the slides export all read that one function. Grouping the inlined sheet for the Theme tab measured 0.18 ms on the 245 KB base with its faces, so the tab groups the same string rather than a pre-inline copy. A served font route was the alternative and needed a second resolution path the capture would also have to reach.

### Color edits

The inspector writes a token at full opacity as `var(--<name>)` and below it as a `color-mix()` of that `var()` with `transparent`, so a token at any opacity keeps following the theme. Resolving the token to an eight-digit hex was the alternative and freezes the color at the theme it was picked in. A hex writes six digits at full opacity and eight below it. The token list sits behind the row's tokens icon and lists only the token sheet's color group, reading each swatch off a probe element in the frame rather than the token's text, since a token's value may itself be a `var()` or a mix.

The swatch opens the full picker, which edits in HSV so a grey keeps the hue the operator set, and converts to CIE LCH as CSS `lch()` defines it. The conversions are about 150 lines of published formulas in `inspector/color-space.ts`, since a picker library would add a dependency and bring its own DOM and keyboard model.

Any change but the alpha writes a hex, because a token's color cannot change from the inspector without editing the token. The alpha keeps a token through the `color-mix()` form. An LCH value outside sRGB clamps per channel and the rows show the color written. Chroma reduction maps the gamut more faithfully and waits.

### Selection handles

The selection overlay in `client/selection.tsx` draws the outline, four corner handles, and an element's size chip, and sizes each against `--outline-scale`, the inverse of the zoom the plane sets, so all of it holds one screen size. The frame label sizes the same way. A handle drag divides the pointer's travel by the zoom, since the delta arrives in screen pixels and the box is in surface units. A frame's overlay holds the corner opposite the handle, while an element's draws the element's own measured box during the drag, since an element in normal flow grows from its top left whichever handle moves.

An element resize is two edits through the inspector's writer, width then height, the second carrying the hash the first answered. A multi-property edit would have reached into the edit writer for one caller. Passing the answered hash rather than reading it back from state is what lets the second edit land when the frame reloads between the two, since a reload clears the stored hash.

### View tools and keys

The key layer is one pure map in `client/keys.ts`, called by the surface `<main>` and by every frame document, since a click inside a frame moves focus into its window and `handleLoad` has to forward its keys the way it forwards `wheel`. Only the surface or a frame feeds it, so a panel field keeps its letters, and a field inside a frame and Space on a focused button keep theirs too. The layer never claims a key release, because a button fires its Space activation there.

A Space pan lives in its own `spacePan` signal beside `activeTool`, so releasing Space restores the picked tool, and the strip lights the computed `shownTool`. While panning, every `.frame` and its descendants take `pointer-events: none`, since a selection handle sets its own and a Space drag starting on one resized the element. A pan press prevents the viewport's mouse press default, since a press read as a second click selected a word or a whole frame and painted it blue, and neither blocking a selection's start event nor a clear at pointer down reached that. The pan also blocks that start event and clears the selection in the shell and every frame document. A Pan tool press focuses the surface itself, so a field it leaves commits, while a press under a held Space leaves focus where the release will arrive. A focused frame selects on Space's release, and only when no drag moved the view. The strip floats inside the surface, so fit takes its width as a left inset.

### Layout edits

Writing `border-radius` or `padding` drops that shorthand's longhands from the same inline style, so switching radius from per corner back to one value takes one edit and no corner left behind overrides it. A longhand write leaves its shorthand, since the longhand comes later and wins. The table of shorthands sits beside the writer's property set and holds those two families alone.

Fill writes `100%` on either axis and Fit writes `fit-content`, one property per edit as the writer takes it. Fill is wrong for a row child sharing space, which needs `flex: 1` read off the parent's axis, and that waits until the operator meets it. The alignment grid posts `justify-content` and then `align-items` as two edits, the second carrying the hash the first answered with, and maps its cells through the container's `flex-direction` so a column swaps the axes.

### Typography edits

Family and size list their token group first, written as `var(--name)`, and a typed literal last, marked raw where the group holds any token. The groups are the Theme tab's `font-family` and `font-size`, so a sheet not following that naming lists nothing and the field takes a literal with no menu. A family shows the first name of its stack, unquoted, and posts nothing unless changed. A pasted `font-family: X;` line keeps its value alone, since the writer refuses the semicolon.

A browser computes a unitless line height to pixels, so the field shows a pixel value as its ratio to the font size and writes a typed number unitless. Its Auto writes `normal`, which is the keyword a line height takes. Letter spacing writes a bare number as pixels and runs below zero, so its scrub is unclamped, and both fields scrub in tenths. Alignment reads `start` and `end` through the element's computed `direction`, so the pressed side is the one the text paints on.

### Capture

- A frame capture goes through a server started for the call, so the injected tokens are in the image, and renders at the frame's layout width so a media query resolves there. It never captures the file on disk.
- A single-frame PNG is the frame's whole document, so its height follows the content. The composite page image places each frame at its layout position clipped to its box, so a frame's height there follows the box and can differ from its own PNG.
- The font check reads the first family of each rendered text element in the frame, so a frame may set its font on `html`, `body`, or any ancestor of its text. A frame that sets no font inherits the browser's default serif, which many machines lack, so the capture refuses it. The standard forbids assuming a default font for that reason. A generic keyword as the first family, such as `monospace`, fails the check as well, since it resolves per machine. A composite container holds no text, so the check skips it and it carries no font of its own.

### Skill

- The skill starts the server before writing any frame, then fetches the printed address and checks the shell itself. Captures go through the frame route, so a shell that failed to build answers `/` with an empty `200` while every capture still passes, and only the shell check notices.
- A picked direction leaves the canvas for the project's design document or wireframes. The canvas is a drafting surface, and its folder is gitignored, so nothing on it is citable from a tracked file.

### Editing mark

- A session marks the frame it is editing through `canvas editing`, and the server reads that record rather than inferring the state. A session writes a frame through its file, so the server sees nothing until the write lands, and a watch on the file only fires once the work is already there.
- The marks share one `editing.json` beside `selection.json`, keyed by frame, and each write merges its one key under the file lock. Several sessions can hold different frames at once, and replacing the whole map would drop a mark another session wrote in between.
- A mark lapses five minutes after it was last written. A session that crashes or compacts never clears its mark, so the expiry is the only thing that does, and its length bounds how long a dead mark misleads the operator. A frame rewrite takes seconds, so a long edit renews once.
- The mark gates no write. The frame hash check already refuses an inspector edit made against a file the session rewrote, so a lock would refuse the same collision twice.
- The shell shows a mark on the frame's board label and outline, not in the pages panel, since a frame being edited is something the operator watches on the board. A reread drops a cleared mark, and a client timer set for the earliest `until` drops a lapsed one, because an expiry writes no file and raises no change event.

### The static board retired

`canon design board` generated a static page set indexing six design surfaces, with a components panel framing a second Astro build of every site component. The canvas replaced it rather than joining it. That board only looked back at what the project already held, while the canvas is where an idea gets drawn before one is written into the design record. Keeping both meant one more generator to hold in step with every surface it indexed, for a page nobody drafted on.

The component gallery existed only for the board's components panel and retired with it, taking its second Astro config, its exclusion check, and its two workflow steps.

## Gotchas

- `canon records push` does not back `.canon/canvas/`, so a lost checkout loses every page. The skill promises nothing about survival until the backup covers it.
- The shell is bundled from `src/canvas/client/` at serve time, so `canvas serve` refuses a dependency missing from `node_modules` as `missing-client-deps`. Run the install in a fresh worktree before serving.
- `Bun.serve` with `development: false` turns port reuse on under Linux, so a second canvas binds beside one already listening and requests reach either process. The canvas bind sets it and so passes `reusePort: false`, which makes a held port refuse and the walk step past it. Any bind that sets `development: false` needs the same option.
- A stylesheet a client module imports reaches the served shell through the bundler with no `<link>` in `index.html`, as `inspector/fields.css` does. Happy-dom ignores stylesheets, so only the browser walk in `src/canvas/shell.e2e.test.ts` proves a rule applies.
- Happy-dom also drops a `color-mix()` value from an inline style, so `shell.test.tsx` cannot start a case from one. A behavior that starts there is covered by the unit parse in `inspector/values.ts` and by the browser walk.
- A saved edit reloads the frame twice, once on the edit's answer and once when the file watcher reports the write, and each reload remounts the inspector. A control that must keep focus across an edit takes it back on every mount until focus lands elsewhere, as the color row's controls do, and moves focus in a layout effect so a key typed straight after the opening one is not lost.
- A popover meant to stay open across its own write keeps its state in module scope, keyed by frame, element, and property, and reopens from it on mount, as the full color picker does. The field's focus-out close waits a tick and skips a field already detached, so the removal during a reload does not read as focus leaving.
- Happy-dom 20 has no `showPopover()`, so the inspector's popovers call it only where the browser has it, and the shell tests reach them as plain fixed elements. Preact runs a child's layout effect before its parent's, so a control inside a popover the parent shows in its own effect shows the popover itself before it takes focus.
- A browser computes `justify-content` and `align-items` as `normal` on a flex container left at its defaults, so the alignment grid reads `normal` and `stretch` as the start cell, and a click on that cell still writes it so the operator can pin a stretched row. Happy-dom returns only what the inline style set, so only the browser walk catches a default container showing no checked cell.
- The W and H mode menu is a transparent native `select` over a chevron rather than a popover, so its list opens above the panel's scroll clipping with no placement code and answers the keyboard as the platform does. The focus ring draws on the lane holding it, since the select itself is invisible.
- The writer reads a style attribute through `HTMLRewriter`, whose `getAttribute` returns the value with its entities still encoded and whose `setAttribute` escapes only `"`, as `&quot;`. A quoted font family comes back carrying `&quot;`, so the declaration splitter in `src/canvas/edit.ts` skips a character reference whole rather than splitting at its semicolon.
- The inspector's stylesheet and `shell.css` share one class namespace, and the Theme tab owns `.token`. A new inspector class takes its own prefix, as `.token-option` does, since a bare reuse restyles the Theme rows too.
- In the browser walk, reading a write route's response body through Playwright hung once the write's change event made the shell reread the page list. A walk case asserts on the request's own JSON body and the response status instead.
- `canon/wireframes/canvas.md` sits at the 300 rendered line ceiling, so the next addition to it cuts something first, and its States table renders each row at about 311 characters, four lines apiece, so one longer cell widens every row. Keep a new cell inside the widest one already there.
- The signals integration skips a component whose props did not change, so a signal only a parent reads does not re-render its children. `ElementDetails` reads `savedEdit`, which clears on a timer, so `ElementFields` can re-render in the middle of a drag, and a value a drag must hold is read at press rather than at render.
