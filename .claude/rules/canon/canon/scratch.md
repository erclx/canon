---
description: Write temporary files to the scratch folder structure
---

# Scratch standards

## Temporary files

- Write temporary files to `.canon/tmp/<slug>/<file>.md` at the current worktree's root, with a kebab-slug tied to the topic rather than a flat `<slug>-<file>.md`.
- Never take one of the reserved slugs `runs`, `hooks`, `handoff`, `pr`, and `render`.
- Write scratch at the main root instead only when a skill's own body says so.
