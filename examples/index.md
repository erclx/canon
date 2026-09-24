---
title: Examples
subtitle: Worked sources demonstrating what a toolkit command produces
auto: false
---

# Examples

Worked sources demonstrating what a toolkit command produces.

- [`slides/showcase.md`](slides/showcase.md): a `SLIDES.md` source exercising the layout catalog end to end. Render it with `canon slides render --source examples/slides/showcase.md`, which emits `.pptx` only, since no page route exists to display that format. A hand-rendered snapshot sits beside it in `slides/evidence/`, and nothing regenerates that snapshot when the source changes.
- [`teach/`](teach/): a committed teach root holding three folders. `00-fixture/` is a full workspace with three lessons, a glossary, resources, a learning record and one reference page, `reference/element-table.md`, which nav renders to the `.html` beside it. `01-sparse/` is a thin one with a single lesson. `02-unopened/` carries no `MISSION.md`, which the listing draws as a disabled row. Every lesson carries the four chrome marker pairs, and the content is deliberately meaningless so the shell is what gets developed. Rewrite the root, the contents pages, the rendered reference page and each lesson's chrome with `canon teach nav --root examples/teach`. `teach/evidence/` holds captures of the root listing, a workspace index, a lesson and a reference page, each with the stamp `canon capture` wrote. Rebuild them by serving `examples/teach` over http and capturing each page with `--selector body`.
