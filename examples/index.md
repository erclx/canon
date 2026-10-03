---
title: Examples
subtitle: Worked sources demonstrating what a toolkit command produces
auto: false
---

# Examples

Worked sources demonstrating what a toolkit command produces.

- [`slides/showcase.md`](slides/showcase.md): a `SLIDES.md` source exercising the layout catalog end to end. Render it with `canon slides render --source examples/slides/showcase.md`, which emits `.pptx` only, since no page route exists to display that format. A hand-rendered snapshot sits beside it in `slides/evidence/`, and nothing regenerates that snapshot when the source changes.
- [`design/DESIGN.md`](design/DESIGN.md): an authored design record for Tidewell, an invented tide-table app, so the project is not this repository's own. It carries every section the template names plus `## Layout`, and several cells end in ` ? verify` so the render's confidence line and markers show. Render it with `canon design render -s examples/design/DESIGN.md -o .canon/tmp/render/design-example`, then capture the page with `canon capture .canon/tmp/render/design-example/index.html --selector body --width 1200 -o examples/design/evidence`. `canon capture` names its output after `index.html`, so rename the image and stamp to `render.png` and `render.stamp`. The capture's header names `canon/DESIGN.md` because that text is the renderer's own, and the page leaves out `## Layout` because the preview draws no `## Layout` section. `design/evidence/` holds that capture and its stamp, and nothing regenerates them when the record changes.
- [`teach/`](teach/): a committed teach root holding three folders. `00-fixture/` is a full workspace with three lessons, a glossary, resources, a learning record and one reference page, `reference/element-table.md`, which nav renders to the `.html` beside it. `01-sparse/` is a thin one with a single lesson. `02-unopened/` carries no `MISSION.md`, which the listing draws as a disabled row. Every lesson carries the four chrome marker pairs, and the content is deliberately meaningless so the shell is what gets developed. Rewrite the root, the contents pages, the rendered reference page and each lesson's chrome with `canon teach nav --root examples/teach`. `teach/evidence/` holds captures of the root listing, a workspace index, a lesson and a reference page, each with the stamp `canon capture` wrote. Rebuild them by serving `examples/teach` over http and capturing each page with `--selector body`.
