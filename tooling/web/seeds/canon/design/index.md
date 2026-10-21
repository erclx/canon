---
title: Design references
description: The accepted design frames a build matches, grouped by app part, with the code each group governs
auto: false
---

# Design references

Each group holds accepted frames a build matches, light and dark. The `design-record` skill carries the folder standard, so load it before adding, redrawing, or removing a reference.

## Layout

- Give each app part one plain kebab-case folder, such as `home` or `inspector`
- Put tokens, colors, and the logo under `foundations/`
- Name each file `<name>-dark` or `<name>-light`, a PNG beside its frame HTML
- Put what every frame loads under `kit/`

## Groups

One row per group, `foundations` included. List no files, since the tree answers what exists.

| Group | What the user sees | Code | States |
| ----- | ------------------ | ---- | ------ |
