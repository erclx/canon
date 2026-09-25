---
title: Quote layout
description: A large pull quote with an attribution under it and no title band
---

# Quote layout

A pull quote, selected by `layout: quote` and transcribed from `renderQuote` in `src/slides/layouts.ts`. Its margins and footer come from `canvas.md`, and it is the one layout that never draws the slide's heading.

## Regions

- Quote: full content width from `y=2.2` for `h=2.6`, set in italics, opening the slide where the title band would sit on other layouts
- Attribution: under the quote, from `y=5` for `h=0.6`
- Footer: as `canvas.md` draws it

## States

| State          | Reached when                                    | Shows                          | Evidence                                         |
| -------------- | ----------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| rendered       | The body carries a line opening with `—` or `-` | The quote over its attribution | `examples/slides/evidence/showcase-light-11.png` |
| no-attribution | The body carries no such line                   | The quote alone                | not captured                                     |

Flat captures, per `canvas.md` `## States`.

## Copy

- Quote: every body line except the attribution, joined into one, templated per deck
- Attribution: the first line opening with `—` or `-`, with that mark dropped, templated per deck

## Behavior

- The slide's own heading is not drawn. It still names the slide in the source.

## Not on this surface

- No title band
- No quotation mark drawn as a graphic
