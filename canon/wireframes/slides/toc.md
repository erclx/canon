---
title: Contents layout
description: The toc slide, one linked entry per section slide in the deck
---

# Contents layout

The deck's contents slide, selected by `layout: toc`. Transcribed from `renderToc` in `src/slides/layouts.ts`, which draws the entries from the deck's own section list rather than from the slide's body. The margins and title band come from `canvas.md`.

## Regions

- Title band: the slide's title, or the default below when it carries none
- Entry list: full content width from `y=1.7` for `h=5`, one line per section slide in deck order

## States

| State    | Reached when                      | Shows                             | Evidence                                         |
| -------- | --------------------------------- | --------------------------------- | ------------------------------------------------ |
| rendered | The deck holds a `section` slide  | The title over the linked entries | `examples/slides/evidence/showcase-light-02.png` |
| empty    | The deck holds no `section` slide | The title band alone              | not captured                                     |

Flat captures, per `canvas.md` `## States`.

## Copy

- Default title: "Contents", drawn when the slide's own heading is empty
- Entries: each section slide's own title, templated per deck

## Behavior

- Every entry is a link that jumps straight to the section slide it names.
- The footer's contents link on every other slide jumps back here, per `canvas.md`.

## Not on this surface

- No footer
- No page numbers beside the entries
- No entry for a slide that is not a `section`
