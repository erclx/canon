# Design

Values live in `src/styles/tokens.css`. This record holds the intent behind them.

## Overview

Tidewell is a tide-table app for people on a shoreline who need one number fast, which is when the water turns. It reads like a printed chart, calm and plain, with pale sand grounds, deep sea ink, and one teal accent for the current tide. Nothing flashes.

## Colors

- Every text role is drawn on `background` and on `surface`.
- `warning` and `error` stay apart from the accent in hue, so a surge alert never reads as a tide marker.
- A rising or falling tide shows by position and a label, never by color.

| Role           | Property                 | Intent                                         |
| -------------- | ------------------------ | ---------------------------------------------- |
| background     | `--color-background`     | page canvas                                    |
| surface        | `--color-surface`        | cards for one day's tide table                 |
| border         | `--color-border`         | every rule and card edge                       |
| text           | `--color-text`           | headings and tide heights                      |
| text-secondary | `--color-text-secondary` | labels, captions, times                        |
| muted          | `--color-muted`          | the faintest step, footnotes                   |
| accent         | `--color-accent`         | the current tide marker, links, primary action |
| success        | `--color-success`        | a confirmed saved location                     |
| warning        | `--color-warning`        | a surge advisory                               |
| error          | `--color-error`          | a failed data fetch                            |
| night          | `--color-night`          | the canvas of the night-mode chart             |

## Typography

- A humanist sans sets every role but `tide`.
- `tide` takes a tabular monospace so heights align in a column.
- Display, heading, body, and label are the only other roles, and no screen uses more than three.

## Spacing

- Six steps. The first four double, and the last two add one rem each.

## Shapes

- Every border is one pixel solid at the `border` role.

| Role  | Property         | When used                      |
| ----- | ---------------- | ------------------------------ |
| card  | `--radius-card`  | one day's tide table           |
| input | `--radius-input` | the location search field      |
| chip  | `--radius-chip`  | tags for a station, none built |

## Layout

- One column up to 40rem, then a day list beside the chart.
- The chart never drops below 20rem wide.
- At the 320 pixel reflow floor the day list scrolls, never the chart.

## Motion

- None. The tide marker jumps to its new position on a data refresh.

## Iconography

- Lucide, outlined at a 1.5 pixel stroke.
- No custom icons. A station or an advisory takes the nearest library glyph.
- No brand mark yet, so the page carries none.
