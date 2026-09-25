---
title: Slide canvas
description: The margins, title band, body top, and footer every slide layout in a SLIDES.md deck draws on
---

# Slide canvas

Every slide a `.claude/SLIDES.md` deck renders sits on one canvas, and each layout file in this folder points back here rather than restating it. Transcribed from `src/slides/layouts.ts`: the `W`, `H`, `MX`, and `BODY_Y` constants, `addTitle`, and `addFooter`. A slide picks one of nine layouts through its `layout:` line. With no such line, a slide carrying list items takes `bullets` and any other takes `title`, per `inferLayout` in `src/slides/parse.ts`.

## Regions

- Canvas: 13.333in wide by 7.5in tall, with a 0.7in side margin (`MX`) on both edges, so every region below spans the 11.933in content width between them unless its layout file says otherwise
- Title band: at the top, from `y=0.5` for `h=0.9`, drawn by `addTitle` on every layout that carries a title and skipped when the slide's title is empty
- Body: from `y=1.7` (`BODY_Y`) down, below the title band, where a layout with a title starts its content
- Footer: along the bottom edge at `y=7.0` for `h=0.3`, split into halves. The deck title sits in the left half and the contents link sits right-aligned in the right half

## States

| State  | Reached when                                                                    | Shows                                      | Evidence                                         |
| ------ | ------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| light  | The deck's frontmatter sets `variant: light`, the default, or `--variant light` | Every slide on the light ground            | `examples/slides/evidence/showcase-light-01.png` |
| dark   | The deck's frontmatter sets `variant: dark`, or `--variant dark`                | The same slides on the dark ground         | `examples/slides/evidence/showcase-dark-01.png`  |
| no-toc | The deck carries no `toc` slide                                                 | The footer with the deck title and no link | not captured                                     |

The captures are flat files numbered by slide position rather than per-state folders, because the slides capture writes one image per slide of `examples/slides/showcase.md`. Each layout file cites the light capture of its showcase slide, and the dark twin sits at the same number under `showcase-dark-`.

## Copy

- Footer contents link: "Contents", the literal string `addFooter` writes
- Footer deck title: the `title` in the deck's frontmatter, templated per deck and left off when the frontmatter carries none

## Behavior

- Every layout except `title` and `toc` carries the footer. The contents link appears only when the deck has a `toc` slide, and jumps straight to it.
- A `layout:` value outside the nine renders as `bullets.md` draws it, and the render reports the slide numbers that carried it.

## Not on this surface

- No slide number in the footer
- No logo or brand mark on any layout
- No per-slide variant. A deck is light or dark throughout
