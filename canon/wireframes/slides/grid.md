---
title: Grid layout
description: A title above up to four cards in a two-by-two grid, each a term and a detail line
---

# Grid layout

Compact comparisons in cards, selected by `layout: grid`. Each `- term : detail` line in the body becomes one card. Transcribed from `renderGrid` in `src/slides/layouts.ts`. The margins, title band, and footer come from `canvas.md`.

## Regions

- Title band: the slide's title
- Card grid: two columns and two rows from `y=1.7`, filled in reading order. Each card is half the content width less a 0.5in gap and 2.1in tall, with a 0.5in gap between rows
- Card: a rounded panel on the surface color, holding the term at its top and the detail under it, both inset 0.3in from the card's sides
- Footer: as `canvas.md` draws it

## States

| State    | Reached when                            | Shows                                                        | Evidence                                         |
| -------- | --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| rendered | The body carries four `-` lines         | Four cards filling the grid                                  | `examples/slides/evidence/showcase-light-09.png` |
| partial  | The body carries one to three `-` lines | That many cards in reading order, the rest of the grid empty | not captured                                     |

Flat captures, per `canvas.md` `## States`.

## Copy

- Term and detail: the text either side of the first `:` on each line, templated per deck

## Behavior

- A fifth line and every one after it is dropped.
- Cards keep their size whatever the count, so a partial grid leaves gaps rather than stretching the cards it has.

## Not on this surface

- No icon or image inside a card
- No third column or third row
