---
title: Section layout
description: A section divider, one large heading vertically centered with nothing else on the slide
---

# Section layout

A chapter divider, selected by `layout: section`. Every section slide becomes one entry on the contents slide, per `toc.md`. Transcribed from `renderSection` in `src/slides/layouts.ts`. The margins and footer come from `canvas.md`.

## Regions

- Heading: full content width from `y=2.9` for `h=1.6`, vertically centered in that box
- Footer: as `canvas.md` draws it

## States

| State    | Reached when                     | Shows                      | Evidence                                         |
| -------- | -------------------------------- | -------------------------- | ------------------------------------------------ |
| rendered | The slide sets `layout: section` | The heading and the footer | `examples/slides/evidence/showcase-light-03.png` |

Flat captures, per `canvas.md` `## States`. The showcase carries two more section slides, at `showcase-light-05.png` and `showcase-light-07.png`.

## Copy

- Heading: the slide's own `#` heading, templated per deck

## Behavior

- The slide's body lines are ignored. Only the heading draws.

## Not on this surface

- No title band and no body
