---
title: Freeform layout
description: Author-declared text and rectangle shapes at an explicit position, size, and palette color
---

# Freeform layout

A figure the other eight layouts cannot draw, selected by `layout: freeform`. Each body line declares one shape: `- rect x=… y=… w=… h=… color=<role>` or `- text x=… y=… w=… h=… color=<role>: <text>`, in inches. Transcribed from `renderFreeform` and `renderShapeLine` in `src/slides/layouts.ts`. The margins, title band, and footer come from `canvas.md`.

## Regions

- Title band: the slide's title, drawn as on every titled layout
- Shape area: anywhere below the title band, each shape at the box its line declares, drawn in source order so a later shape sits over an earlier one
- Footer: as `canvas.md` draws it

## States

| State     | Reached when                                 | Shows                                                               | Evidence                                         |
| --------- | -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| rendered  | Every body line declares a well-formed shape | The title over the declared shapes                                  | `examples/slides/evidence/showcase-light-10.png` |
| malformed | A body line fails the shape grammar          | No deck. The render stops on an error naming the slide and the line | not captured                                     |

Flat captures, per `canvas.md` `## States`. The showcase slide carries two rectangles and one text shape.

## Copy

- Title: the slide's own heading, templated per deck
- Text shape: whatever follows the first `:` on its line, templated per deck
- Malformed line: "Malformed freeform shape on slide "`<title>`": `<line>`", templated per slide and line

## Behavior

- A color is one of five palette roles, `background`, `surface`, `ink`, `muted`, or `accent`, so a shape follows the deck's variant rather than carrying a hex value.
- A shape declared above `y=1.4` renders underneath the title rather than beside it, so the band is a floor for shape placement.

## Not on this surface

- No shape kinds beyond `text` and `rect`
- No layout algorithm. Every box is where its line puts it
