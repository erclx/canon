---
title: Setup
description: Local dev workflow, scripts, and husky hooks
---

# Setup

## Overview

Owns how the project runs on a developer machine, being the toolchain install, the scripts that verify a change, and the git hooks that run them before a commit or a push leaves. CI calls the same scripts from a workflow, which is the CI entry's subject.

## Layout

### `scripts/`

Holds every shell script, since none belongs outside this folder. The package scripts below call them.

### `.husky/`

Holds the git hooks that run the checks before a commit or a push leaves.

- `pre-commit` runs `lint-staged` (oxfmt on staged files)
- `commit-msg` runs `commitlint` against the conventional commit format
- `pre-push` runs `bun run check`, and also gates on banned characters across every tracked markdown file except `CHANGELOG.md` when a markdown-bans audit tool is on PATH

### Scripts

Install [Bun](https://bun.sh) with `curl -fsSL https://bun.sh/install | bash` and run `bun install`, then use these commands.

| Command          | Purpose                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `bun run check`  | Gates locally and writes nothing. Fails on formatting drift until `bun run format` runs. |
| `bun run format` | Auto-fix oxfmt formatting.                                                               |

## Gotchas

- A push fails on formatting drift until `bun run format` runs, since the `pre-push` hook writes nothing
