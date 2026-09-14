# Project

[One-line description]

## Context

- Before non-trivial work in a domain read `canon/context/<domain>.md`, and before touching a UI surface read `canon/wireframes/<surface>.md`. Pick which from the index anchors below.

@canon/REQUIREMENTS.md
@canon/ARCHITECTURE.md
@canon/context/index.md
@canon/wireframes/index.md

## Commands

- These conventions came from a toolkit with its own CLI. A rule or standard naming a command is naming that CLI, present only where this project installed it.
- [Command to run before committing]. Full script reference in the development entry under `canon/context/`.

## Key paths

- `src/`: [description]
- `canon/DESIGN.md`: design tokens and the visual system
- `canon/context/`: per-domain narrative (how a domain is structured, decisions, gotchas), indexed via `canon/context/index.md`
- `canon/wireframes/`: per-surface ASCII layouts loaded on demand, indexed via `canon/wireframes/index.md`
- `canon/decisions/`: decision history a project doc points at, never loaded eagerly
