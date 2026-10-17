---
title: Slides
description: Deck folders, render and list commands, HTML converter, deck master, package step, draft skill
---

# Slides

## Overview

A deck is a folder of HTML slides under `.canon/slides/<deck>/`, drawn in the project's own tokens and rendered to a PowerPoint file whose text, shapes, images, tables, and charts stay editable. A Claude Code skill draws the slides from a topic, and a CLI command lists the decks and renders one.

## Layout

- `src/slides/decks.ts` owns deck discovery, being which folders are decks and which one a render names
- `src/slides/convert/` owns the HTML converter and the deck master
- `src/slides/package/` owns edits to the package pptxgenjs wrote, being slide motion and embedded faces, kept apart from the conversion that produces it

### Deck folders

Three locations hold deck state.

- `.canon/slides/<deck>/` owns each deck's slides, `deck.json`, and assets, gitignored and backed by `canon records push`
- `.canon/slides/layouts/` owns the project's shared layouts and is never a deck
- `.canon/tmp/render/slides/` owns rendered decks, gitignored

### List

`canon slides list --json` emits one row per deck, carrying its `name`, `title`, slide count, and `path`. A folder with no `.html` file is skipped, as is `layouts/`.

The title comes from `deck.json`, falling back to the folder name as the export does. A malformed `deck.json` still lists under that fallback, so the render is what reports it.

### Render

`canon slides render [deck]` takes a deck name or a folder path, and a deck name wins over a folder of the same name in the project root.

- With no argument it renders the only deck, refuses naming `.canon/slides/` when none exists, and refuses with the deck list when there are several
- The success frame goes to stderr and stdout stays clean, per the standard stream contract
- `--mirror <dir>` copies the rendered deck into another directory, and `CANON_SLIDES_MIRROR` sets a default so the path stays out of the repo
- `--open` opens the deck after writing, targeting the mirror copy when present. On WSL it opens through the Windows shell.

## Decisions

### Where decks live

A deck is a draft made with Claude, so it lives under the record root rather than a committed folder. Images and video would otherwise grow git history for good. The cost is that no deck is reviewable in a pull request.

- `slides` is a record entry, so `canon records push` backs it. A `.canon` root pushes every top-level folder, and a legacy `.claude` root reads `BACKED_FOLDERS`.
- A deck folder holds `.html` slides in filename order, an optional `deck.json`, and `assets/`
- Authoring a deck as a canvas page stays open until that surface is measured, and it would export into the same folder shape

### What is not shipped

No slides capture is committed, so none is prod evidence today. A dev baseline would sit at `assets/evidence/slides/` and does not exist. `canon/context/development/evidence.md` owns the boundary.

There is no markdown deck source and no set of layouts. A markdown source painted every project's deck in Canon's palette and could carry no image, chart, table, notes, or motion, so nothing migrates one.

### HTML converter

Chromium lays out each `.html` file in filename order at 1280 by 720 CSS pixels with `resolveFrameTokens` injected ahead of the slide's own styles. The converter rebuilds what the browser placed as native pptxgenjs shapes.

- **`walk.ts`** runs inside the page and returns one plain record per element. Playwright serializes it to source, so every helper sits inside its body.
- Text gathers along the inline flow, so `<strong>` inside `<p>` is one shape with two runs, and a block-level child is walked on its own
- **`svg.ts`** resolves `currentColor` and `var(--*)` to the colors the browser computed, since inside a slide nothing supplies either and the vector draws black

### Shape rules

`shapes.ts` maps records to shapes and holds the rules.

- Padding plus border width is the text inset, and a uniform border and radius apply to boxes and pictures
- The first line lifts by half the leading, a bullet glyph comes from the computed `list-style-type`, and `letter-spacing` becomes character spacing
- It writes `#slide-N` links plus `http:`, `https:`, and `mailto:` URLs, the first `box-shadow`, `alt` text, and tables sized from their cell edges with spans kept
- Every shape is named `canon-<record>` after its element, and an image frame `canon-<record>-frame`
- pptxgenjs numbers shape ids itself, so the name is the only handle a later pass over the XML has, and it survives a fallback picture shifting the id order

### Export

`export.ts` drives the browser, writes the package, then patches two things pptxgenjs cannot write. It finds each patched picture by its object name, through `jszip`.

- It swaps a real screenshot into each SVG's PNG fallback, which pptxgenjs fills with the SVG's own bytes in Node
- It rounds a picture's corners, which pptxgenjs has no option for
- A deck needing no patch, motion, or face keeps the bytes pptxgenjs wrote

### Unmapped properties

An element computing any property in `UNMAPPED_PROPERTIES` becomes one picture of itself carrying its text as alt text. Its parent and siblings stay native and nothing beneath it is drawn twice.

- Text blocks count the inline elements their runs came from, and tables count their cells, since neither is drawn as a shape of its own
- Three entries flag a shape rather than a bare property. `box-shadow` flags a second shadow, `border` flags sides that differ or are missing, and `border-radius` flags corners that differ.
- Cells write each edge on their own, so only their drawn edges have to agree in color and style

### Refused links

Links that would go nowhere are left out, being a `#slide-N` past the deck's end or a target in no accepted form. Each fallback and each refused link prints one `✗` line on stderr, and the exit stays 0. An empty folder refuses with a message naming it.

### Deck master

What belongs to the deck rather than one slide lives in two places. `deck.json` beside the slides holds the title, the header and footer bands, slide numbers, and the mark, read by `deck.ts` with a structured refusal per field.

A slide declares its section, whether it is hidden, and any band it drops or overrides as `data-*` attributes on its own `<body>`, so a slide file stays self-describing.

### Master colors

`master.ts` builds the master from `--color-background`, `--color-text`, `--color-muted`, and `--color-accent` as the first slide's `<html>` computes them, and from its body face. It never reads `@/design/tokens`, which is Canon's own palette.

- Reading `<html>` rather than `<body>` keeps a dark cover's body theme off the footer every other slide shares
- A slide whose body `--color-text` departs from the master's is named on stderr
- A role with no token falls back to the slide body's color and says so on stderr

### Bands and numbers

pptxgenjs binds a slide to its master at `addSlide`, so the bands a slide keeps pick its master before any shape lands. Each band combination is its own master, defined on first use, so a slide hiding only the header keeps the footer and numbers.

- A slide overriding a band draws its own text over a master without that band. Editing the footer once in PowerPoint reaches every slide except those.
- Slide numbers belong to the footer band and hold its right slot
- pptxgenjs writes a master as a `slideLayout` part, so the band text, the mark, and the number field land there rather than in `slideMaster1.xml`

### Charts, sections, and the mark

A chart reads its table in the page and maps it in `chart.ts`. Series take the accent, then every other declared `--color-*` role in sheet order except the background and surface, each color once, repeating past the last.

- Sections need every slide in one once any exists, so slides ahead of the first `data-section` open a section named after the deck. The sources are read first to see if any declares one.
- pptxgenjs files a slide under the first section carrying its title, so a returning title gets a numbered suffix rather than a slide filed out of order
- The mark sits top right at its own aspect inside a 1.2 by 0.4 inch box
- An SVG mark gets the broken PNG fallback, since the screenshot patch reaches slides and not layouts, so use a raster mark

### Package step

pptxgenjs declares nothing for transitions, animations, or font embedding, so `src/slides/package/` writes all three into the package after it. Two spikes proved the approach in LibreOffice before the step was built.

- `motion.ts` reads `data-transition` on `<body>` and `data-enter` on an element from `walk.ts`, and inserts `<p:transition>` and an on-click `<p:timing>` sequence after `</p:clrMapOvr>`
- A slide missing that anchor is refused
- Each effect is a row naming PowerPoint's own preset id, so it shows by name in the animation pane and a new effect costs one row
- A transition length rounds to `fast`, `med`, or `slow`, since the strict schema states no milliseconds and `p14:dur` needs the PowerPoint 2010 extension namespace

### Entrance animation

An entrance animates every shape drawn from its element's subtree on one click, stopping at a descendant with its own entrance. It resolves object names to the shape ids the written XML holds.

pptxgenjs can give a table the id of a shape beside it, so an animated slide renumbers each repeated id first. An element folded into another record's text, or drawing nothing, reports rather than animating a neighbor.

### Font embedding

`fonts.ts` wraps each face `deck.json` lists in an Embedded OpenType 2.2 header built from its `OS/2`, `head`, and `name` tables. It writes `ppt/fonts/fontN.fntdata`, registers the relationship and content type, lists the family after `<p:notesSz>`, and sets `embedTrueTypeFonts="1"`.

The header follows the W3C EOT submission, which puts one padding field before the family name. LibreOffice reads either layout, and a real face decodes under the spec's.

### The EOT checksum

`RootStringCheckSum` is the root string's byte sum XOR `0x50475342`, so a face with no root string still writes that constant. A zero checksum makes PowerPoint on Windows refuse every face with a "General Failure" install error, since the spec tells a reader to treat a mismatch as tampering.

- A byte patch of the checksum alone made both faces install, so `Charset` stays `1` and `EUDCCodePage` stays zero, though LibreOffice's own export writes `0` and `1252`
- LibreOffice ignores the checksum, so no local check catches a regression, and the unit test pins the whole 20-byte trailer instead

### Refusals and confirmation

A face is refused by path, with the deck still written, in four cases.

- `fsType` sets the restricted or bitmap-only bit, or the face carries an `fvar` table
- It is `woff`, `woff2`, or a collection, or its slot is taken
- Faces ship to the page as base64 `woff2`, and decoding one is a new dependency for a case no deck has hit, so a deck lists TrueType or OpenType files
- Canon's own face is variable, so Canon's deck embeds nothing until static instances exist
- A face path is read only from inside the deck folder, so a `deck.json` cannot carry a file from elsewhere on the machine out inside the deck

### What is confirmed where

The embedded face is confirmed in PowerPoint on Windows, rendering in Regular and Bold with no install dialog. Motion is confirmed in LibreOffice only, and whether PowerPoint plays it is an operator check the e2e test cannot make.

The e2e face is a synthetic sfnt from `test-face.ts` holding only the three header tables, so it embeds and never renders.

### Margin units and lift

pptxgenjs 4 reads a text margin as left, right, bottom, top in points, while a table cell margin reads as top, right, bottom, left in inches. The half-leading lift was measured in LibreOffice rather than PowerPoint, and single-line text there lands about 4 to 6 pixels above the browser.

### Draft skill

`canon:draft-slides` reads the decks through `canon slides list --json` and the slide format through `canon docs slides`, draws one `.html` file per slide with the project's custom properties, and shells out to the render command. It owns the deck content and markup and never reimplements the conversion, master, or packaging.

After the first render it reads every `✗` line and runs a one-pass quality check. It converts the deck to images with `soffice` and `pdftoppm`, inspects every slide for overlap, overflow, and contrast, fixes once, and stops. The image pass is skipped with a note when those tools are absent.
