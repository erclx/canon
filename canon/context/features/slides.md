---
title: Slides
description: SLIDES.md source shape, layout catalog, render command, draft skill
---

# Slides

## Overview

`.claude/SLIDES.md` holds a slide deck as markdown. The toolkit treats it as the source of truth and renders it to a PowerPoint deck on demand. Two surfaces sit around it: a Claude Code skill drafts the file from a topic and picks a layout per slide, and a CLI command renders the deck for inspection.

## Layout

- `src/slides/` owns the parser, the layout functions, the design tokens, and the render
- `examples/slides/` owns the reference deck that exercises every layout
- `.canon/tmp/render/slides/` owns rendered decks, gitignored

## Decisions

- The engine is a fresh general-purpose layer, not a port of any single project's deck modes. It ships one source format with a per-slide layout, so any repo writes its own `SLIDES.md` and renders with the same command.
- The source is committed. The rendered `.pptx` lands in the gitignored `.canon/tmp/render/slides/` and can be regenerated at any time.
- The palette is a paper background with a rust accent, deliberately not blue. The five theme colors are read from the design module by role rather than restated, so a deck moves when the decided system does. Each variant takes its own accent, a lighter rust on dark and a deeper one on light, since the module tunes each for its ground.
- The face is read from the design module too, as Geist. A `.pptx` cannot embed it, so the first family is taken with the ` Variable` suffix dropped to the installed name `Geist` and a viewer without the face sees PowerPoint's own substitute. Point sizes stay a deck-owned scale in `TYPE`, since the module's `t0` to `t6` steps are screen pixels and a literal mapping would shrink the cover to 38 pt and the body to 11 pt.

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

## Draft skill

`canon:draft-slides` drafts `.claude/SLIDES.md` from a topic, picks a layout per slide from the catalog, and shells out to the render command. The skill owns the deck content and the design choices encoded in the source. It never reimplements layout or styling, which live in the CLI.

After the first render it runs a one-pass quality check: convert the deck to images with `soffice` and `pdftoppm`, inspect every slide with fresh eyes for overlap, overflow, and contrast, fix once, and stop. The image pass is skipped with a note when those tools are absent.

## Reference deck

`examples/slides/showcase.md` exercises every layout in one deck. Render it to inspect the design system end to end and to verify a styling change visually. `evidence/` holds a screenshot of both variants, set in Geist through the design module's face and rendered from the deck as `c5079cea` left it, by hand with `canon slides render` followed by a `soffice --headless --convert-to pdf` and `pdftoppm -png` pass. It sits under the segment `canon pr evidence` compares, so a later deck change shows a before and after in review. Nothing regenerates it when the source changes, and no command renders it. That absence is deliberate rather than an omission: `examples/` carries no gate under the `assets/` and `examples/` boundary decision in `canon/context/web/assets.md`, since nothing outside this folder depends on the screenshot staying current, and the folder carries no stamps for the same reason.
