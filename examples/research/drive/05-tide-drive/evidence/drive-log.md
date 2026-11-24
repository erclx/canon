# Drive log

<!-- canon-length-exempt: a drive log is one record appended per finding, read top to bottom -->

| Setup     | Value                                             |
| --------- | ------------------------------------------------- |
| Commit    | `c7d2e18`                                         |
| Copy      | `/tmp/tmp.Rw83/tidewell`                          |
| Launch    | `bun install && bun run build && bun run preview` |
| Address   | `http://127.0.0.1:4310`                           |
| Board     |                                                   |
| In flight | `feat/zone-labels` holds `src/tides/format.ts`    |

## 01. A beachgoer finds the next high tide for Cascais

`pass` · goal · beachgoer on a phone

- **Did:** searched Cascais, opened the station, read the next high
- **Evidence:** `evidence/week/01-cascais-next-high.png`

## 02. The current tide marker sits under the day list

`major` · goal · beachgoer on a phone

- **Did:** opened the Cascais week view at 320 pixels wide
- **Saw:** the marker drew at x 298, under the 40 pixel day list, so no current tide showed
- **Cause:** measured, the marker is placed against the page width rather than the chart's box
- **Evidence:** `evidence/week/02-marker-hidden.png`
- **Drawn:** `evidence/week/02-options.png`, `evidence/mocks/week/`
- **Decision (operator):** clamp the marker inside the chart and keep the day list where it is

## 03. The week chart scrolls sideways at the reflow floor

`minor` · script · harbor pilot on a phone

- **Did:** ran step 3 of `canon/drive/week.md`, resizing to 320 pixels
- **Saw:** scrollWidth 436 against clientWidth 320 on the chart container
- **Cause:** read from code, the chart's minimum width is 436 pixels where the design record sets 20rem
- **Evidence:** `evidence/week/03-chart-scroll.png`
- **Drawn:** skipped, the fix restores the layout the design record already states
- **Decision (operator):** see 02

## 04. A harbor pilot compares two stations on a desktop

`pass` · goal · harbor pilot on a desktop

- **Did:** opened Cascais and Peniche side by side at 1440 pixels
- **Evidence:** `evidence/week/04-two-stations.png`
