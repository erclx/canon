---
title: Wireframes kind
description: The root check, tree-walk guard, tier detection, transcription and role-intent modes, and regen folder for a brand-new wireframe surface, read by draft-doc once the request resolves to the wireframes kind
---

# Wireframes kind

`draft-doc` reads this file when the request resolves to a surface under `canon/wireframes/`. An existing surface is edited directly, since no skill owns a full rewrite of one.

This kind stays independent of `context-fold`'s wireframe coverage sweep, which writes only a bare `TODO` stub for a surface a diff touched and reports drift against one a wireframe already covers. Neither the stub nor the drift check is a draft, and this kind never reads or writes through that mechanism.

## Root

A project the surface move has not reached keeps its wireframes folder under `.claude/` rather than `canon/`. Walk and write at whichever root already carries the folder, and create it under `canon/` only when neither does, since a new `canon/` folder would hide every surface the old one holds. `<wireframes-root>` below names the root this check settled.

## Guards

- Derive a kebab-case slug from the surface. Walk the whole `<wireframes-root>` tree, including a surface nested inside a grouped subfolder, rather than checking the top level alone. A match at any depth means the surface already has a file. Stop: `❌ <path> already covers this surface. Edit it directly; this skill only drafts a surface with no file yet.`

## Placement

- Check every title and description in `<wireframes-root>/index.md` against the surface, and stop the same way on a match.
- Place the file at `<wireframes-root>/<slug>.md`, or inside a grouped subfolder only when the surface belongs beside siblings that already share one.

## Tier detection

- Read `canon/DESIGN.md` and every existing wireframe file for a tier signal: an Excalidraw or Figma reference, or a marker naming one of them.
- Always draft the regions-and-states shape regardless of what is detected, since that is the only shape any shipped mechanism produces. Report a higher tier rather than attempting a companion render for it.
- Default silently to tier 0 when nothing is detected.

## Draft

- Decide the mode before drafting. When the surface names an already-built component or file, open that source and draft in transcription mode, citing the render function, the stylesheet rule, or the built file each region and label traces to, per the standard's Transcription-wireframes section.
- Draft in role-intent mode otherwise: label each region by its role, never by a class name or a token value.
- Draft `title` and `description` frontmatter, then a lead paragraph naming what the surface is for and what it covers, then `## Regions` as a bullet list naming every region and where it sits relative to the others.
- Draw an ASCII `plaintext` fence with `←` role annotations only when the layout is not built yet. Skip the fence in transcription mode, which already cites the built source instead.
- Draft `## States` as a table listing every state a visitor can reach, what reaches it, what it shows in words, and its evidence folder, reading `not captured` in the evidence cell until a capture lands.
- Follow with `## Copy`, `## Behavior`, and `## Not on this surface`, against the standard's template.
- Give a layout that changes across a breakpoint or state its own entry in the regions list, named by what triggers it, never for a spacing difference alone.
- Leave out algorithms, event-handler code, framework prop or class names outside transcription mode, and anything else the standard sends to a context entry instead.

## Preview

Add `**Detected tier:** <tier-0 | tier-1 | tier-2 | none detected>` and the mode, and confirm both with the path, since each is a judgment call.

## Write

Run `canon markdown audit` against the prose outside the fenced block. Regenerate `<wireframes-root>`, so the surface appears in its `index.md` at once.
