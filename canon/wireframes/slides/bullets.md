---
title: Bullets layout
description: A title above one bullet list, the layout a slide with list items takes by default
---

# Bullets layout

A title over a bullet list, selected by `layout: bullets`, inferred for a slide carrying list items and no `layout:` line, and drawn for any `layout:` value outside the nine. Transcribed from `renderBullets` in `src/slides/layouts.ts`. The margins, title band, and footer come from `canvas.md`.

## Regions

- Title band: the slide's title
- Bullet list: full content width from `y=1.7` for `h=5`, one bullet per `-` line
- Footer: as `canvas.md` draws it

## States

| State    | Reached when                  | Shows                               | Evidence                                         |
| -------- | ----------------------------- | ----------------------------------- | ------------------------------------------------ |
| rendered | The slide carries `-` lines   | The title over the list             | `examples/slides/evidence/showcase-light-04.png` |
| empty    | The slide carries no `-` line | The title band and the footer alone | not captured                                     |

Flat captures, per `canvas.md` `## States`.

## Copy

- Title and items: the slide's own heading and `-` lines, templated per deck

## Behavior

- A body line that does not open with `-` is dropped rather than drawn as a paragraph.

## Not on this surface

- No nested list levels
- No paragraph text between bullets
