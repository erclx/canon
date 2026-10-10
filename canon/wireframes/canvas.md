---
title: Canvas
description: The local canvas canon canvas serve opens, listing a project's pages and placing each page's HTML frames on a pan and zoom surface
---

# Canvas

Opened on localhost by `canon canvas serve`. It shows one project's pages and the frames on each, where a page is a folder under `.canon/canvas/` and a frame is one HTML file in it. Claude fills it by writing files and by the `canon canvas` verbs, and the operator reads it here. The chrome follows the system theme until the operator picks one.

## Regions

- Pages panel: a column down the left edge holding the brand line and theme toggle at its top, then the Pages and Theme tabs. The Pages tab holds the page list and below it the current page's frame list
- Theme tab: in place of the page and frame lists while picked, the project's tokens under one label per group (color, spacing, radius, font family, font size, other), one row a token reading its name and value, with a swatch beside each color. Read-only
- Layers: under each frame's row in the frame list, opened by the disclosure beside it, the frame's element tree from its body down, one row per element reading `tag.class` and a leaf's text
- Surface: the area between the two panels, holding every frame of the current page placed at its box, with each frame's name, size, editing badge, and theme switch on one line above it. That line is the frame's handle, and it holds one screen size at any zoom. A row too short for every part drops the theme switch, then the badge, then the size, before it shortens the name
- Element outline: drawn over a frame, dashed around the element under the pointer
- Selection: a thin outline around the selected frame or element with a square handle on each corner, all at one screen size. A selected frame's name takes the accent, and a selected element carries its rounded size in a chip under it
- Tool strip: at the surface's top left, Move over Pan, the one in effect lit, then Undo over Redo, each disabled while there is nothing to step, then the panel toggle
- Panel handles: on each panel's inner edge, a line in the accent on hover, focus, or drag
- History notice: at the surface's top center once an undo or redo drops an entry
- Zoom toolbar: floating at the bottom right corner of the surface, holding zoom out, the zoom level, zoom in, and fit
- Details panel: a slim column down the right edge, holding the inspector for the selected frame, then the current page's name and frame count, then where the frames' tokens come from
- Inspector: the top section of the details panel, showing the selected frame's name and its x, y, width, and height as read-only fields, two to a row
- Element inspector: below the frame inspector when an element is selected, its `tag.class` name over six titled sections in a two-column grid. Each field starts at the element's inline value, else its computed one
- Sections: Layout holds x and y read-only, then width and height as a number, Fill, or Fit, then padding. Flex holds alignment, direction, wrap, and gap, else an add button. Appearance holds opacity and radius. Typography holds family, size, weight, spacing, and alignment. Fill holds color and background as swatch, hex, opacity, tokens, and eyedropper. Text holds text, read-only over children
- Field: a bordered box with a short glyph inside its left edge, such as `W`, and the value right of it. A section header keeps an empty lane at its right for later buttons

### Below 900 wide

- The details panel is hidden and the pages panel narrows to a fixed width with no handle

### Below 600 wide

- The pages panel stacks above the surface, capped at a share of the height and scrolling on its own

The captures named in the States table show the layout, so it carries no sketch.

## States

| State            | Reached when                                                            | Shows                                                                                      | Evidence                          |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| filled           | The current page holds at least one frame                               | Every frame at its box, the page selected in the list                                      | not captured                      |
| no-pages         | The canvas folder holds no page                                         | The page list replaced by the add-a-page line, no frame list                               | not captured                      |
| empty-page       | The current page holds no frame                                         | The frame list replaced by the add-a-frame line, an empty surface                          | not captured                      |
| unplaced         | A frame file has no box in the page's layout                            | That frame in a row after the placed ones, and a count of them at right                    | not captured                      |
| malformed        | The page's layout file does not parse                                   | Every frame in a default row, and an alert at right naming the file                        | not captured                      |
| no-tokens        | No token stylesheet resolves for the project                            | Frames unstyled, and the details panel naming where tokens would go                        | not captured                      |
| unreachable      | The page list cannot be read from the server                            | The panel replaced by one line saying to check the server is running                       | not captured                      |
| light            | The system prefers light, or the operator picks light                   | The chrome on the light ground                                                             | not captured                      |
| dark             | The system prefers dark, or the operator picks dark                     | The chrome on the dark ground                                                              | not captured                      |
| frame-switched   | The operator switches one frame's theme from its label                  | That frame in the other theme while the chrome and the rest stay put                       | not captured                      |
| selected         | The operator presses a frame's label, or picks it in the list           | The frame outlined with handles, its name in the accent, its row marked, its box shown     | `assets/evidence/canvas/arrange/` |
| element-hover    | The pointer rests on an element in a frame or a layer row               | A dashed outline around that element on the surface                                        | `assets/evidence/canvas/layers/`  |
| element-selected | The operator clicks an element in a frame, or picks its layer row       | An outline with handles and a size chip, its layer row marked, its values in the inspector | `assets/evidence/canvas/arrange/` |
| element-stale    | The frame file changed since the element was picked                     | No outline or marked row, and the inspector saying the pick may now name another element   | `assets/evidence/canvas/layers/`  |
| element-mismatch | The browser and the file count the frame's elements differently         | The pick refused and an alert in the details panel                                         | `assets/evidence/canvas/layers/`  |
| dragging         | The operator moves a pressed frame                                      | The frame following the pointer, and its x and y updating in the inspector                 | `assets/evidence/canvas/arrange/` |
| resizing         | The operator drags a corner handle of the selected frame or element     | A frame grows from its held far corner, an element from its top left, its size shown       | not captured                      |
| editing          | A session marks the frame, until it clears the mark or the mark expires | A badge naming the session after the size, and a dashed outline around the frame           | `assets/evidence/canvas/arrange/` |
| write-failed     | The server refuses a move or a selection                                | The frame back at its stored place and an alert in the details panel                       | not captured                      |
| edited           | The operator commits a changed field or picks a token                   | The frame reloading with the change, and `Saved` beside the element label for a moment     | not captured                      |
| edit-refused     | The server refuses an edit, as when the file changed under it           | The frame reloaded, the typed value dropped, and an alert saying nothing was saved         | not captured                      |
| undo-dropped     | An undo or redo finds its element or frame changed since the edit       | Nothing written, the entry gone, and the history notice saying so                          | `assets/evidence/canvas/shell/`   |
| panels-hidden    | The operator presses the panel toggle or its key                        | Both panels gone and the surface the full width, the frames held still                     | `assets/evidence/canvas/shell/`   |
| panels-resized   | The operator drags a panel handle or moves it with the arrow keys       | That panel at the new width, the frames held still on screen                               | `assets/evidence/canvas/shell/`   |
| theme            | The operator picks the Theme tab                                        | The token groups in place of the page and frame lists                                      | not captured                      |
| theme-empty      | The Theme tab is picked and no token stylesheet resolves                | One line saying no tokens resolve, then the server's notice                                | not captured                      |

## Copy

- Brand line: `Canvas`
- Section labels: `Pages`, `Frames`, `Page`, `Tokens`
- No pages: `No pages yet. Run canon canvas page add <name> to add one.`
- Empty page: `No frames on this page. Run canon canvas frame add <page> <name> to add one.`, with `<page>` the current page's name
- Loading: `Loading`, then `Loading layers` in a frame's layers and `Loading the frame to read this element` in the element inspector
- Unreachable: `Could not read the canvas (<reason>). Check canon canvas serve is still running.`, with `<reason>` templated
- Token source: `This toolkit`, `Installed design`, or `None`, over the installed file list or the server's notice
- Unplaced: `<n> frames have no box in layout.json and sit in a default row.`, singular for one
- Malformed: `layout.json does not parse, so every frame sits in a default row. Fix the file to restore their places.`
- Frame label: `<name> <width> × <height>`, then `<by> editing` while a session marks the frame, then the theme switch reading `Dark` or `Light`
- Size chip: `<width> × <height>` in whole pixels
- Tool strip: icons named `Move (V)`, `Pan (H)`, `Undo (Ctrl+Z)`, `Redo (Ctrl+Shift+Z)`, with `Cmd` for `Ctrl` on macOS, and `Hide panels (\)` or `Show panels (\)`
- Undo landed: `Undone` or `Redone` in the history notice for a moment
- Panel handles: separators named `Resize pages panel` and `Resize details panel`
- Undo dropped: `Could not undo, since that element or frame changed after your edit. Nothing was written.`, and `redo` and `the undo` in place for a redo
- Zoom toolbar: `−`, `<n>%`, `+`, `Fit`
- Inspector label: `Frame`, with field glyphs `X`, `Y`, `W`, `H` and accessible names `x`, `y`, `width`, `height`
- Element inspector label: `Element`, with section titles `Layout`, `Flex`, `Appearance`, `Typography`, `Fill`, `Text`
- Element field glyphs: `X`, `Y`, `W`, `H`, `Dir`, `Gap`, `Pad`, `Op`, `R`, `TL` to `BL`, `Aa`, `Size`, `Wt`, `LH`, `LS`, `T`, each short for its accessible name
- Empty field placeholders: `0` for gap and `LS`, `None` for background
- Left panel tabs: `Pages`, `Theme`
- Color field: the hex in capitals, or a token's name, then the opacity and `%`, named `<field>`, `<field> opacity`, `<field> picker` opening `<field> color`, `<field> tokens` opening `<field> token list`, and `<field> eyedropper`
- Edit landed: `Saved`
- Theme group labels: `Color`, `Spacing`, `Radius`, `Font family`, `Font size`, `Other`
- Theme empty: `No tokens resolve for this project, so there is nothing to list.`, then the server's notice
- Edit refused, frame changed: `The frame changed before this edit arrived, so nothing was saved. It reloads with the file as it stands now. Make the edit again there.`
- Edit refused, counts differ: `Could not save, since the browser and the file count the elements of this frame differently.`
- Edit refused, nested text: `Could not save the text, since this element holds other elements.`
- Edit refused, bad value: `Could not save that value (<detail>).`, with `<detail>` the server's reason
- Layers disclosure: `Show layers of <frame>` or `Hide layers of <frame>` as its accessible name
- Element stale: `The frame changed since this element was picked, so its index may name another element now. Pick it again.`
- Element mismatch: `Could not select that element, since the browser and the file count the elements of this frame differently, as when the browser builds an element the file does not state.`
- Element changed before the pick: `Could not select that element, since the frame changed before the pick arrived. Pick it again once the frame reloads.`
- Nothing selected: `Select a frame to see its box`
- Write refused: `Could not save (<reason>). Check canon canvas serve is still running.`, with `<reason>` templated
- Frame contents: the frame's own HTML file, not duplicated here

## Behavior

- Picking a page in the list shows its frames and fits them into the surface
- Picking a frame in the list selects it and centers it at the current zoom, and pressing one on the surface marks its row
- Dragging the empty surface, or scrolling anywhere on it, frames included, pans it, and scrolling with the control key held zooms about the pointer
- Pan, or Space held, pans on any drag. With the canvas focused, V and H pick the tool, `+` and `-` zoom, Shift+1 fits. A field keeps every key, and Cmd or Ctrl keeps any key but undo and redo
- A frame file Claude rewrites reloads that frame alone, and pan and zoom stay where they were
- A frame or page Claude adds appears without a manual refresh
- The theme toggle flips the chrome between light and dark and is remembered for the next visit
- A frame's theme switch flips that frame alone
- Pressing a frame's label selects it, dropping any element picked inside it, and one frame is selected at a time. The selection is written to the project, so Claude reads it as "this one"
- Dragging a frame by its label moves it, and releasing writes the new position to the page's layout, where it survives a restart
- Clicking inside a frame selects the element under the pointer and its frame, and the click goes no further, so a link or a button in the frame does nothing. A pick made against a version the file has since moved past is refused
- Picking a layer row selects that element the same way, and selecting one on the surface opens its frame's layers and marks its row
- A press that never moves writes no position or size
- With a frame focused, Enter, or Space released with no pan, selects it, and the arrow keys nudge the selected frame, further with Shift
- Dragging a selected frame's corner handle resizes it with the opposite corner held, and Control or Command with an arrow resizes it from the keyboard
- Dragging a selected element's corner handle previews its size in the frame, then writes its width and height. Its inspector fields are the keyboard path
- A frame Claude moves or removes updates the surface and the inspector, and a removed frame leaves nothing selected
- An element field commits on Enter or on leaving it, and a value left as it started sends nothing. Escape puts the field back
- Dragging a number field's glyph scrubs it, previewed in the frame and written once on release. A cancelled drag puts both back
- A committed field writes into the element's inline style in the frame file, or its text, and leaves the rest of the file as it was. The frame reloads to show it
- Picking a color token keeps the element following the theme at any opacity, and a picker drag writes once on release
- Fields hold while an edit is in flight and take the file's values once the frame reloads. An edit made against a version the file has moved past is refused and the frame reloads
- The Theme tab lists what the token stylesheet defines and edits nothing
- With the canvas focused, Ctrl or Cmd with Z undoes the operator's last edit, move, or resize as one gesture, and Shift with it or Ctrl with Y redoes. Claude's writes never enter the history, and one that rewrites what the edit changed, or adds or removes an element in that frame, drops the operator's entry rather than being overwritten
- The panel toggle, or backslash with the canvas focused, hides both panels. A drag or an arrow key on a handle resizes its panel, never squeezing the surface out. Both are remembered for the next visit

## Not on this surface

- No shadows, constraints, effects, or components, since the inspector edits the basic set alone
- No token editing, since the Theme tab only lists them
- No project tabs, since one canvas serves one repository
- No capture control on the surface
