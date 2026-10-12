---
title: Development
description: Local dev workflow, scripts, and husky hooks
---

# Development

## Overview

Owns how the project runs on a developer machine: installing the toolchain, the scripts that verify a change, and the git hooks that run them before a commit or a push leaves. CI calls the same scripts from a workflow, which is the CI entry's subject.

## Layout

- `scripts/` owns the shell scripts the package scripts below call
- `.husky/` owns the git hooks

### Setup

- Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- Install dependencies: `bun install`

### Scripts

| Command          | Purpose                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `bun run check`  | Gates locally and writes nothing. Fails on formatting drift until `bun run format` runs. |
| `bun run format` | Auto-fix oxfmt formatting.                                                               |

### Shell scripts

All `.sh` files live under `scripts/`. Do not place shell scripts outside `scripts/`.

### Husky hooks

- `pre-commit` runs `lint-staged` (oxfmt on staged files).
- `commit-msg` runs `commitlint` against the conventional commit format.
- `pre-push` runs `bun run check`. When a markdown-bans audit tool is on PATH, it also gates on banned characters across every tracked markdown file except `CHANGELOG.md`. A push fails on formatting drift until `bun run format` runs, since the hook writes nothing.
