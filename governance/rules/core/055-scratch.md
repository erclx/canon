---
description: Write temporary files to the scratch folder structure
---

# Scratch standards

## Temporary files

- Write temporary files to `.canon/tmp/<slug>/<file>.md` at the current worktree's root, a nested folder with a kebab-slug tied to the topic rather than a flat `<slug>-<file>.md`. The slug must not take one of the five reserved names `runs`, `hooks`, `handoff`, `pr`, and `render`. A skill that resolves a write at the main root instead states so in its own body.
- Write to `.claude/.tmp/<slug>/` instead in a project that carries no `.canon/` root, and `canon migrate records` moves it to the first spelling. <!-- canon-keep-record-root -->
