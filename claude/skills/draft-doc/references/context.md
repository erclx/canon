---
title: Context kind
description: The root check, guard, flat-file placement, three-question draft, and regen folder for a brand-new context entry, read by draft-doc once the request resolves to the context kind
---

# Context kind

`draft-doc` reads this file when the request resolves to an entry under `canon/context/`. An entry that already exists is refreshed by `context-fold`, never drafted here.

## Root

A project the surface move has not reached keeps its context folder under `.claude/` rather than `canon/`. Check and write at whichever root already carries the folder, and create it under `canon/` only when neither does, since a new `canon/` folder would hide every entry the old one holds. `<context-root>` below names the root this check settled.

## Guards

- Derive a kebab-case slug from the domain and check whether `<context-root>/<slug>.md` or `<context-root>/<slug>/index.md` already exists. Either resolving means the domain is already covered under that exact name. Stop: `❌ <slug> already has a context entry. Use context-fold to refresh it instead.`

## Placement

- Read `<context-root>/index.md` and check every title and description it lists against the domain. Stop on a match: `❌ <path> already covers this domain under a different name. Use context-fold to refresh it instead.`
- Default a brand-new entry to a flat file, `<context-root>/<slug>.md`. A domain starts as one page's worth of narrative, and the standard splits it into a folder only once it holds three or more sub-areas, which a fresh domain never does on day one.

## Draft

- Read the domain's own folders and files well enough to answer the standard's three questions: where things live, why they are that way, and how to add one more of what the domain holds.
- Draft `title` and `description` frontmatter, then `## Overview`, `## Layout` (folder ownership lines only, never a file-by-file list), and `## Decisions` or `## Gotchas` wherever the domain's history supplies a non-obvious choice or a workaround worth preserving.
- Keep the standard's ordering: `Overview`, `Layout`, `Decisions`, `Gotchas`, then anything else.

## Write

Regenerate `<context-root>`, so the domain appears in its `index.md` at once.
