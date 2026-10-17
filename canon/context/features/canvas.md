---
title: Canvas
description: The canvas server, the shell's regions, states, and behavior, the page and frame content format, token resolution into frames, capture, and the skill and standard that drive it
---

# Canvas

<!-- canon-length-exempt: the canvas has outgrown one entry and splits into a folder of sub-areas next, a change of its own rather than one more feature's -->

## Overview

`canon canvas` serves a local surface of pages and HTML frames that the operator drags, selects, and edits in the browser, and gives an agent a verb for each thing the mouse does. The `canvas-board` skill tells a session how to drive it, and `claude/skills/canvas-board/references/canvas.md` fixes the content format.

The canvas exists for Claude to draw frames the operator reviews. No further design-tool features are added unless the operator asks, so a later planner does not propose new inspector or navigation features unprompted. The verb reference is `docs/agents/canvas.md`.

## Layout

- `src/canvas/` owns the server, the content reader and writers, element addressing, the inline-style editor, token resolution, capture, fit, and arrange
- `src/canvas/client/` owns the browser shell, built by Bun's HTML bundler when the server starts
- `src/canvas/client/inspector/` owns the inspector's fields, sections, alignment grid, color field and picker, value formatting, and stylesheet, composed by `inspector.tsx`
- `claude/skills/canvas-board/` owns the procedure a session follows
- `.canon/canvas/` at the main worktree root owns the content, gitignored

### Surface

The shell shows one project's pages and the frames on each. Its chrome follows the system theme until the operator picks one, and the pick is remembered for the next visit. The frame's own markup is the frame's HTML file and is never restated here.

### Regions

The shell has thirteen regions.

| Region          | Holds                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pages panel     | Left column with the brand line and theme toggle, then the Pages and Theme tabs. The Pages tab holds the page list and the current page's frame list               |
| Theme tab       | In place of the lists, the project's tokens under a label per group (color, spacing, radius, font family, font size, other), a swatch beside a color. Read-only    |
| Layers          | Under a frame's row, opened by its disclosure, the frame's element tree from its body down, one row per element reading `tag.class` and a leaf's text              |
| Surface         | Between the panels, every frame of the current page at its box                                                                                                     |
| Frame label     | One line above each frame with name, size, editing badge, and theme switch, the frame's handle at one screen size at any zoom                                      |
| Tool strip      | Surface top left. Move over Pan with the active one lit, Undo over Redo disabled when there is nothing to step, then the panel toggle                              |
| Zoom toolbar    | Surface bottom right with zoom out, the level, zoom in, and fit                                                                                                    |
| History notice  | Surface top center once an undo or redo drops an entry                                                                                                             |
| Panel handles   | On each panel's inner edge, drawn in the accent on hover, focus, or drag                                                                                           |
| Element outline | Dashed around the element under the pointer, drawn over the frame                                                                                                  |
| Selection       | A thin outline with a square handle on each corner at one screen size. A selected frame's name takes the accent, and an element carries its rounded size in a chip |
| Details panel   | Slim right column with the frame inspector, then the page's name and frame count, then where the frames' tokens come from                                          |
| Inspectors      | The frame inspector shows name and x, y, width, height read-only. Below it, a selected element's `tag.class` over six titled sections in a two-column grid         |

A label row too short for every part drops the theme switch first, then the badge, then the size, before it shortens the name. Each inspector field starts at the element's inline value, else its computed one.

### Inspector sections

The six sections are Layout, Flex, Appearance, Typography, Fill, and Text.

| Section    | Holds                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Layout     | x and y read-only, width and height as a number, Fill, or Fit, then padding |
| Flex       | Alignment, direction, wrap, and gap, else an add button                     |
| Appearance | Opacity and radius                                                          |
| Typography | Family, size, weight, spacing, and alignment                                |
| Fill       | Color and background as swatch, hex, opacity, tokens, and eyedropper        |
| Text       | The element's text, read-only over children                                 |

A field is a bordered box with a short glyph inside its left edge, such as `W`, and the value right of it. A section header keeps an empty lane at its right for later buttons.

Below 900 wide the details panel is hidden and the pages panel narrows to a fixed width with no handle. Below 600 wide the pages panel stacks above the surface, capped at a share of the height and scrolling on its own.

### States

The `assets/evidence/canvas/arrange/`, `layers/`, and `shell/` folders hold the captures the capture and visual-check workflows read. A state with no capture says so.

| State              | What happens                                                                                                                      | Capture    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| filled             | The page holds at least one frame. Every frame sits at its box with the page selected in the list                                 | none       |
| no-pages           | No page exists. The page list gives way to the add-a-page line and the frame list is absent                                       | none       |
| empty-page         | The page holds no frame. The frame list gives way to the add-a-frame line over an empty surface                                   | none       |
| unplaced           | A frame file has no box in the layout. It sits in a row after the placed ones with a count at right                               | none       |
| malformed          | The layout file does not parse. Every frame sits in a default row with an alert at right naming the file                          | none       |
| no-tokens          | No token stylesheet resolves. Frames stay unstyled and the details panel names where tokens would go                              | none       |
| unreachable        | The page list cannot be read. The panel gives way to one line saying to check the server is running                               | none       |
| light and dark     | The system prefers one or the operator picks it, and the chrome takes that ground                                                 | none       |
| frame-switched     | The operator switches one frame's theme from its label. That frame takes the other theme while the chrome and the rest stay put   | none       |
| selected           | The operator presses a frame's label or picks it in the list. It is outlined with handles, its name in the accent, its row marked | `arrange/` |
| element-hover      | The pointer rests on an element or a layer row. A dashed outline surrounds it on the surface                                      | `layers/`  |
| element-selected   | The operator clicks an element or its layer row. Outline with handles and a size chip, row marked, values fill the inspector      | `arrange/` |
| element-stale      | The frame file changed since the pick. No outline or marked row, and the inspector says the pick may now name another element     | `layers/`  |
| element-mismatch   | The browser and the file count the frame's elements differently. The pick is refused with an alert in the details panel           | `layers/`  |
| dragging           | The operator moves a pressed frame. It follows the pointer and its x and y update in the inspector                                | `arrange/` |
| resizing           | A corner handle drag. A frame grows from its held far corner and an element from its top left, with its size shown                | none       |
| editing            | A session marks the frame until it clears the mark or it expires. A badge names the session and a dashed outline surrounds it     | `arrange/` |
| write-failed       | The server refuses a move or selection. The frame returns to its stored place and an alert shows in the details panel             | none       |
| edited             | The operator commits a field or token. The frame reloads with the change and `Saved` shows beside the element label               | none       |
| edit-refused       | The server refuses an edit, as when the file changed. The frame reloads, the typed value is dropped, and an alert says so         | none       |
| undo-dropped       | An undo or redo finds its target changed. Nothing is written, the entry is gone, and the history notice says so                   | `shell/`   |
| panels-hidden      | The panel toggle or its key. Both panels go and the surface takes the full width with the frames held still                       | `shell/`   |
| panels-resized     | A panel handle drag or arrow key. That panel takes the new width with the frames held still                                       | none       |
| theme, theme-empty | The Theme tab is picked. Token groups replace the lists, or one line says no tokens resolve, then the server's notice             | none       |

### Behavior

Pages, frames, and the surface respond to the operator and to Claude's writes.

- Picking a page shows its frames and fits them into the surface. Picking a frame in the list selects and centers it at the current zoom, and pressing one on the surface marks its row.
- Dragging the empty surface, or scrolling anywhere on it frames included, pans it, and scrolling with the control key held zooms about the pointer
- A frame file Claude rewrites reloads that frame alone with pan and zoom unchanged, and a frame or page Claude adds appears with no refresh
- A frame Claude moves or removes updates the surface and the inspector, and a removed frame leaves nothing selected

### Selection and keys

Selection is written to the project so Claude reads it as "this one".

- Pressing a frame's label selects it and drops any element picked inside it. One frame is selected at a time.
- Dragging a frame by its label moves it, and releasing writes the new position to the page's layout. A press that never moves writes nothing.
- Clicking inside a frame selects the element under the pointer and its frame, and goes no further, so a link or a button in the frame does nothing
- Picking a layer row selects the same way, and selecting on the surface opens the frame's layers and marks its row
- With a frame focused, Enter or a Space released with no pan selects it, and the arrow keys nudge it, further with Shift. Control or Command with an arrow resizes.

### Editing a field

The inspector fields are the keyboard path for edits.

- Dragging a selected element's corner handle previews its size in the frame, then writes width and height on release
- A field commits on Enter or on leaving it, a value left as it started sends nothing, and Escape puts it back
- Dragging a number field's glyph scrubs it, previewed in the frame and written once on release, and a cancelled drag puts both back
- A committed field writes into the element's inline style or its text and leaves the rest of the file as it was
- Fields hold while an edit is in flight and take the file's values once the frame reloads

### Theme and panels

The Theme tab lists what the token stylesheet defines and edits nothing. A frame's theme switch flips that frame alone, and the toggle in the pages panel flips the chrome.

The panel toggle, or backslash with the canvas focused, hides both panels. A drag or an arrow key on a handle resizes its panel and never squeezes the surface out.

### Not on this surface

Four things are deliberately absent.

- No shadows, constraints, effects, or components, since the inspector edits the basic set alone
- No token editing, since the Theme tab only lists them
- No project tabs, since one canvas serves one repository
- No capture control on the surface

## Decisions

### Content format

A page is a folder, a frame is one `.html` file in it, and `layout.json` beside them holds each frame's box. The markup stays a plain file so a session edits a frame the way it edits any other file, and the box lives apart so moving a frame never rewrites its markup.

The content resolves at the main worktree root from every worktree, the way every record folder does, so a linked-worktree session draws on the canvas the operator has open rather than a copy nobody serves.

### Layout writes

Every writer of `layout.json` takes a lock file beside it, reads, merges its change, and replaces the file in one rename. The server and a CLI verb are two processes, so a drag released while a verb writes would otherwise lose one of the two positions.

`moveFrame` writes a position and `resizeFrame` writes a whole box, and the shell and the CLI share both. A top or left handle moves the frame as it resizes it, so the resize takes the box in one locked write rather than a move and a resize another writer could land between.

### Element addressing

An element is addressed by its index in document order, with the frame file's hash beside it. The index shifts when the file changes, so a selection reports `stale` once the hash moves, and a pick or edit against an older hash is refused as `stale-address`.

A table without its `tbody`, or a `head` with no `body` after it, makes the browser build an element the file never states. The standard requires both, and a pick there is refused as `address-mismatch`.

### Token resolution

The server injects one stylesheet first in each frame's `head`, so a frame drawn with `var(--color-*)` shows the project's values and a stylesheet the frame links still wins the cascade.

- The source is this toolkit's token module inside its own checkout, else `.claude/design/base.css` plus `.claude/design/project/`, else none with a notice that still carries the embedded faces
- Parsing a `DESIGN.md` into custom properties was left out, since no mapping from its prose to properties exists
- A frame lacking an `html`, `head`, or `body` gets each written into the served bytes with `data-canvas-implied`, which the shell's count skips. The file on disk is never rewritten.
- The server counts stay over the file alone, so the edit writer needs no change

### Embedded faces

Every source embeds the toolkit's vendored faces, `Geist Variable`, `Noto Sans Mono`, `Virgil`, and `Excalifont`, whether or not a sheet names them. The installed branch rewrites each project `@font-face` file as a `data:` URI, confined to `.claude/design/project/` after `realpath`, and a project face of the same family wins.

- The same frame measured 2,328px tall in DejaVu Sans, the WSL capture's fallback, and 2,640px in Segoe UI, a Windows browser's, so a height fitted in one is 13% short in the other
- Serving the faces makes the capture browser and the viewer render one face, which lets `canvas fit` measure in the capture browser and trust the result
- Embedding only the faces a sheet names was the earlier decision. It was reversed because a frame naming `Geist Variable` in a project whose sheets never do rendered in the fallback.
- The cost is about 233 KB of inline faces per frame, page weight on a local server and nothing more

### Where the embed sits

The embed sits in `resolveFrameTokens` rather than in the server, because the frame route, the Theme tab's `/api/pages`, `canvas capture`, and the slides export all read that one function.

Grouping the inlined sheet for the Theme tab measured 0.18 ms on the 245 KB base with its faces, so the tab groups the same string rather than a pre-inline copy. A served font route needed a second resolution path the capture would also have to reach.

### Fit

`canvas fit` loads each frame through the served address at its box width, reads the document's scroll height and width after `document.fonts.ready` and the load event, and sets the box height to that height. The viewport is one pixel tall, since a document shorter than the viewport reports the viewport and a frame could never shrink.

- Scroll height cannot tell a single `100vh` section from short content in a taller viewport, so fit reads the lowest element edge in the body at the box height and at twice it
- An edge that moved means a viewport unit is sizing something, so the row carries `viewport` and its height is kept
- Elements are read and the body itself is not, so a `min-height: 100vh` body over real content is not flagged
- Fit measures in the capture browser because the served faces make the two match

### Fit flags

A frame whose body text names a machine family such as `DejaVu Sans` is reported with the `font` flag and never refitted on a guess, since its height holds only on the machine that measured it. The served set is read off the same sheet the server builds, so a face a project declares counts as served.

Content wider than the box is reported as `wide` and the box is never widened, because the width is the frame's declared render width. Fit writes through `resizeFrame`, the writer the operator's drags share, so it takes the same lock.

### Arrange

`canvas arrange` groups boxes into rows by vertical overlap rather than an equal `y`, so a row the operator dragged by hand stays a row and a frame a few pixels off its neighbor still joins it.

- It places each row on `FRAME_GAP`, the gap `frame add` uses, and drops layout entries whose frame file is gone through `pruneLayout`, since `readPage` never reports them
- It leaves `readPage`'s name sort alone, because that order is the paint order of `canvas capture --composite`
- Fit and arrange are two verbs because a fit that grows a frame leaves the rows below overlapped, and the skill runs arrange after it

### Color edits

The inspector writes a token at full opacity as `var(--<name>)` and below it as a `color-mix()` of that `var()` with `transparent`, so a token at any opacity keeps following the theme. Resolving to an eight-digit hex would freeze the color at the theme it was picked in.

- A hex writes six digits at full opacity and eight below it
- The token list sits behind the row's tokens icon and lists only the color group
- Each swatch is read off a probe element in the frame rather than the token's text, since a token's value may itself be a `var()` or a mix

### The color picker

The swatch opens the full picker, which edits in HSV so a grey keeps the hue the operator set, and converts to CIE LCH as CSS `lch()` defines it. The conversions are about 150 lines of published formulas in `inspector/color-space.ts`, since a picker library would add a dependency and bring its own DOM and keyboard model.

Any change but the alpha writes a hex, because a token's color cannot change from the inspector without editing the token. The alpha keeps a token through the `color-mix()` form. An LCH value outside sRGB clamps per channel, and chroma reduction maps the gamut more faithfully and waits.

### Selection handles

The selection overlay in `client/selection.tsx` draws the outline, four corner handles, and an element's size chip, and sizes each against `--outline-scale`, the inverse of the zoom the plane sets, so all of it holds one screen size. The frame label sizes the same way.

- A handle drag divides the pointer's travel by the zoom, since the delta arrives in screen pixels and the box is in surface units
- A frame's overlay holds the corner opposite the handle, while an element's draws its own measured box during the drag, since an element in normal flow grows from its top left whichever handle moves

### Element resize

An element resize is two edits through the inspector's writer, width then height, the second carrying the hash the first answered and both carrying one undo step. A multi-property edit would have reached into the edit writer for one caller.

Passing the answered hash rather than reading it back from state lets the second edit land when the frame reloads between the two, since a reload clears the stored hash.

### The key layer

The key layer is one pure map in `client/keys.ts`, called by the surface `<main>` and by every frame document, since a click inside a frame moves focus into its window and `handleLoad` has to forward its keys the way it forwards `wheel`.

- Only the surface or a frame feeds it, so a panel field keeps its letters, and a field inside a frame and Space on a focused button keep theirs too
- It never claims a key release, because a button fires its Space activation there
- Undo and redo are the one modifier combination it claims, Ctrl or Cmd with Z and Shift to redo, plus Ctrl with Y, since the canvas has no text of its own for the browser's undo to act on
- Any other Cmd, Ctrl, or Alt press stays the browser's, and the panel toggle is the backslash key, matched by `code` since its character differs by layout

### Space pan

A Space pan lives in its own `spacePan` signal beside `activeTool`, so releasing Space restores the picked tool, and the strip lights the computed `shownTool`.

- While panning, every `.frame` and its descendants take `pointer-events: none`, since a selection handle sets its own and a Space drag starting on one resized the element
- A pan press prevents the viewport's mouse press default, since a press read as a second click selected a word or a whole frame and painted it blue
- The pan also blocks that start event and clears the selection in the shell and every frame document, because neither blocking the start event nor a clear at pointer down alone reached it

### Pan focus

A Pan tool press focuses the surface itself, so a field it leaves commits, while a press under a held Space leaves focus where the release will arrive. A focused frame selects on Space's release, and only when no drag moved the view. The strip floats inside the surface, so fit takes its width as a left inset.

### Undo history

One `canon canvas serve` process holds the history, in `src/canvas/history.ts`, and only the server's edit, move, and resize routes record into it, through optional observers the writers call once a write lands.

- The CLI verbs run in another process and pass none, so Claude's edits never enter it and the records those verbs print stay unchanged
- Recording in the writers themselves would have reached the CLI's process as well
- A server restart clears the history, while a shell reload keeps it

### History entries

An element entry keeps the raw style attribute, plus the raw inner content for a text edit, so one restore covers every inspector field. A box entry keeps the layout box, or none for a frame the reader placed.

Edits sharing a `step` token on one element merge into one entry, which is how a corner drag or a two-property commit undoes as one.

### Restoring an entry

A restore takes the writers' own lock and refuses as `changed` in three cases, and the history then drops that entry rather than overwriting a newer state or landing on a neighbor.

- The frame's element count differs from the edit's, the check that catches an insert ahead of the target, since an unstyled state matches every unstyled sibling of the same tag
- The element at the index no longer carries the recorded tag and state
- The layout moved on

A rewrite that leaves the count alone is checked against the target element only, so Claude restyling a neighbor leaves the operator's entry live.

### Side panels

The panels-hidden flag and both widths persist under one `canon-canvas-panels` key, read and written by `App` rather than by `main.tsx` beside the theme, so the shell tests reach the stored preference.

- Each width is clamped on read and again on every window resize, between 180 and 480 and so the surface keeps 320, the reflow floor
- The details panel gives way first, since long layer names are what the pages panel widens for
- Below 900 wide the narrow columns keep their own fixed widths and the handles hide

The surface shifts the view by however far its left edge moves, so frames hold still on screen when a panel hides or resizes. Each handle is a focusable separator the arrow keys move, centered on the edge so a 24 pixel circle around it clears both the panel's padding and the tool strip.

### Layout edits

Writing `border-radius` or `padding` drops that shorthand's longhands from the same inline style, so switching radius from per corner back to one value takes one edit and no corner left behind overrides it. A longhand write leaves its shorthand, since the longhand comes later and wins. The table of shorthands holds those two families alone.

### Fill, fit, and alignment

Fill writes `100%` on either axis and Fit writes `fit-content`, one property per edit as the writer takes it.

- Fill is wrong for a row child sharing space, which needs `flex: 1` read off the parent's axis, and that waits until the operator meets it
- The alignment grid posts `justify-content` then `align-items` as two edits, the second carrying the hash the first answered with
- It maps its cells through the container's `flex-direction`, so a column swaps the axes

### Typography edits

Family and size list their token group first, written as `var(--name)`, and a typed literal last, marked raw where the group holds any token. The groups are the Theme tab's `font-family` and `font-size`, so a sheet not following that naming lists nothing and the field takes a literal with no menu.

A family shows the first name of its stack, unquoted, and posts nothing unless changed. A pasted `font-family: X;` line keeps its value alone, since the writer refuses the semicolon.

### Line height and spacing

A browser computes a unitless line height to pixels, so the field shows a pixel value as its ratio to the font size and writes a typed number unitless. Its Auto writes `normal`, the keyword a line height takes.

Letter spacing writes a bare number as pixels and runs below zero, so its scrub is unclamped, and both fields scrub in tenths. Alignment reads `start` and `end` through the element's computed `direction`, so the pressed side is the one the text paints on.

### Capture

A frame capture goes through a server started for the call, so the injected tokens are in the image, and renders at the frame's layout width so a media query resolves there. It never captures the file on disk.

- A single-frame PNG is the frame's whole document, so its height follows the content
- The composite page image places each frame at its layout position clipped to its box, so a frame's height there follows the box and can differ from its own PNG

### The font check

The font check reads the first family of each rendered text element in the frame, so a frame may set its font on `html`, `body`, or any ancestor of its text.

- A frame that sets no font inherits the browser's default serif, which many machines lack, so the capture refuses it. The standard forbids assuming a default font for that reason.
- A generic keyword as the first family, such as `monospace`, fails the check too, since it resolves per machine
- A composite container holds no text, so the check skips it

### Skill

The skill starts the server before writing any frame, then fetches the printed address and checks the shell itself. Captures go through the frame route, so a shell that failed to build answers `/` with an empty `200` while every capture still passes, and only the shell check notices.

A picked direction leaves the canvas for the project's design document. The canvas is a drafting surface and its folder is gitignored, so nothing on it is citable from a tracked file.

### Editing mark

A session marks the frame it is editing through `canvas editing`, and the server reads that record rather than inferring the state. A session writes a frame through its file, so the server sees nothing until the write lands, and a watch on the file fires only once the work is already there.

- The marks share one `editing.json` beside `selection.json`, keyed by frame, and each write merges its one key under the file lock
- Replacing the whole map would drop a mark another session wrote in between
- The mark gates no write. The frame hash check already refuses an inspector edit against a rewritten file, so a lock would refuse the same collision twice.

### Mark expiry and display

A mark lapses five minutes after it was last written. A session that crashes or compacts never clears its mark, so the expiry is the only thing that does, and its length bounds how long a dead mark misleads the operator. A frame rewrite takes seconds, so a long edit renews once.

The shell shows a mark on the frame's board label and outline, not in the pages panel, since an edited frame is something the operator watches on the board. A reread drops a cleared mark, and a client timer set for the earliest `until` drops a lapsed one, because an expiry writes no file and raises no change event.

### House style

The house style lives in `canvas-board`'s reference, which a session loads before it drafts, and the opt-in rule `canvas` on `.canon/canvas/**` only points there. A path-scoped rule loads after a new frame's first write lands, so a style carried by the rule alone would arrive after the frame it was meant to shape.

- It governs explanation frames, being diagrams, boards of notes, and comparisons. A mockup of the project's interface follows the project's design document.
- The rule is listed in no stack and a project takes it with `--add canvas`, so a project that never adds it gets the style from the skill alone. That keeps a canvas-only rule out of every base install.
- The rule states case and box height again in one line each, scoped to explanation frames, since a session without the skill still sees them
- It repeats no size or selector, so the reference stays the one owner

### The static board retired

`canon design board` generated a static page set indexing six design surfaces, with a components panel framing a second Astro build of every site component. The canvas replaced it rather than joining it.

- That board only looked back at what the project already held, while the canvas is where an idea gets drawn before one is written into the design record
- Keeping both meant one more generator to hold in step with every surface it indexed, for a page nobody drafted on

The component gallery existed only for the board's components panel and retired with it, taking its second Astro config, its exclusion check, and its two workflow steps.

## Gotchas

### Backup and install

Two gaps catch a fresh checkout.

- `canon records push` does not back `.canon/canvas/`, so a lost checkout loses every page. The skill promises nothing about survival until the backup covers it.
- The shell is bundled from `src/canvas/client/` at serve time, so `canvas serve` refuses a missing dependency as `missing-client-deps`. Run the install in a fresh worktree first.

### Port reuse

`Bun.serve` with `development: false` turns port reuse on under Linux, so a second canvas binds beside one already listening and requests reach either process. The canvas bind sets `reusePort: false`, which makes a held port refuse and the walk step past it. Any bind that sets `development: false` needs the same option.

### Bundler quirks

A stylesheet a client module imports reaches the served shell through the bundler with no `<link>` in `index.html`, as `inspector/fields.css` does. Happy-dom ignores stylesheets, so only the browser walk in `src/canvas/shell.e2e.test.ts` proves a rule applies.

`src/canvas/index.html` is a Bun HTML import, so the bundler resolves every `href` and `src` at start. A root-relative route the server answers, such as `/api/icon.svg`, fails with `Could not resolve` and leaves `/` serving an empty 200 body with nothing in the serve log.

- The page keeps `data:,` as its icon, which stops the `/favicon.ico` request
- `client/main.tsx` points the link at `/api/icon.svg` on load, the way it loads `/api/chrome.css`
- The icon is `brandFavicon()` from `src/design/brand-favicon.ts`, the build teach pages share

### Happy-dom limits

Happy-dom lacks several browser behaviors the inspector leans on.

- It drops a `color-mix()` value from an inline style, so `shell.test.tsx` cannot start a case from one. The unit parse in `inspector/values.ts` and the browser walk cover it.
- Happy-dom 20 has no `showPopover()`, so the inspector calls it only where the browser has it, and the shell tests reach popovers as plain fixed elements
- Preact runs a child's layout effect before its parent's, so a control inside a popover the parent shows in its own effect shows the popover itself before it takes focus
- It returns only what the inline style set, so only the browser walk catches a default flex container showing no checked cell in the alignment grid

### Alignment defaults

A browser computes `justify-content` and `align-items` as `normal` on a flex container left at its defaults. The alignment grid reads `normal` and `stretch` as the start cell, and a click on that cell still writes it so the operator can pin a stretched row.

### Reloads and focus

A saved edit reloads the frame twice, once on the edit's answer and once when the file watcher reports the write, and each reload remounts the inspector.

- A control that must keep focus across an edit takes it back on every mount until focus lands elsewhere, as the color row's do
- It moves focus in a layout effect so a key typed straight after the opening one is not lost
- A popover meant to stay open across its own write keeps its state in module scope, keyed by frame, element, and property, and reopens from it on mount, as the full color picker does
- The field's focus-out close waits a tick and skips a field already detached, so the removal during a reload does not read as focus leaving

### Menus, the writer, and classes

Three traps sit in the menu, the writer, and the class namespace.

- The W and H mode menu is a transparent native `select` over a chevron, so its list opens above the panel's scroll clipping and answers the keyboard as the platform does
- The focus ring draws on the lane holding it
- The writer reads a style attribute through `HTMLRewriter`, whose `getAttribute` returns entities still encoded and whose `setAttribute` escapes only `"`, as `&quot;`
- The declaration splitter in `src/canvas/edit.ts` skips a character reference whole rather than splitting at its semicolon
- The inspector's stylesheet and `shell.css` share one class namespace, and the Theme tab owns `.token`. A new inspector class takes its own prefix, as `.token-option` does.

### The walk and rewriting

In the browser walk, reading a write route's response body through Playwright hung once the write's change event made the shell reread the page list. A walk case asserts on the request's own JSON body and the response status instead.

- `HTMLRewriter` hands each text chunk over as source text with entities still encoded, so an element's chunks join into its raw inner content
- `setInnerContent(raw, { html: true })` then writes it back byte for byte
- The text undo depends on that, and takes the bytes from the server's record, never a request, since they are written as markup
- The signals integration skips a component whose props did not change, so a signal only a parent reads does not re-render its children
- `ElementDetails` reads `savedEdit`, which clears on a timer, so `ElementFields` can re-render mid-drag, and a value a drag must hold is read at press rather than at render
