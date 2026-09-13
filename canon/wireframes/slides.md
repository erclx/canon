---
title: Slides
description: The nine slide layouts a .claude/SLIDES.md deck selects through its layout field
---

# Slides

A slide picks one of nine layouts through the `layout:` line in `.claude/SLIDES.md`, and `src/slides/layouts.ts` owns the geometry below. Every canvas is 13.333in by 7.5in, with a 0.7in margin (`MX`) on both sides and a 1.7in body top (`BODY_Y`) on layouts that carry a title. Each block transcribes its render function's own `x`/`y`/`w`/`h` placement rather than an approximation, and the `←` notes carry the source values.

## title

Cover slide. No title band and no footer. The deck title and subtitle sit centered in the lower half of the canvas.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│    Deck title                                                          │← title, y=2.6 h=1.4
│                                                                        │
│                                                                        │
│                                                                        │
│    Subtitle line                                                       │← subtitle, y=4.1 h=1
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## toc

Contents slide. No title band beyond the slide's own title text, and no footer. Every entry links to the section slide it names.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│    Contents                                                            │← title band
│                                                                        │
│                                                                        │
│                                                                        │
│    Section one                                                         │← toc list, y=1.7 h=5
│    Section two                                                         │
│    Section three                                                       │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## section

Section divider. One large heading, vertically centered, and nothing else on the slide.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│    Section heading                                                     │← y=2.9 h=1.6, centered
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## bullets

Title above a bullet list. The default layout for content with list items and no explicit `layout:` line.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│    Slide title                                                         │← title band
│                                                                        │
│                                                                        │
│                                                                        │
│    • First point                                                       │← bullet list, y=1.7 h=5
│    • Second point                                                      │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## two-column

Two labeled columns of bullets. Each column heading sits above its own list, and the two columns split the content width evenly with a 0.6in gap between them.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│    Slide title                                                         │← title band
│                                                                        │
│                                                                        │
│                                                                        │
│    Column A                          Column B                          │← heading, h=0.6
│    • Item                            • Item                            │← items, y=+0.7 h=4.3
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## stat-callout

Row of large stats with captions. Up to four cells split the content width evenly with a 0.5in gap between them. This block shows three.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│    Slide title                                                         │← title band
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│    42%                   42%                    42%                    │← stat, y=2.6 h=1.3
│                                                                        │
│                                                                        │
│    Caption text          Caption text           Caption text           │← caption, y=3.9 h=1.4
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## grid

Two-by-two cards, each a term and a detail line inside a rounded surface panel. Up to four cards fill in reading order, and this block shows all four.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│    Slide title                                                         │← title band
│                                                                        │
│                                                                        │
│                                                                        │
│    ┌──────────────────────────────┐ ┌──────────────────────────────┐   │
│    │Term                          │ │ Term                         │   │← card, w=5.72 h=2.1
│    │Detail                        │ │                              │   │
│    │                              │ │                              │   │
│    │                              │ │                              │   │
│    └──────────────────────────────┘ └──────────────────────────────┘   │
│    ┌──────────────────────────────┐ ┌──────────────────────────────┐   │
│    │                              │ │                              │   │
│    │Term                          │ │ Term                         │   │
│    │                              │ │                              │   │
│    │                              │ │                              │   │
│    │                              │ │                              │   │
│    └──────────────────────────────┘ └──────────────────────────────┘   │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## quote

Large pull quote with attribution. No title band. The quote itself opens the slide.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│    "A pull quote, set in italics."                                     │← quote, y=2.2 h=2.6
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│    — Attribution                                                       │← attribution, y=5 h=0.6
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## freeform

Explicit shapes at a declared position and size, for a figure the other eight layouts cannot draw. The source line names each shape's kind (`text` or `rect`), its box, and a palette role for its color. The example below shows one of each.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│    Slide title                                                         │← title band, reserved to y=1.4
│                                                                        │
│                                                                        │
│                                                                        │
│           ┌───────────────┐                                            │
│           │               │                                            │
│           │               │  text shape                                │← author-declared shapes below y=1.4
│           │               │                                            │
│           │               │                                            │
│           │               │                                            │
│           └───────────────┘                                            │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Copy

- Every string in the blocks above stands in for whatever a deck's own slide carries, and is a placeholder rather than fixed text. `Contents` in the `toc` block is the one exception: it is the literal default title `renderToc` draws when a `toc` slide carries no title of its own, and the same literal string `addFooter` writes as the link back to it.

## Behavior

- Every layout except `title` and `toc` carries a footer: the deck title bottom-left and, when the deck has a `toc` slide, a "Contents" link back to it bottom-right.
- The `toc` slide's entries are hyperlinks. Each jumps straight to the section slide it names, numbered by the deck's own pre-pass rather than by hand.
- `freeform` still draws its title through the shared title band. A shape declared above `y=1.4` renders underneath the heading rather than beside it, so the reserved band is a hard floor for shape placement, not a suggestion.
