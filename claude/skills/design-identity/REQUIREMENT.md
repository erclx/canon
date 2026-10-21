---
name: design-identity
description: Why the mark and the card are one pick rather than two, and where the size sequence and the write folder come from before either is drafted
---

# Design identity requirement

## Gap

Without this skill, a session asked for a logo and a social card invents shapes with nothing behind them, or drafts the mark and the card as two decisions that land on shapes that do not compose. Nothing else in the catalog reaches a logo or an Open Graph image.

A session building this alone restates the render-and-pick loop from scratch, where it drifts from the shipped one. It guesses the icon sizes and the output folder rather than reading what the project declares, and it renders each size through its own capture call.

## Must

- The icon size sequence and the write folder come from the project's own head, manifest, or static-asset convention before a stated default, and the run names which one decided
- Every arm is drafted inside the card frame, so one pick settles the mark's shape and its composition together
- The render, hand-off, pick, and loop follow `pick-by-eye` rather than a copy of it
- The final mark lands as its own SVG source, not only baked into a raster
- Every final size and the card render in one capture call, each landing at its literal target size

## Must not

- Draft a mark the operator did not ask for, or mutate an existing logo file, which is a plain edit
- Add a logo section to the design document's fixed section set, which its parser reads as a fixed key set
- Modify `pick-by-eye`, `canon capture`, or `canon design render`, which this skill composes
- Be taken as reached by more than an operator typing its name, which a later review reads back rather than assumes

## Out of scope

- The render, hand-off, pick, and loop mechanics, which `pick-by-eye` owns
- Carrying a picked direction into the design document, which `design-record` owns
- Auditing an implemented UI against its tokens, which `ux-audit` owns
- Wiring the produced files into the project's head or manifest, which the operator owns
