---
title: Two-column layout
description: A title above two labeled columns of bullets splitting the content width evenly
---

# Two-column layout

Two labeled lists side by side, selected by `layout: two-column`. Each `##` heading in the slide body opens a column, and the `-` lines under it fill that column. Transcribed from `renderTwoColumn` in `src/slides/layouts.ts`. The margins, title band, and footer come from `canvas.md`.

## Regions

- Title band: the slide's title
- Left column and right column: each half the content width less a 0.6in gap between them, from `y=1.7`
- Column heading: at the top of its column, `h=0.6`
- Column items: under the heading, from `y=2.4` for `h=4.3`
- Footer: as `canvas.md` draws it

## States

| State        | Reached when                                  | Shows                                       | Evidence                                         |
| ------------ | --------------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| rendered     | The body carries two `##` headings with items | Both headings over their lists              | `examples/slides/evidence/showcase-light-06.png` |
| heading-only | A column's heading carries no `-` line        | That column's heading with nothing under it | not captured                                     |
| one-column   | The body carries one `##` heading             | The left column alone, the right half empty | not captured                                     |

Flat captures, per `canvas.md` `## States`.

## Copy

- Title, column headings, and items: the slide's own heading, `##` lines, and `-` lines, templated per deck

## Behavior

- A third `##` heading and everything under it is dropped. The layout draws two columns at most.
- A `-` line ahead of the first `##` heading belongs to no column and is dropped.

## Not on this surface

- No divider rule between the columns
- No third column
