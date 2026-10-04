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
- Surface: the area between the two panels, holding every frame of the current page placed at its box, with each frame's name, size, and theme switch on one line above it. That line is the frame's handle
- Element outline: drawn over a frame, dashed around the element under the pointer and solid around the selected one
- Zoom toolbar: floating at the bottom right corner of the surface, holding zoom out, the zoom level, zoom in, and fit
- Details panel: a slim column down the right edge, holding the inspector for the selected frame, then the current page's name and frame count, then where the frames' tokens come from
- Inspector: the top section of the details panel, showing the selected frame's name and its x, y, width, and height as read-only fields, two to a row
- Element inspector: below the frame inspector when an element is selected, its `tag.class` name over six titled sections in a two-column grid. Each field starts at the element's inline value, else its computed one
- Sections: Layout holds x and y read-only, then width and height as a number, Fill, or Fit. Flex holds alignment, direction, wrap, gap, and padding, else an add button. Appearance holds opacity and radius. Typography holds size, weight, and font read-only. Fill holds color and background as swatch, hex, opacity, tokens, and eyedropper. Text holds text, read-only over children
- Field: a bordered box with a short glyph inside its left edge, such as `W`, and the value right of it. A section header keeps an empty lane at its right for later buttons

### Below 900 wide

- The details panel is hidden and the pages panel narrows

### Below 600 wide

- The pages panel stacks above the surface, capped at a share of the height and scrolling on its own

The sketch stays until a capture of the canvas exists.

```plaintext
+------------+------------------------------------------+---------------+
| Canvas  (☾)|  hero 1440 × 900    [Dark]  phone 390 ×  | Element Saved | ← details panel
|[Pages|Theme]  +----------------------+   +--------+   | button        |
| Pages      |  | +------------------+ |   |        |   | Layout        |
| > drafts  2|  | | <selected elem>  | |   | <frame>|   | [X 48][Y 120] |
|   approved1|  | +------------------+ |   |        |   | [W 96][H 40 ] |
|            |  |   <frame document>   |   |        |   | Fill          |
| Frames     |  +----------------------+   +--------+   | [■FF0000 100%]|
| ▾ hero 1440|                                          | Text          |
|    body    |                                          | [T Start    ] |
|     main   |                                          | Page          |
|      h1    |                                          | drafts        |
| ▸ phone 390|                       [ − 47% + Fit ]    | Tokens        |
+------------+------------------------------------------+---------------+
  ↑ pages panel        ↑ surface             ↑ zoom toolbar
    and layers
```

## States

| State            | Reached when                                                                                                 | Shows                                                                                                                          | Evidence                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| filled           | The current page holds at least one frame                                                                    | Every frame at its box, the page selected in the list                                                                          | not captured                                              |
| no-pages         | The canvas folder holds no page                                                                              | The page list replaced by the add-a-page line, no frame list                                                                   | not captured                                              |
| empty-page       | The current page holds no frame                                                                              | The frame list replaced by the add-a-frame line, an empty surface                                                              | not captured                                              |
| unplaced         | A frame file has no box in the page's layout                                                                 | That frame in a row after the placed ones, and a count of them at right                                                        | not captured                                              |
| malformed        | The page's layout file does not parse                                                                        | Every frame in a default row, and an alert at right naming the file                                                            | not captured                                              |
| no-tokens        | No token stylesheet resolves for the project                                                                 | Frames unstyled, and the details panel naming where tokens would go                                                            | not captured                                              |
| unreachable      | The page list cannot be read from the server                                                                 | The panel replaced by one line saying to check the server is running                                                           | not captured                                              |
| light            | The system prefers light, or the operator picks light                                                        | The chrome on the light ground                                                                                                 | not captured                                              |
| dark             | The system prefers dark, or the operator picks dark                                                          | The chrome on the dark ground                                                                                                  | not captured                                              |
| frame-switched   | The operator switches one frame's theme from its label                                                       | That frame in the other theme while the chrome and the rest stay put                                                           | not captured                                              |
| selected         | The operator presses a frame's label, or picks it in the list                                                | That frame outlined, its list row marked, and its box in the inspector                                                         | `assets/evidence/canvas-arrange/selected-1440.png`        |
| element-hover    | The pointer rests on an element in a frame or a layer row                                                    | A dashed outline around that element on the surface                                                                            | `assets/evidence/canvas-layers/element-hover-1440.png`    |
| element-selected | The operator clicks an element in a frame, or picks its layer row                                            | A solid outline around it, its layer row marked with the frame's layers open, and its computed values in the element inspector | `assets/evidence/canvas-layers/element-selected-1440.png` |
| element-stale    | The frame file changed since the element was picked                                                          | No element outline and no layer row marked, and the element inspector saying the pick may name another element now             | `assets/evidence/canvas-layers/element-stale-1440.png`    |
| element-mismatch | The browser counts the frame's elements differently from its file, as with a table written without its tbody | The pick refused and an alert in the details panel                                                                             | `assets/evidence/canvas-layers/element-mismatch-1440.png` |
| dragging         | The operator moves a pressed frame                                                                           | The frame following the pointer, and its x and y updating in the inspector                                                     | `assets/evidence/canvas-arrange/dragged-1440.png`         |
| write-failed     | The server refuses a move or a selection                                                                     | The frame back at its stored place and an alert in the details panel                                                           | not captured                                              |
| edited           | The operator commits a changed field or picks a token                                                        | The frame reloading with the change, and `Saved` beside the element label for a moment                                         | not captured                                              |
| edit-refused     | The server refuses an edit, as when the frame file changed after the edit was made                           | The frame reloaded from the file, the typed value dropped, and an alert in the details panel saying nothing was saved          | not captured                                              |
| theme            | The operator picks the Theme tab                                                                             | The token groups in place of the page and frame lists                                                                          | not captured                                              |
| theme-empty      | The Theme tab is picked and no token stylesheet resolves                                                     | One line saying no tokens resolve, then the server's notice                                                                    | not captured                                              |

## Copy

- Brand line: `Canvas`
- Section labels: `Pages`, `Frames`, `Page`, `Tokens`
- No pages: `No pages yet. Run canon canvas page add <name> to add one.`
- Empty page: `No frames on this page. Run canon canvas frame add <page> <name> to add one.`, with `<page>` the current page's name
- Loading: `Loading`
- Unreachable: `Could not read the canvas (<reason>). Check canon canvas serve is still running.`, with `<reason>` templated
- Token source: `This toolkit`, `Installed design`, or `None`, over the installed file list or the server's notice
- Unplaced: `<n> frames have no box in layout.json and sit in a default row.`, singular for one
- Malformed: `layout.json does not parse, so every frame sits in a default row. Fix the file to restore their places.`
- Frame label: `<name> <width> × <height>`, then the theme switch reading `Dark` or `Light`
- Zoom toolbar: `−`, `<n>%`, `+`, `Fit`
- Inspector label: `Frame`, with field glyphs `X`, `Y`, `W`, `H` and accessible names `x`, `y`, `width`, `height`
- Element inspector label: `Element`, with section titles `Layout`, `Flex`, `Appearance`, `Typography`, `Fill`, `Text`
- Element field glyphs: `X`, `Y`, `W`, `H`, `Dir`, `Gap`, `Pad`, `Op`, `R`, `TL` to `BL`, `Size`, `Wt`, `Font`, `T`, each short for its accessible name
- Empty field placeholders: `0` for gap, `None` for background
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
- Layers loading: `Loading layers`
- Element loading: `Loading the frame to read this element`
- Element stale: `The frame changed since this element was picked, so its index may name another element now. Pick it again.`
- Element mismatch: `Could not select that element, since the browser and the file count the elements of this frame differently, as when the browser builds an element the file does not state.`
- Element changed before the pick: `Could not select that element, since the frame changed before the pick arrived. Pick it again once the frame reloads.`
- Nothing selected: `Select a frame to see its box`
- Write refused: `Could not save (<reason>). Check canon canvas serve is still running.`, with `<reason>` templated
- Frame contents: the frame's own HTML file, not duplicated here

## Behavior

- Picking a page in the list shows its frames and fits them into the surface
- Picking a frame in the list centers it at the current zoom
- Dragging the empty surface or scrolling pans it, and scrolling with the control key held zooms about the pointer
- A frame file Claude rewrites reloads that frame alone, and pan and zoom stay where they were
- A frame or page Claude adds appears without a manual refresh
- The theme toggle flips the chrome between light and dark and is remembered for the next visit
- A frame's theme switch flips that frame alone
- Pressing a frame's label selects it, dropping any element picked inside it, and one frame is selected at a time. The selection is written to the project, so Claude reads it as "this one"
- Dragging a frame by its label moves it, and releasing writes the new position to the page's layout, where it survives a restart
- Clicking inside a frame selects the element under the pointer and its frame, and the click goes no further, so a link or a button in the frame does nothing. The element is written by its index in document order, with the hash of the file the frame was served from, and a pick made against a version the file has since moved past is refused
- Picking a layer row selects that element the same way, and selecting one on the surface opens its frame's layers and marks its row
- Scrolling over a frame pans the surface, and scrolling with the control key held zooms it, as over the empty surface
- A press that never moves selects and writes no position
- With a frame focused, Enter or Space selects it, and the arrow keys move the selected frame by 10, or by 50 with Shift held
- Picking a frame in the list selects it on the surface, and pressing one on the surface marks its row
- A frame Claude moves or removes updates the surface and the inspector, and a removed frame leaves nothing selected
- An element field commits on Enter or on leaving it, and a value left as it started sends nothing. Escape puts the field back
- A field shows a pixel length rounded and with no unit, reads `auto` and `normal` as words, and shows a `normal` gap or a transparent background empty. A bare number typed into a length writes as pixels, and a rounded value left unchanged sends nothing
- Dragging a number field's glyph scrubs it, one per pixel or ten with Shift, previewed in the frame and written once on release. A length stops at 0, a weight at 1 and 1000, and an empty gap scrubs from 0. A cancelled drag puts both back
- A committed field writes into the element's inline style in the frame file, or its text, and leaves the rest of the file as it was. The frame reloads to show it
- Picking a color token writes `var(--<name>)`, or below full opacity a `color-mix()` of it with `transparent`, so the element keeps following the theme. An unreadable inline value shows as written. A picker drag writes once on release, and any change but the alpha writes a hex
- Fields hold while an edit is in flight and take the file's values again once the frame reloads
- An edit made against a version of the frame the file has since moved past is refused, never applied to a shifted element, and the frame reloads from the file
- The Theme tab lists what the token stylesheet defines and edits nothing

## Not on this surface

- No editable frame box, since the frame's x, y, width, and height are read-only here
- No shadows, constraints, effects, or components, since the inspector edits the basic set alone
- No token editing, since the Theme tab only lists them
- No project tabs, since one canvas serves one repository
- No capture control on the surface
