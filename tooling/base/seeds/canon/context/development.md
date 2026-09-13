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

## Setup

- Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- Install dependencies: `bun install`

## Scripts

| Command          | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `bun run check`  | Repairs locally. Auto-formats, then asserts what the formatters could not fix. |
| `bun run format` | Auto-fix prettier and shfmt formatting.                                        |

## Shell scripts

All `.sh` files live under `scripts/`. Do not place shell scripts outside `scripts/`.

## Husky hooks

- `pre-commit` runs `lint-staged` (prettier, cspell, shfmt, shellcheck on staged files).
- `commit-msg` runs `commitlint` against the conventional commit format.
- `pre-push` runs `bun run check`. When a markdown-bans audit tool is on PATH, it also gates on banned characters, words, and spellings across every tracked markdown file except `CHANGELOG.md`. After pushing, run `git status`. If files changed, commit the diff as `style(<scope>):` and push again.
