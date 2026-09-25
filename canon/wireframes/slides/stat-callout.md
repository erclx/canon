---
title: Stat-callout layout
description: A title above a row of up to four large stats, each with a caption under it
---

# Stat-callout layout

A row of large numbers, selected by `layout: stat-callout`. Each `- value : caption` line in the body becomes one cell. Transcribed from `renderStatCallout` in `src/slides/layouts.ts`. The margins, title band, and footer come from `canvas.md`.

## Regions

- Title band: the slide's title
- Stat row: up to four cells splitting the content width evenly with a 0.5in gap between them, left to right in source order
- Stat: the top of each cell, from `y=2.6` for `h=1.3`
- Caption: under its stat, from `y=3.9` for `h=1.4`
- Footer: as `canvas.md` draws it

## States

| State    | Reached when                           | Shows                                        | Evidence                                         |
| -------- | -------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| rendered | The body carries one to four `-` lines | One cell per line, the row filling the width | `examples/slides/evidence/showcase-light-08.png` |
| empty    | The body carries no `-` line           | The title band and the footer alone          | not captured                                     |

Flat captures, per `canvas.md` `## States`. The showcase slide carries four cells.

## Copy

- Stat and caption: the text either side of the first `:` on each line, templated per deck

## Behavior

- A fifth line and every one after it is dropped.
- The cell width follows the cell count, so two stats each take half the row and four each take a quarter.

## Not on this surface

- No chart, bar, or trend mark beside a stat
- No second row of cells
