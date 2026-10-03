---
title: Slides
description: SLIDES.md source shape, layout catalog, render command, HTML converter, draft skill
---

# Slides

## Overview

`.claude/SLIDES.md` holds a slide deck as markdown. The toolkit treats it as the source of truth and renders it to a PowerPoint deck on demand. Two surfaces sit around it: a Claude Code skill drafts the file from a topic and picks a layout per slide, and a CLI command renders the deck for inspection.

## Layout

- `src/slides/` owns the parser, the layout functions, the design tokens, and the render
- `src/slides/convert/` owns the HTML converter, kept apart from the markdown engine it replaces
- `src/slides/package/` owns edits to the package pptxgenjs wrote, being slide motion and embedded faces, kept apart from the conversion that produces it
- `examples/slides/` owns the reference deck that exercises every layout
- `.canon/tmp/render/slides/` owns rendered decks, gitignored

## Decisions

- The engine is a fresh general-purpose layer, not a port of any single project's deck modes. It ships one source format with a per-slide layout, so any repo writes its own `SLIDES.md` and renders with the same command.
- The source is committed. The rendered `.pptx` lands in the gitignored `.canon/tmp/render/slides/` and can be regenerated at any time.
- The palette is a paper background with a rust accent, deliberately not blue. The five theme colors are read from the design module by role rather than restated, so a deck moves when the decided system does. Each variant takes its own accent, a lighter rust on dark and a deeper one on light, since the module tunes each for its ground.
- The face is read from the design module too, as Geist, with the ` Variable` suffix dropped to the installed name `Geist`. The markdown path embeds nothing, so a viewer without the face sees PowerPoint's own substitute. The HTML path embeds the faces `deck.json` lists, described under Package step. Point sizes stay a deck-owned scale in `TYPE`, since the module's `t0` to `t6` steps are screen pixels and a literal mapping would shrink the cover to 38 pt and the body to 11 pt.

## Source shape

A `SLIDES.md` opens with deck frontmatter between `---` delimiters:

- `title`, the deck title written into the file metadata
- `variant`, `light` or `dark`

Each slide follows as a section, separated by a `---` rule. A slide opens with a `# Title` and a `layout:` line naming a layout, then carries content shaped to that layout. When a slide omits `layout:`, the parser infers `bullets` for content with list items and `title` otherwise.

A `layout:` value outside the catalog falls back to the bullets layout rather than failing the render. `canon slides render` still reports it, naming the value read, the slide it sits on, and the nine catalog names, one line per unrecognized value with duplicate slides collapsed into it. The exit code stays 0, since the report is the whole deliverable and a typo degrades rather than blocks.

## Layout catalog

`canon slides list --json` emits the catalog so a skill reads layout names at runtime rather than hardcoding them. The layouts cover a cover title, a contents slide, a section divider, a bullet list, two labeled columns, a row of stat callouts, a card grid, and a pull quote. Each layout function owns its geometry and enforces the type scale, so content sizes to fit rather than overflowing.

`freeform` is the ninth: it reads an explicit position and size per shape from the source line and takes its color from the shared palette, with no layout algorithm between the two. It still draws its title through the shared title band, which occupies the top 1.4 inches of the canvas, so a shape declared above `y=1.4` renders underneath the heading.

## Navigation

A `toc` slide renders a clickable contents list. The render builds the navigation in a pre-pass that numbers every slide, so the contents links jump to each `section` slide by position with no hand-written slide numbers. Every slide except the cover and the contents slide carries a footer with the deck title and a `Contents` link back to the `toc` slide. A deck without a `toc` slide gets the deck-title footer with no link.

## Theme

`canon/DESIGN.md` owns the palette and the face, and `src/slides/styles.ts` maps them onto the deck, adding the point scale and the light and dark variant mapping. A deck selects its variant through its frontmatter or a render flag.

## Render command

`canon slides render --source .claude/SLIDES.md --out .canon/tmp/render/slides` parses the source, builds the deck with pptxgenjs, and writes one `.pptx` named after the source. A `--variant light` or `--variant dark` flag overrides the frontmatter variant for a one-off render. Data and logs follow the standard stream contract: the success frame goes to stderr, leaving stdout clean.

`--mirror <dir>` copies the rendered deck into another directory after writing, and the `CANON_SLIDES_MIRROR` environment variable sets a default mirror so the path stays out of the repo. `--open` opens the deck after writing, targeting the mirror copy when present. On WSL it opens through the Windows shell, elsewhere through the platform opener.

## HTML converter

A folder passed as `--source` takes a second path. Chromium lays out each `.html` file in filename order at 1280 by 720 CSS pixels with `resolveFrameTokens` injected ahead of the slide's own styles, and the converter rebuilds what the browser placed as native pptxgenjs shapes. The markdown path stays as it was until deck folders retire it, so the two engines share only the command.

- `walk.ts` runs inside the page and returns one plain record per element. Playwright serializes it to source, so every helper sits inside its body. Text gathers along the inline flow, which makes `<strong>` inside `<p>` one shape with two runs, and a block-level child is walked on its own.
- `shapes.ts` maps records to shapes and holds the rules: padding plus border width as the text inset, a uniform border and radius on boxes and pictures, the first line lifted by half the leading, a bullet glyph from the computed `list-style-type`, and `letter-spacing` as character spacing.
- `shapes.ts` also writes `#slide-N` links plus `http:`, `https:`, and `mailto:` URLs, the first `box-shadow`, `alt` text, and tables sized from their cell edges with spans kept.
- `svg.ts` resolves `currentColor` and `var(--*)` to the colors the browser computed, since inside a slide nothing supplies either and the vector draws black.
- `shapes.ts` names every shape `canon-<record>` after the element it came from, and an image frame `canon-<record>-frame`. pptxgenjs numbers shape ids itself, so the name is the only handle a later pass over the written XML has, and it survives a fallback picture shifting the id order.
- `export.ts` drives the browser, writes the package, then patches two things pptxgenjs cannot write. It swaps a real screenshot into each SVG's PNG fallback, which pptxgenjs fills with the SVG's own bytes in Node, and it rounds a picture's corners, which pptxgenjs has no option for. It finds each patched picture by its object name, through `jszip`. A deck needing no patch, motion, or face keeps the bytes pptxgenjs wrote.

An element computing any property in `UNMAPPED_PROPERTIES` becomes one picture of itself carrying its text as alt text, while its parent and siblings stay native and nothing beneath it is drawn twice. Text blocks count the inline elements their runs came from, and tables count their cells, since neither is drawn as a shape of its own. Three entries flag a shape rather than a bare property: `box-shadow` flags a second shadow, `border` flags sides that differ or are missing, and `border-radius` flags corners that differ. Cells write each edge on their own, so only their drawn edges have to agree in color and style.

Links that would go nowhere are left out, being a `#slide-N` past the deck's end or a target in no accepted form. Each fallback and each refused link prints one `✗` line on stderr, and the exit stays 0, as with an unrecognized layout. An empty folder refuses with a message naming it.

## Deck master

What belongs to the deck rather than to one slide lives in two places. `deck.json` beside the slides holds the title, the header and footer bands, slide numbers, and the mark, read by `deck.ts` with a structured refusal per field. A slide declares its section, whether it is hidden, and any band it drops or overrides as `data-*` attributes on its own `<body>`, so a slide file stays self-describing.

- `master.ts` builds the master from `--color-background`, `--color-text`, `--color-muted`, and `--color-accent` as the first slide's `<html>` computes them, and from its body face, never from `@/design/tokens`, which is Canon's own palette. Reading `<html>` rather than `<body>` keeps a dark cover's body theme off the footer every other slide shares, and a slide whose body `--color-text` departs from the master's is named on stderr. A role with no token falls back to the slide body's color and says so on stderr. `src/slides/styles.ts` keeps its own mapping for the markdown path until deck folders retire it.
- pptxgenjs binds a slide to its master at `addSlide`, so the bands a slide keeps pick its master before any shape lands. Each band combination is its own master, defined on first use, so a slide hiding only the header keeps the master's footer and numbers.
- A slide overriding a band draws its own text over a master without that band, merged over the deck's slots. Editing the footer once in PowerPoint reaches every slide except those.
- Slide numbers belong to the footer band and hold its right slot. pptxgenjs writes a master as a `slideLayout` part, so the band text, the mark, and the number field land there rather than in `slideMaster1.xml`.
- A chart reads its table in the page and maps it in `chart.ts`. Series take the accent, then every other declared `--color-*` role in sheet order except the background and surface, each color once, repeating past the last.
- Sections need every slide in one once any exists, so slides ahead of the first `data-section` open a section named after the deck. Whether any slide declares one is read from the source files before layout. pptxgenjs files a slide under the first section carrying its title, so a returning title gets a numbered suffix rather than a slide filed out of order.
- The mark sits top right at its own aspect inside a 1.2 by 0.4 inch box. An SVG mark gets pptxgenjs's broken PNG fallback, since the screenshot patch reaches slides and not layouts, so a raster mark is the safe choice.

## Package step

pptxgenjs declares nothing for transitions, animations, or font embedding, so `src/slides/package/` writes all three into the package after it, an approach two spikes proved in LibreOffice before this step was built.

- `motion.ts` takes `data-transition` on `<body>` and `data-enter` on an element, both read by `walk.ts`, and inserts `<p:transition>` and an on-click `<p:timing>` main sequence after `</p:clrMapOvr>`. A slide missing that anchor is refused rather than patched elsewhere.
- Each effect is a row naming PowerPoint's own preset id, so it shows by name in the animation pane and a new effect costs one row.
- An entrance animates every shape drawn from its element's subtree on one click, resolved from object names to the shape ids the written XML holds. An element folded into another record's text, or drawing nothing, reports rather than animating a neighbor.
- A transition length rounds to `fast`, `med`, or `slow`, since the strict schema states no milliseconds and `p14:dur` needs the PowerPoint 2010 extension namespace.
- `fonts.ts` wraps each face `deck.json` lists in an Embedded OpenType 2.2 header built from its `OS/2`, `head`, and `name` tables, writes `ppt/fonts/fontN.fntdata`, registers the relationship and content type, lists the family after `<p:notesSz>`, and sets `embedTrueTypeFonts="1"`.
- The header follows the W3C EOT submission, which puts one padding field before the family name where the spike script wrote two. LibreOffice read either, and a real face decodes under the spec's layout.
- A face is refused by path, with the deck still written, when `fsType` sets the restricted or bitmap-only bit, when it carries an `fvar` table, when it is `woff`, `woff2`, or a collection, or when its slot is taken.
- Faces ship to the page as base64 `woff2`, and decoding one is a new dependency for a case no deck has hit, so the deck lists TrueType or OpenType files instead. Canon's own face is variable, so Canon's own deck embeds nothing until static instances are supplied.
- A face path is read only from inside the deck folder, so a `deck.json` cannot carry a file from elsewhere on the machine out inside the deck.
- Both outcomes are confirmed in LibreOffice only. Whether PowerPoint plays the motion and renders the embedded face, rather than refusing the package, is an operator check the e2e test cannot make. The e2e face is a synthetic sfnt from `test-face.ts` holding only the three header tables, so it embeds and never renders.

pptxgenjs 4 reads a text margin as left, right, bottom, top in points, while a table cell margin reads as top, right, bottom, left in inches. The half-leading lift was measured in LibreOffice rather than PowerPoint, and single-line text there lands about 4 to 6 pixels above the browser.

## Draft skill

`canon:draft-slides` drafts `.claude/SLIDES.md` from a topic, picks a layout per slide from the catalog, and shells out to the render command. The skill owns the deck content and the design choices encoded in the source. It never reimplements layout or styling, which live in the CLI.

After the first render it runs a one-pass quality check: convert the deck to images with `soffice` and `pdftoppm`, inspect every slide with fresh eyes for overlap, overflow, and contrast, fix once, and stop. The image pass is skipped with a note when those tools are absent.

## Reference deck

`examples/slides/showcase.md` exercises every layout in one deck. Render it to inspect the design system end to end and to verify a styling change visually. `evidence/` holds a screenshot of both variants, set in Geist through the design module's face and rendered from the deck as `c5079cea` left it, by hand with `canon slides render` followed by a `soffice --headless --convert-to pdf` and `pdftoppm -png` pass. It sits under the segment `canon pr evidence` compares, so a later deck change shows a before and after in review. Nothing regenerates it when the source changes, and no command renders it. That absence is deliberate rather than an omission: `examples/` carries no gate under the `assets/` and `examples/` boundary decision in `canon/context/web/assets.md`, since nothing outside this folder depends on the screenshot staying current, and `examples/slides/evidence/` carries no stamps for the same reason, unlike `examples/teach/evidence/`, whose five screenshots each sit beside one.
