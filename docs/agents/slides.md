---
title: Slides
description: What a folder of HTML slides declares for the whole deck in deck.json, what each slide declares on its own body, the master built from the project's tokens, speaker notes, charts, and what each refusal reports
---

# Slides

`canon slides render --source <folder>` turns a folder of `.html` slides into an editable PowerPoint deck. Each slide describes its own shapes. What belongs to the whole deck, being the bands, the numbers, and the mark, sits in one file beside them, and the master that carries it takes the project's own colors and face.

```bash
canon slides render --source slides/q3-review
```

## The deck file

`deck.json` beside the slides is optional. Without it the deck gets its defaults.

| Field          | Default                        | What it sets                                      |
| -------------- | ------------------------------ | ------------------------------------------------- |
| `title`        | the folder name                | the file's title and the default footer text      |
| `header`       | off                            | a band at the top, with `left`, `center`, `right` |
| `footer`       | on, with the title on the left | a band at the bottom, with the same three slots   |
| `slideNumbers` | `true`                         | the number at the right of the footer             |
| `mark`         | none                           | an image path, relative to the folder, top right  |

```json
{
  "title": "Q3 review",
  "header": { "left": "Acme" },
  "footer": { "center": "Internal" },
  "mark": "assets/mark.png"
}
```

A band takes `show` and the three slots. A declared band merges over its default, so `"footer": { "center": "Internal" }` keeps the title on the left. Declaring any slot turns a band on unless it also says `"show": false`. Set a slot to `""` to empty it.

Slide numbers belong to the footer and hold its right slot. They show only where the footer does, and `footer.right` needs `slideNumbers` set to `false`.

Prefer a raster mark. An SVG mark lands as a vector, and its fallback for a viewer that cannot draw SVG comes out broken.

## What each slide declares

A slide sets its own place in the deck through attributes on `<body>`.

| Attribute                               | Effect                                        |
| --------------------------------------- | --------------------------------------------- |
| `data-section="Results"`                | opens a section the slides after it stay in   |
| `data-hidden`                           | hides the slide in the show                   |
| `data-header="off"`                     | drops the header on this slide                |
| `data-footer="off"`                     | drops the footer and its number on this slide |
| `data-footer-left`, `-center`, `-right` | replaces that footer slot on this slide alone |
| `data-header-left`, `-center`, `-right` | replaces that header slot on this slide alone |

Once any slide opens a section, slides ahead of the first one sit in a section named after the deck, since PowerPoint wants every slide in one. A title the deck returns to after another section opens a new section numbered `Intro (2)`, so each section stays one run of slides.

A slide dropping one band keeps the other from the master. A slide replacing a slot draws its band as its own text, so editing that band once in PowerPoint's master view reaches every slide except the ones that replaced it.

## The master

The master takes its colors from the first slide as Chromium laid it out with the project's token stylesheet injected:

- `--color-background`: the slide ground
- `--color-text`: the header text
- `--color-muted`: the footer text
- `--color-accent`: the slide number
- the `<body>` font family, first name with a ` Variable` suffix dropped: the theme face

A role the project declares no token for falls back to the slide body's own color and prints one `✗` line naming it. It never falls back to the toolkit's palette.

A slide whose `<body>` background differs from the master's keeps its own.

## Speaker notes

`<aside class="notes">` becomes the slide's notes and is never drawn. Each paragraph or list item becomes its own line, and markup is dropped.

## Charts

A `<figure data-chart="...">` holding a `<table>` becomes a native, editable chart placed where the figure was laid out. The table stays the page's accessible source and is not drawn as well.

```html
<figure data-chart="bar" data-labels>
  <figcaption>Revenue by region</figcaption>
  <table>
    <tr>
      <th>Region</th>
      <th>Q1</th>
      <th>Q2</th>
    </tr>
    <tr>
      <td>North</td>
      <td>12</td>
      <td>16</td>
    </tr>
    <tr>
      <td>South</td>
      <td></td>
      <td>11</td>
    </tr>
  </table>
</figure>
```

- `data-chart` takes `bar`, `line`, `area`, `pie`, or `doughnut`.
- The header row names the series and the first column names the categories.
- An empty cell is a gap, not a zero. A comma is a thousands separator only where it groups in threes, as in `12,345.5`, so a comma-decimal `3,5` refuses rather than reading as 35.
- `data-labels` shows each value. A `<figcaption>` becomes the chart title.
- Series take the accent first, then every other declared `--color-*` role in sheet order except the background and surface, repeating past the last.

## Refusals

| Case                                   | Report                                         | Exit |
| -------------------------------------- | ---------------------------------------------- | ---- |
| `deck.json` field malformed or unknown | `✗` naming the file and the field              | 1    |
| `mark` path missing                    | `✗` naming the resolved path                   | 1    |
| chart cell not a number                | `✗` naming the slide, the figure, and the cell | 0    |
| `data-chart` outside the five types    | `✗` naming the value                           | 0    |
| token role not declared                | `✗` naming the role                            | 0    |

A refused chart is left out and the rest of the deck is written.
