---
title: Design reference folder
description: Shape and content rules for canon/design, the tracked folder of accepted design frames a build matches
---

# Design reference folder

Applies to `canon/design/`. Each file is an accepted design a build matches, kept as a picture for a reader and as frame HTML for exact values. The folder holds what was picked, never a draft.

## Scope

Governs the folder's groups, the file names inside them, the support folder, and the index at `canon/design/index.md`.

Does not govern:

- The design document at `canon/DESIGN.md`, which `design.md` beside this file governs
- When a pick lands and how a build is held to a reference, which the design-reference governance rule states
- The canvas content format a frame is drawn in, which the canvas standard owns

## What a working folder looks like

A folder works when a builder opening it finds the reference for the surface they are changing without asking anyone:

- Does the group a surface sits in match where a user meets it in the app?
- Does each reference carry both themes, as a picture and as frame HTML?
- Does the index say which code each group governs?

## Groups

Group by app part, being the places a user sees, such as `home`, `inspector`, or `menus`. A component folder splits one screen across many folders, and a concern folder mixes surfaces a builder edits apart.

- Give each app part one plain kebab-case folder directly under `canon/design/`
- Put the inputs every app part draws on, such as tokens, colors, and the logo, under `foundations/`, so they read apart from places in the app
- Gather a surface shown on several app parts, such as a toast, under the part a user meets it in first

## Files

Each reference is one name in two themes, with a PNG and its frame HTML per theme.

- Name each file `<name>-dark` or `<name>-light`, as in `grid-dark.png` beside `grid-dark.html`
- Keep one HTML file without a theme suffix only for a frame that switches theme itself, beside both PNGs
- Put what every frame HTML loads, being its stylesheet, script, fonts, and vendored files, under `kit/`

## The index

`canon/design/index.md` is prose for a reader. It names the link a file listing lacks, from a group to the code it governs.

- Write one row per group, carrying the group, what the user sees there, the code paths it governs, and the states its frames show
- List no files, since the tree and the sync's own check already answer what exists
- Keep the sync's canvas mapping out of the index, in a file the sync owns beside it

### Template

The column headers stay verbatim. A row per group, `foundations` included.

```markdown
# Design references

Each group holds accepted frames a build matches, light and dark.

| Group         | What the user sees | Code               | States           |
| ------------- | ------------------ | ------------------ | ---------------- |
| `home`        | <the surface>      | `<path in source>` | <states shown>   |
| `foundations` | Tokens and colors  | `<stylesheet>`     | <themes covered> |
```

## Lifetime

The design-reference governance rule states how long a reference stays, when it is redrawn, and when it goes with its surface.
