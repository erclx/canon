---
description: Write temporary files to the scratch folder structure
---

# Scratch standards

## Temporary files

- Write temporary files to `.canon/tmp/<slug>/<file>.md` in the project root, a nested `<slug>/` folder with a kebab-slug tied to the topic, not a flat `<slug>-<file>.md`. The scratch-guard hook enforces the location.
- Write to `.claude/.tmp/<slug>/` instead in a project that carries no `.canon/` root, which is one the record move has not reached. The hook accepts either, but the ignore file is the source: `.gitignore` and its manifest counterpart are what keep the fallback spelling out of `git status`, and the hook and this rule both defer to it. `canon migrate records` is what moves a project from this second spelling to the first. <!-- canon-keep-record-root -->
- "The project root" above means the current worktree by default. `085-worktrees.md` states the same mixed default for `.canon/tmp/` and defers to each skill's own body for which write resolves at the main root instead.
- `runs/`, `hooks/`, `handoff/`, `pr/`, and `render/` are reserved under `tmp/` for build and command output that can be regenerated, hook state, skill-to-skill handoff, pull request scratch, and render output. A session slug must not take one of these five names.
