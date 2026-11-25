---
title: Setup
description: Local dev workflow, scripts, and husky hooks
---

# Setup

## Overview

Owns how the project runs on a developer machine, being the toolchain install, the scripts that verify a change, and the git hooks that run them before a commit or a push leaves. CI calls the same scripts from a workflow, which is the CI entry's subject.

Install [Bun](https://bun.sh) with `curl -fsSL https://bun.sh/install | bash` and run `bun install`, then use the package scripts below. They call the shell scripts in `scripts/`, which holds every one since none belongs outside it.

## Layout

### `scripts/`

| Command                 | Purpose                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `bun run check:changed` | Gates a push. Runs tied tests alone in a web project at the repository root, and all of `check` elsewhere. |
| `bun run check`         | Runs every check, the full suite, and the build by hand. Neither check writes.                             |
| `bun run format`        | Auto-fix oxfmt formatting.                                                                                 |

The synced stacks add more scripts, such as a test runner, a build, or a dev server. Read the `scripts` block in `package.json` for the full set rather than this table.

### `.husky/`

Holds the git hooks that run the checks before a commit or a push leaves.

- `pre-commit` runs `lint-staged` (oxfmt on staged files)
- `commit-msg` runs `commitlint` against the conventional commit format
- `pre-push` runs `bun run check:changed`, and also gates on banned characters across every tracked markdown file except `CHANGELOG.md` when a markdown-bans audit tool is on PATH

## Gotchas

- `bun run check:changed` skips content that already passed, so run it with `--force` after installing packages under an unchanged lockfile
- A push fails on formatting drift until `bun run format` runs, since the `pre-push` hook writes nothing
