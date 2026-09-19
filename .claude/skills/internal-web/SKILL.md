---
name: internal-web
description: The landing page and this repository's own rendered images. Use for `web/`, `assets/`, the Astro build, `web/src/content/copy.ts`, or a capture this repository commits.
---

# Web

Read `canon/context/web.md` for structure, the Astro build, and the gotchas before editing.

`internal/rules/claude/593-landing-page.md` is scoped to `web/**` and holds the page's conventions, each of which fails silently when broken. It loads on the edit and this skill loads for the domain. Open the rule before drafting rather than after: a draft that never read it reproduces what it forbids, and a five-round drafting pass did exactly that.

## Before drafting a page change

- Read the rule. Do not work its conventions from memory, and do not restate them in a plan, since a paraphrase of a convention is how a plan ships a requirement the rule does not carry.
- Read `references/citation-anchors.md` before adding or editing any string in `web/src/content/copy.ts`.
- Check whether the change moves a count. A count is read from the CLI at build time and never typed, so a number in a draft is a defect the build cannot catch on its own.

## The two trees are not the same tree

`web/gallery.config.mjs` reads `web/gallery-src` and never `web/src`, and `scripts/core/check-gallery-exclusion.sh` guards the separation on every build reaching the live domain. A component under `web/src/components/` renders in the gallery whether or not the page imports it, so a component left unused after a section is dropped reads as one somebody deleted a reference to by mistake.

## Images are generated

- Point an image at a file some script writes. `canon capture` writes a `.stamp` beside each PNG carrying a digest over the markup it read and the image it wrote, and `bun run check` fails when either moves.
- Never hand-edit a generated frame. The next regeneration overwrites it and the gate reports nothing until the digests disagree.
- A design-token change can move the capture markup and the stamps while leaving the PNGs byte-identical. `canon/context/web.md` records why, and the Hero stage failing until regenerated frames are committed is that stage working rather than a defect.

## Sync checklist

Before shipping any change under `web/`:

- Run `bun run web:build`, which runs `astro check`. `web/` sits outside the `types` stage in `src/gate/stages.ts`, so this is the only typecheck the page gets.
- Run `cd web && bunx playwright test`. The suite asserts the section count, so a section added or removed fails it by design and the spec is rewritten in the same change rather than after it.
- Run `bun run check`.
- Update the affected consumer docs through `canon:docs-sync` rather than editing `docs/` directly.

## Reference

- `canon/context/web.md`: structure, the Astro build, decisions, and the CI and layout gaps
- `internal/rules/claude/593-landing-page.md`: the page's conventions, each failing silently
- `references/citation-anchors.md`: how a string in `copy.ts` anchors to `README.md` and what the gate reads
- `canon/context/design.md`: the token values this surface reads and does not own
- `canon/context/development/regeneration.md`: the Hero section, before touching `assets/captures/` or `assets/*.png`
- `canon/context/web.md`: why `assets/` and `examples/` are separate folders, decided on who each addresses
