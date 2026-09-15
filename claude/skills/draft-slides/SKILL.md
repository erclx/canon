---
name: draft-slides
description: Drafts a `.claude/SLIDES.md` source from a topic, picks a layout per slide, then renders it to PowerPoint via `canon slides render`. Use when asked to "draft slides", "make a deck", "build a presentation", "turn this into slides", or "render a SLIDES.md". Holds the deck design rules. Do NOT reimplement render logic. The CLI owns layout and styling. Assumes the `canon` CLI is on PATH.
---

# Draft slides

Author a `SLIDES.md` source, then shell out to `canon slides render`. The CLI owns all layout and styling. This skill owns content and the design choices encoded in the source.

## Read the catalog

Run this first to load the available layouts. Never hardcode layout names. The catalog is the source of truth.

```bash
canon slides list --json 2>/dev/null
```

## Draft the source

Write the deck to `.claude/SLIDES.md` from the project root. Structure:

- Deck frontmatter between `---` delimiters: `title`, optional `subtitle`, `palette`, and `variant` (light or dark).
- One slide per section, separated by a `---` rule. Each slide opens with a `# Title` and a `layout:` line naming a layout from the catalog, followed by its content.

Match content shape to the layout: bullet lists for list layouts, `## Heading` blocks for columns, `- value : caption` pairs for stats and cards, a quote with a `- attribution` line for quotes.

For a deck with chapters, add a `toc` slide near the front and mark each chapter opener with the `section` layout. The render fills the contents links and the per-slide footer automatically from the section slides. Leave the `toc` slide body empty.

## Design rules

The palette and type scale live in the CLI. Own the choices the source controls.

- Pick the variant that fits the topic. Light is a paper background, dark is near black. Both carry the same rust accent.
- Vary the layout across slides. Never repeat title-and-bullets on every slide. Reach for columns, stat callouts, grids, and section dividers.
- The CLI enforces the type scale, so size content to fit rather than overflow. Keep titles short and bullet lines tight.
- Never write centered body text or content that overflows a slide. Let the layouts place the elements.

## Render

Shell out to the CLI. It writes the deck and reports the path.

```bash
canon slides render --source .claude/SLIDES.md --out .canon/tmp/render/slides
```

Pass `--variant light` or `--variant dark` to override the source variant for a one-off render. Pass `--open` to open the deck, and `--mirror <dir>` (or set `CANON_SLIDES_MIRROR`) to copy it into a synced folder.

## QA loop

Run this once after the first render, then stop.

1. Convert the deck to images: `soffice --headless --convert-to pdf <deck>.pptx` then `pdftoppm -r 90 -png <deck>.pdf slide`. If `soffice` or `pdftoppm` is missing, skip the image pass and say so. Do not fail the render.
2. Open and inspect every rendered image in this session, checking each slide for overlap, overflow, low contrast, and empty regions.
3. Fix the reported issues in `SLIDES.md` once, re-render, and stop. Do not loop indefinitely on aesthetics.

## Response

After rendering, report:

- Slide count and the deck path
- The palette and variant used
- Any QA issues found and what changed, or that the deck passed clean
