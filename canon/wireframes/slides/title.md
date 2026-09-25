---
title: Title layout
description: The cover slide, a deck title and subtitle with no title band and no footer
---

# Title layout

The cover slide a deck opens on, selected by `layout: title` or inferred for a slide carrying no list items. Transcribed from `renderTitle` in `src/slides/layouts.ts`. The margins come from `canvas.md`.

## Regions

- Deck title: full content width from `y=2.6` for `h=1.4`, in the lower half of the canvas rather than in the title band
- Subtitle: directly under the deck title, from `y=4.1` for `h=1`

## States

| State       | Reached when                            | Shows                            | Evidence                                         |
| ----------- | --------------------------------------- | -------------------------------- | ------------------------------------------------ |
| rendered    | The slide carries a title and body text | The deck title over the subtitle | `examples/slides/evidence/showcase-light-01.png` |
| no-subtitle | The slide carries a title and no body   | The deck title alone             | not captured                                     |

Flat captures, per `canvas.md` `## States`.

## Copy

- Deck title: the slide's own `#` heading, templated per deck
- Subtitle: every body line of the slide joined into one line, templated per deck

## Behavior

- Bold and code markers in the source are stripped rather than rendered.

## Not on this surface

- No title band and no footer
- No image or mark on the cover
