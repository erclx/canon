---
title: Deck reference
description: The deck folder, the deck.json fields, the attributes a slide sets on its body, motion, the master's token roles, speaker notes, and charts
---

# Deck reference

Applies to the slides under `.canon/slides/<deck>/`, which `canon slides render <deck>` turns into an editable PowerPoint file. Each slide describes its own shapes. What belongs to the whole deck sits in `deck.json`.

## Contents

- [The deck folder](#the-deck-folder)
- [The deck file](#the-deck-file)
- [What each slide declares](#what-each-slide-declares)
- [Motion](#motion)
- [The master](#the-master)
- [Speaker notes](#speaker-notes)
- [Charts](#charts)

## The deck folder

| Path                             | Holds                                                |
| -------------------------------- | ---------------------------------------------------- |
| `.canon/slides/<deck>/*.html`    | the slides, rendered in filename order               |
| `.canon/slides/<deck>/deck.json` | what belongs to the whole deck                       |
| `.canon/slides/<deck>/assets/`   | images the slides reference by a relative path       |
| `.canon/slides/layouts/`         | the project's shared layouts, never listed as a deck |

A folder holding no `.html` file is not a deck. `render` with no name takes the only deck, and refuses with the list when there are several. It also takes a folder path outside `.canon/slides/`.

## The deck file

`deck.json` is optional. Without it the deck takes the defaults below.

| Field          | Default                        | What it sets                                      |
| -------------- | ------------------------------ | ------------------------------------------------- |
| `title`        | the folder name                | the file's title and the default footer text      |
| `header`       | off                            | a band at the top, with `left`, `center`, `right` |
| `footer`       | on, with the title on the left | a band at the bottom, with the same three slots   |
| `slideNumbers` | `true`                         | the number at the right of the footer             |
| `mark`         | none                           | an image path, relative to the folder, top right  |
| `fonts`        | none                           | faces to embed in the file                        |

```json
{
  "title": "Q3 review",
  "header": { "left": "Acme" },
  "footer": { "center": "Internal" },
  "mark": "assets/mark.png",
  "fonts": [
    { "family": "Inter", "path": "fonts/Inter-Regular.ttf" },
    { "family": "Inter", "weight": 700, "path": "fonts/Inter-Bold.ttf" }
  ]
}
```

### Bands and the mark

A band takes `show` and the three slots. A declared band merges over its default, so `"footer": { "center": "Internal" }` keeps the title on the left. Declaring any slot turns a band on unless it also says `"show": false`. Set a slot to `""` to empty it.

- Slide numbers hold the footer's right slot and show only where the footer does. Set `slideNumbers` to `false` to use `footer.right`.
- Prefer a raster mark, since an SVG mark lands as a vector with a broken fallback.

### Embedded faces

Each `fonts` entry names one TrueType or OpenType file inside the deck folder:

| Key      | Default  | Rule                                                                |
| -------- | -------- | ------------------------------------------------------------------- |
| `family` | required | match the family the slides set                                     |
| `weight` | `400`    | `600` and above fills the bold slot, anything lighter fills regular |
| `style`  | `normal` | `normal` or `italic`                                                |
| `path`   | required | relative to the folder, and has to stay inside it                   |

A face is left out, and the deck still written, when its license forbids embedding, when it is a variable font or a `woff` or `woff2` file, or when a second face lands in a filled slot. Supply static instances, one per weight, and the TrueType or OpenType file a `woff2` was compressed from.

## What each slide declares

A slide sets its place in the deck through attributes on `<body>`.

| Attribute                               | Effect                                        |
| --------------------------------------- | --------------------------------------------- |
| `data-section="Results"`                | opens a section the slides after it stay in   |
| `data-hidden`                           | hides the slide in the show                   |
| `data-header="off"`                     | drops the header on this slide                |
| `data-footer="off"`                     | drops the footer and its number on this slide |
| `data-footer-left`, `-center`, `-right` | replaces that footer slot on this slide alone |
| `data-header-left`, `-center`, `-right` | replaces that header slot on this slide alone |

Once any slide opens a section, slides ahead of the first sit in a section named after the deck. A title the deck returns to after another section opens a new section numbered `Intro (2)`.

A slide dropping one band keeps the other from the master. A slide replacing a slot draws its band as its own text, so a later edit in the master view skips it.

## Motion

| Attribute                  | Takes                           | Effect                                 |
| -------------------------- | ------------------------------- | -------------------------------------- |
| `data-transition`          | `fade`, `push`, `wipe`, `cover` | the transition into this slide         |
| `data-transition-duration` | `500`, `500ms`, or `0.5s`       | rounded to 0.5, 0.75, or 1 second      |
| `data-enter`               | `fade`, `fly`, `wipe`, `zoom`   | an entrance played on a click          |
| `data-enter-order`         | a number                        | the click it plays on, lowest first    |
| `data-enter-duration`      | `500`, `500ms`, or `0.5s`       | the entrance length, 500 ms by default |

`data-transition` and `data-transition-duration` go on `<body>`. The `data-enter` family goes on the element.

```html
<body data-transition="fade">
  <h1>Results</h1>
  <div class="card" data-enter="fly" data-enter-order="1">…</div>
  <div class="card" data-enter="fly" data-enter-order="2">…</div>
</body>
```

- Each entrance is its own click, and entrances without an order play after the ordered ones, in page order.
- An entrance brings in every shape drawn from its element and the elements inside it, so a card's box and text arrive together.
- An inner element with its own `data-enter` waits for its own click.
- Fly comes in from the bottom and wipe from the left.

## The master

The master takes its colors from the `<html>` element of the first slide, laid out with the project's token stylesheet injected:

| Source                                       | Used for         |
| -------------------------------------------- | ---------------- |
| `--color-background`                         | the slide ground |
| `--color-text`                               | the header text  |
| `--color-muted`                              | the footer text  |
| `--color-accent`                             | the slide number |
| `<body>` font family, ` Variable` suffix cut | the theme face   |

A role the project declares no token for falls back to the slide body's own color and prints one `✗` line naming it. It never falls back to the toolkit's palette.

A slide whose `<body>` background differs from the master's keeps its own. A slide whose `<body>` computes a `--color-text` apart from the master's prints a `✗` line, since its bands keep the master's colors and may not read against its ground.

## Speaker notes

`<aside class="notes">` becomes the slide's notes and is never drawn. Each paragraph or list item becomes its own line, and markup is dropped.

## Charts

A `<figure data-chart="...">` holding a `<table>` becomes a native, editable chart where the figure was laid out. The table is not drawn as well.

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
- An empty cell is a gap, not a zero. A comma is a thousands separator only where it groups in threes, as in `12,345.5`, so a comma-decimal `3,5` refuses.
- `data-labels` shows each value, and a `<figcaption>` becomes the chart title.
- Series take the accent first, then every other declared `--color-*` role in sheet order except the background and surface, repeating past the last.

A refused chart, effect, or face is left out and the rest of the deck is written. Each prints a `✗` line, and the exit depends on the case:

| Case                                                                    | Exit |
| ----------------------------------------------------------------------- | ---- |
| malformed or unknown `deck.json` field                                  | 1    |
| `mark` path missing                                                     | 1    |
| `fonts` path missing or outside the folder                              | 1    |
| face that cannot embed                                                  | 0    |
| unknown transition or entrance name                                     | 0    |
| entrance on an element that draws nothing                               | 0    |
| chart cell that is not a number, or `data-chart` off-list               | 0    |
| token role not declared, or a slide body setting its own `--color-text` | 0    |
