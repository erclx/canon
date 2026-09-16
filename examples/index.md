---
title: Examples
subtitle: Worked sources demonstrating what a toolkit command produces
auto: false
---

# Examples

Worked sources demonstrating what a toolkit command produces.

- [`slides/showcase.md`](slides/showcase.md): a `SLIDES.md` source exercising the layout catalog end to end. Render it with `canon slides render --source examples/slides/showcase.md`, which emits `.pptx` only, since no page route exists to display that format. A hand-rendered snapshot sits beside it in `slides/images/`, and nothing regenerates that snapshot when the source changes.
- [`teach/00-fixture/`](teach/00-fixture/): a committed learning workspace exercising the lesson-body component layer in `src/teach/html/` and `src/teach/components/`. Regenerate its first lesson with `bun src/teach/render-fixture.tsx`, and its second, which exercises the `raw` escape hatch, by spawning `canon teach render`. Rewrite its shell with `canon teach nav 00-fixture --root examples/teach`, since it sits outside `.canon/teach/`.
