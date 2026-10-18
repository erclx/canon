---
title: Docs kind
description: The guard, placement, draft additions, and regen folder for a brand-new page under docs/, read by draft-doc once the request resolves to the docs kind
---

# Docs kind

`draft-doc` reads this file when the request resolves to a page under `docs/`. A page that already exists is rewritten by `docs-sync`, never drafted here.

## Guards

Derive a kebab-case slug from the topic and run `canon docs <slug>`. A resolved page means the topic is covered under that exact name, so stop: `❌ <slug> already resolves to an existing page. Run canon:docs-sync instead.`

This is a name match rather than a topic match, and Placement checks the wider case.

## Placement

- Read `docs/index.md` and its sub-catalogs for the closest existing `category`. <!-- canon-allow-reference: the target project's own docs/ tree -->
- Check every page title and description that read surfaces against the topic
- Stop on a match: `❌ <path> already covers this topic under a different name. Run canon:docs-sync instead.`
- Reuse a matching `category` value verbatim. A near-miss spelling opens a second shelf holding one page, per the docs standard.
- Default to the `docs/` root with no `category` when nothing fits. A subfolder earns itself only once a shelf of pages already sits there, per the standard's splitting rule.

## Draft

- Draft `title`, `description`, and `category` where one applies, then the page body.
- Draft a page documenting one command in the docs standard's reference shape, with `kind: reference` in its frontmatter, so `canon markdown audit` checks its sections.
- Test the page against the standard's four questions: what the surface is, what to run or write, what it refuses, and where to go for the adjacent surface.
- Take a diagram only through the Mermaid fence the docs standard permits. Never build a hand-drawn diagram-and-capture loop here.

## Preview

Add `(category: <category-or-root>)` after the placement path.

## Write

Regenerate the folder that holds the page, so the `docs/` root or the category subfolder it landed in.
