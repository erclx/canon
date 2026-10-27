---
title: Design references
description: The accepted design frames a build matches, grouped by app part, with the code each group governs
auto: false
---

# Design references

Each group holds accepted frames a build matches, light and dark. The `design-record` skill carries the folder standard, so load it before adding, redrawing, or removing a reference. Run `bun run design:sync` to land a mapped frame and `bun run design:sync --check` to compare the folder with the board.

## Groups

One row per group. List no files, since the tree answers what exists.

| Group         | What the user sees                                    | Code                                             | States                                                                                        |
| ------------- | ----------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `landing`     | The public page at canon.erclx.dev, desktop and phone | `web/src/`, `web/src/styles/global.css`          | Light and dark at 1440 and 390, every section, the film as a poster on phones                 |
| `readme`      | The repository README on GitHub                       | `README.md`, `assets/loops/`                     | Light and dark, the mark, claim, the hero slot as a placeholder, and quick start              |
| `foundations` | The canon mark, in its versions, sizes, and app tile  | `assets/brand/mark.svg`, `src/design/favicon.ts` | Light and dark, the primary, one color, and tile versions from 16 to 96, and the construction |
