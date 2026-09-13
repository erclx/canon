---
name: migration-context
description: Scope boundary for the docs audience split and its ordering against the other two migrations
---

# Migration context requirement

## Gap

Without this skill, a session judges a `docs/` file agent-facing, moves it, and rewrites the inbound links in the same pass, so a classification the user rejects is no longer one command to undo.

Three more failures share a cause. The skill reads a folder two other surfaces also write, and a proposal blind to them destroys work.

A seed-derived `development.md` moved out of `docs/` comes back on the next seed sync. A move onto an existing `canon/context/` filename overwrites the entry sitting there. A proposal drafted while `migration-claude-md` is proposing entries into the same folder cannot see those targets, and running the two in the wrong order turns a legitimate move into a skipped conflict.

## Must

- Classify by audience signal in the file rather than by its name or its folder position
- Propose and stop. The `git mv` commands and the link fixes stay the user's to run.
- Report every inbound reference to a moved path as a TODO line, leaving the reference itself untouched
- Defer a seed-derived file to the seed sync path rather than proposing a move for it
- Skip a move whose destination already exists and report it as a conflict

## Must not

- Sort a file carrying both audiences into either bucket. Flag it for a manual split, since a whole-file move and a silent split are both wrong.
- Descend into `docs/` subfolders. List them for manual review and leave them alone.

## Guards

- A missing `docs/` directory, or one holding no top-level markdown, stops before any classification runs

## Out of scope

- Classifying `CLAUDE.md` sections, which `migration-claude-md` proposes into this same `canon/context/` folder. Run this skill first when both apply, so that skill's append-or-create check reads a folder the moves have already populated.
- Regenerating `canon/context/index.md`, which `canon indexes regen` does once the user has applied the moves
