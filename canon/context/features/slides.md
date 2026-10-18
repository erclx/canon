---
title: Slides
description: Deck folders, the render and list commands, the HTML converter and deck master, the package step, and the draft skill
---

# Slides

## Overview

A deck is a folder of HTML slides under `.canon/slides/<deck>/`, drawn in the project's own tokens and rendered to a PowerPoint file whose text, shapes, images, tables, and charts stay editable. `canon slides list` and `canon slides render` are the verbs, and `canon:draft-slides` draws the slides from a topic. Start from `canon slides --help`.

## Layout

### `src/slides/`

Finds the decks and runs the render.

- A deck is a folder under `.canon/slides/` holding `.html` slides in filename order, an optional `deck.json`, and `assets/`. It is gitignored and backed by `canon records push`.
- `layouts/` beside the decks is the project's shared layouts and is never a deck, and a folder with no `.html` file is skipped
- `canon slides list --json` gives each deck's name, title, slide count, and path, taking the title from `deck.json` and falling back to the folder name
- `render [deck]` takes a deck name or a folder path, a name winning over a same-named folder, and with no argument renders the only deck or refuses naming the choices
- `--mirror <dir>` copies the render elsewhere, `CANON_SLIDES_MIRROR` sets a default, and `--open` opens the mirror copy when there is one

### `src/slides/convert/`

Lays each slide out in Chromium at 1280 by 720 with the project's tokens injected, then rebuilds what the browser placed as native pptxgenjs shapes.

- The walk runs inside the page and returns one record per element, so every helper it uses sits in its own body
- An element computing a property no shape can carry becomes one picture of itself with its text as alt text
- Every shape is named `canon-<record>` after its element, since pptxgenjs numbers ids itself and the name is the only handle a later pass over the XML has
- `deck.json` holds the title, the bands, slide numbers, and the mark, and a slide's `<body>` carries its section, hidden state, and band overrides as `data-*` attributes
- The master reads the background, text, muted, and accent `--color-*` roles off the first slide's `<html>`, never Canon's own tokens, and each band combination is its own master

### `src/slides/package/`

Edits the package pptxgenjs wrote, since it declares nothing for transitions, animations, or font embedding.

- Motion reads `data-transition` on `<body>` and `data-enter` on an element, and writes each effect from a row naming PowerPoint's own preset id
- An entrance animates every shape drawn from its element's subtree on one click, and an element folded into another record's text reports rather than animating a neighbor
- Font embedding wraps each face `deck.json` lists in an Embedded OpenType header and registers it in the package
- A face is refused by path, with the deck still written, when it is restricted, variable, `woff`, `woff2`, a collection, or outside the deck folder
- A deck needing no patch, motion, or face keeps the bytes pptxgenjs wrote

### Other folders

The skill that draws the slides sits outside `src/`.

- `claude/skills/draft-slides/` reads decks through `canon slides list --json`, draws one `.html` file per slide, and renders through the verb
- It runs one image quality pass over the render when `soffice` and `pdftoppm` exist

## Gotchas

- Each fallback picture and each refused link prints a `✗` line on stderr and the exit stays 0, so read stderr after a render
- A slide overriding a band draws its own text over a master without that band, so editing the footer in PowerPoint reaches every slide except those
- An SVG mark gets a broken PNG fallback because the screenshot patch reaches slides and not layouts, so use a raster mark
- PowerPoint on Windows refuses every embedded face whose EOT checksum is zero, and LibreOffice ignores the checksum, so only the unit test pinning the trailer catches a regression
- Motion is confirmed in LibreOffice only, so whether PowerPoint plays it is an operator check the e2e test cannot make
