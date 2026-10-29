---
name: internal-web
description: The landing page and this repository's own rendered images. Use for `web/`, `assets/`, the Astro build, `web/src/content/copy.ts`, or a capture this repository commits.
---

# Web

Read `canon/context/development/web.md` for structure, the Astro build, and the gotchas before editing, then the file it names for the change at hand.

`internal/rules/claude/landing-page.md` and `internal/rules/claude/landing-style.md` are scoped to `web/**` and hold the page's conventions, each failing silently. They load on the edit and this skill loads for the domain. Open both rules before drafting rather than after, since a draft that never read them reproduces what they forbid.

## Before drafting a page change

- Read both rules. Do not work their conventions from memory, and do not restate them in a plan, since a paraphrase of a convention is how a plan ships a requirement the rules do not carry.
- Read `references/citation-anchors.md` before adding or editing any string in `web/src/content/copy.ts`.
- Check whether the change moves a count. A count is read from the CLI at build time and never typed, so a number in a draft is a defect the build cannot catch on its own.

## Images are generated

Point an image at a file some script writes. `canon capture` writes a `.stamp` beside each PNG carrying a digest over the markup it read and the image it wrote.

- Never hand-edit a generated frame. The next regeneration overwrites it.

## Sync checklist

Before shipping any change under `web/`:

- Run `bun run web:build`, which runs `astro check`. `web/` sits outside the `types` stage in `src/gate/stages.ts`, so this is the only typecheck the page gets.
- Run `cd web && bunx playwright test`. The suite asserts the section count, so a section added or removed fails it by design and the spec is rewritten in the same change rather than after it.
- Run `bun run check`.
- Update the affected consumer docs through `canon:docs-sync` rather than editing `docs/` directly.

## Reference

- `canon/context/development/web.md`: structure, the Astro build, decisions, and the CI and layout gaps
- `internal/rules/claude/landing-page.md`: where the page's counts, images, and citations come from, each failing silently
- `internal/rules/claude/landing-style.md`: the page's motion test and its one hue, each failing silently
- `references/citation-anchors.md`: how a string in `copy.ts` anchors to `README.md` and what the gate reads

### Neighboring entries

Three entries outside `canon/context/development/web.md` bear on this surface.

- `canon/context/features/design.md`: the token values this surface reads and does not own
- `canon/context/development/web.md`: why `assets/` and `examples/` are separate folders, decided on who each addresses
- `canon/context/development/local-loop.md`: which `evidence` folders are dev baselines and which are prod captures, before adding or moving an image under one
