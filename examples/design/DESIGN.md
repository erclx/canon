# Design

## Personality

Tidewell is a tide-table app for people who walk a shoreline and need one number fast: when the water turns. The voice is calm and plain, and the interface reads like a printed chart, with pale sand grounds, deep sea ink for text and one teal accent for the current tide. Nothing flashes. A rising or falling tide is shown by position and a label, never by a loud color.

The warning and error roles stay distinct from the accent in hue, so a storm surge alert never reads as an ordinary tide marker. The brand wordmark is not set yet, so the page carries no mark and the tagged cells below are proposals for the first build to confirm.

## Color

Every text role is drawn on `background` and on `surface`.

| Role           | Intent                                         | Value            |
| -------------- | ---------------------------------------------- | ---------------- |
| background     | page canvas                                    | #f7f4ec          |
| surface        | cards for one day's tide table                 | #ece7da          |
| border         | every rule and card edge                       | #d4cdbb          |
| text           | headings and tide heights                      | #14303b          |
| text-secondary | labels, captions, times                        | #4a6672          |
| muted          | the faintest step, footnotes                   | #6d7f86 ? verify |
| accent         | the current tide marker, links, primary action | #0f7c8a          |
| success        | a confirmed saved location                     | #2f7d4f          |
| warning        | a surge advisory                               | #b7791f          |
| error          | a failed data fetch                            | #b3392f          |
| night          | the canvas of the night-mode chart             | #0c2230 ? verify |

## Typography

Two families carry the page. A humanist sans sets every role but `tide`, and a tabular monospace sets `tide` so heights align in a column. The render declares no face, so each Family cell names a stack a target replaces with its own faces.

| Role    | Family                                 | Weight       | Size      | Line height  |
| ------- | -------------------------------------- | ------------ | --------- | ------------ |
| display | Source Sans 3, system-ui, sans-serif   | 700          | 2.25rem   | 1.2          |
| heading | Source Sans 3, system-ui, sans-serif   | 600          | 1.375rem  | 1.3          |
| body    | Source Sans 3, system-ui, sans-serif   | 400          | 1rem      | 1.6          |
| label   | Source Sans 3, system-ui, sans-serif   | 600 ? verify | 0.8125rem | 1.4 ? verify |
| tide    | IBM Plex Mono, ui-monospace, monospace | 500          | 1.125rem  | 1.3          |

## Spacing

Six steps run from a quarter rem to four, doubling after the second.

| Step | Multiplier | Value         |
| ---- | ---------- | ------------- |
| xs   | 1          | 0.25rem       |
| sm   | 2          | 0.5rem        |
| md   | 4          | 1rem          |
| lg   | 8          | 2rem          |
| xl   | 12         | 3rem ? verify |
| 2xl  | 16         | 4rem          |

## Borders

Every border is one pixel solid at the `border` role.

| Role  | Radius         | Width         | When used                      |
| ----- | -------------- | ------------- | ------------------------------ |
| card  | 8px            | 1px           | one day's tide table           |
| input | 6px            | 1px           | the location search field      |
| rule  | none           | 1px           | dividers between tide rows     |
| chip  | 999px ? verify | none ? verify | tags for a station, none built |

## Layout

The page is one column up to 40rem, then two columns, a day list beside the chart. The chart never drops below 20rem wide, so the 320 pixel reflow floor scrolls the day list rather than the chart.

## Motion

Motion is not used. The tide marker jumps to a new position on a data refresh, with no transition.

## Iconography

Icons are outlined at a 1.5 pixel stroke and drawn from Lucide. Custom icons are not allowed, so a station or an advisory takes the nearest library glyph.
