---
title: Slides
description: Where a deck folder lives and what it holds, what it declares for the whole deck in deck.json, the faces it embeds, what each slide declares on its own body, transitions and entrances, the master built from the project's tokens, speaker notes, charts, and what each refusal reports
---

# Slides

`canon slides render <deck>` turns a folder of `.html` slides into an editable PowerPoint deck. Each deck lives in its own folder under `.canon/slides/`, which `canon records push` backs and git ignores, and `canon slides list --json` lists them. Each slide describes its own shapes. What belongs to the whole deck, being the bands, the numbers, and the mark, sits in one file beside them, and the master that carries it takes the project's own colors and face.

```bash
canon slides list --json
canon slides render q3-review
```

## The deck folder

| Path                             | Holds                                                |
| -------------------------------- | ---------------------------------------------------- |
| `.canon/slides/<deck>/*.html`    | the slides, rendered in filename order               |
| `.canon/slides/<deck>/deck.json` | what belongs to the whole deck, described below      |
| `.canon/slides/<deck>/assets/`   | images the slides reference by a relative path       |
| `.canon/slides/layouts/`         | the project's shared layouts, never listed as a deck |

A folder holding no `.html` file is not a deck. `render` with no name takes the only deck there is, and refuses with the list when there are several. It also takes a folder path outside `.canon/slides/`.

## The deck file

`deck.json` beside the slides is optional. Without it the deck gets its defaults.

| Field          | Default                        | What it sets                                      |
| -------------- | ------------------------------ | ------------------------------------------------- |
| `title`        | the folder name                | the file's title and the default footer text      |
| `header`       | off                            | a band at the top, with `left`, `center`, `right` |
| `footer`       | on, with the title on the left | a band at the bottom, with the same three slots   |
| `slideNumbers` | `true`                         | the number at the right of the footer             |
| `mark`         | none                           | an image path, relative to the folder, top right  |
| `fonts`        | none                           | faces to embed in the file, described below       |

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

A band takes `show` and the three slots. A declared band merges over its default, so `"footer": { "center": "Internal" }` keeps the title on the left. Declaring any slot turns a band on unless it also says `"show": false`. Set a slot to `""` to empty it.

Slide numbers belong to the footer and hold its right slot. They show only where the footer does, and `footer.right` needs `slideNumbers` set to `false`.

Prefer a raster mark. An SVG mark lands as a vector, and its fallback for a viewer that cannot draw SVG comes out broken.

### Embedded faces

Each entry in `fonts` names one TrueType or OpenType file inside the deck folder, and the deck carries it so it renders in its own face on a machine without the font installed.

- `family` is required and should match the family the slides set, since that is the name PowerPoint looks the face up by.
- `weight` defaults to `400`. PowerPoint holds four faces a family, so `600` and above fills the bold slot and anything lighter fills regular.
- `style` is `normal` or `italic`, defaulting to `normal`.
- `path` is relative to the folder and has to stay inside it.

A face is refused, and the deck still written without it, when its license forbids embedding or allows a bitmap only, when it is a variable font, when it is a `woff` or `woff2` file, or when a second face lands in a slot one already fills. Supply static instances, one per weight, in place of a variable face. For `woff2`, supply the TrueType or OpenType file it was compressed from, which most font downloads ship beside it.

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

## Motion

A slide declares how it arrives on `<body>`, and an element declares how it comes in on its own tag.

| Attribute                  | Takes                           | Effect                                 |
| -------------------------- | ------------------------------- | -------------------------------------- |
| `data-transition`          | `fade`, `push`, `wipe`, `cover` | the transition into this slide         |
| `data-transition-duration` | `500`, `500ms`, or `0.5s`       | rounded to 0.5, 0.75, or 1 second      |
| `data-enter`               | `fade`, `fly`, `wipe`, `zoom`   | an entrance played on a click          |
| `data-enter-order`         | a number                        | the click it plays on, lowest first    |
| `data-enter-duration`      | `500`, `500ms`, or `0.5s`       | the entrance length, 500 ms by default |

```html
<body data-transition="fade">
  <h1>Results</h1>
  <div class="card" data-enter="fly" data-enter-order="1">…</div>
  <div class="card" data-enter="fly" data-enter-order="2">…</div>
</body>
```

Each entrance is its own click. Entrances without an order play after the ordered ones, in page order. An entrance brings in every shape drawn from its element and the elements inside it together, so a card's box and its text arrive on one click, and an element drawn as a picture brings in that picture. An element inside it with its own `data-enter` waits for its own click. Fly comes in from the bottom and wipe from the left.

A transition length rounds to the nearest of the three speeds PowerPoint's file format names, since a length in milliseconds needs an extension the deck does not write.

## The master

The master takes its colors from the `<html>` element of the first slide as Chromium laid it out with the project's token stylesheet injected, so a theme switched on one slide's `<body>`, such as a dark cover, stays on that slide:

- `--color-background`: the slide ground
- `--color-text`: the header text
- `--color-muted`: the footer text
- `--color-accent`: the slide number
- the `<body>` font family, first name with a ` Variable` suffix dropped: the theme face

A role the project declares no token for falls back to the slide body's own color and prints one `✗` line naming it. It never falls back to the toolkit's palette.

A slide whose `<body>` background differs from the master's keeps its own. A slide whose `<body>` computes a `--color-text` apart from the master's prints one `✗` line naming it, since its bands keep the master's colors and may not read against its ground.

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
| `fonts` path missing or outside folder | `✗` naming the field and the path              | 1    |
| face not embeddable                    | `✗` naming the path and the reason             | 0    |
| unknown transition or entrance name    | `✗` naming the slide, the element, the effect  | 0    |
| entrance on an element that draws none | `✗` naming the slide and the element           | 0    |
| chart cell not a number                | `✗` naming the slide, the figure, and the cell | 0    |
| `data-chart` outside the five types    | `✗` naming the value                           | 0    |
| token role not declared                | `✗` naming the role                            | 0    |
| slide body sets its own `--color-text` | `✗` naming the slides                          | 0    |

A refused chart, effect, or face is left out and the rest of the deck is written.
