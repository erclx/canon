---
name: draft-identity
description: Why the mark and the card are one pick rather than two, and where the size sequence and the write folder come from before either is drafted
---

# Draft identity requirement

## Gap

Without this skill, a session asked for a logo and a social card either invents shapes with nothing behind them, or drafts the mark and the card as two separate decisions that can land on shapes that do not compose, which is the failure the task filing this skill measured by hand on every project it touched. A search across every shipped skill and standard found zero hits for `logo`, `og:image`, `og-image`, or Open Graph, so nothing in the catalog reached either output.

A session building this without a shared loop restates `draft-and-pick`'s render, hand-off, pick, and loop mechanics from scratch, which drifts from the shipped one with nothing comparing the two copies. It also guesses at the icon size sequence and the output folder rather than reading what the project already declares, and it produces one raster per size through a separate render call per size, which multiplies capture invocations for no reason `canon capture` cannot already batch.

## Must

- Detect the icon size sequence from the project's own HTML head or manifest before falling back to the stated default set
- Detect the write folder from the project's own static-asset convention before falling back to the project root, and announce which one decided it
- Draft every arm already composed inside the card frame, so one pick settles the mark's shape and its composition together
- Follow `draft-and-pick`'s Steps 2 through 5 for the render, hand-off, pick, and loop, rather than restating them
- Write the final mark as its own SVG source, not baked into a raster only
- Render every final size and the card in one capture call, by sharing one selector class across pages, each declared at half its target dimension to land on the literal size once the render engine's fixed 2x scale factor is applied

## Must not

- Restate `draft-and-pick`'s render, hand-off, pick, or loop mechanics
- Add a `## Logo` section to `standards/design.md`'s fixed section set. `src/design/parse.ts` reads a fixed key set, and no outcome behind this skill asks for a schema change.
- Modify `draft-and-pick`, `canon capture`, or `canon design render`. This skill composes all three and extending any of them is a separate change.
- Assume this skill's own invocation frequency needs no check. Whether anything reaches for it beyond an operator typing its name has no answer at creation time, so a review pass some months in should read that back rather than take it on faith.

## Guards

- `canon` not on PATH: stop, since the render loop and the finalize step both need it
- Fires on a direct request only. A run offering a logo to a project that never asked for one spends a render nobody wanted.

## Out of scope

- Wiring the produced files into a project's own HTML head or manifest, which is a separate edit this skill leaves for the operator to make against their own markup
- Recording the mark's construction rules in `standards/design.md`, which the task's own constraint keeps out of the fixed section set
- Mutating an existing logo file directly, which is a direct edit rather than a skill
- Auditing an implemented UI against its tokens, which `ux-audit` owns
