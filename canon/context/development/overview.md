---
title: Overview
description: What the development domain owns, the toolchain setup, the run command table and its consumers, and why the entry is a folder
---

# Overview

Owns the local development loop, being toolchain setup, the run commands, and the git hooks that gate commits and pushes. CI runs the same stages through `bun run check:ci`, covered in `canon/context/ci.md`.

Domain behavior for what each script does lives in the entry for that domain. `CONTRIBUTING.md` at the repository root states the contributor-facing subset and points back here for the rest.

## Layout

- `scripts/` owns every shell script except the Claude Code hooks, grouped into a folder per domain
- `.claude/hooks/` owns the Claude Code hooks
- `.husky/` owns the git hooks

### Setup

Three steps install the toolchain.

- Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- Install bash 4+ on macOS: `brew install bash`
- Install dependencies: `bun install`

### Scripts

| Command                 | Purpose                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `bun run check`         | Verification scoped to changed files. Fails on format drift, regenerates indexes, asserts clean. |
| `bun run check:ci`      | Every stage via `--all`, the run CI does. Still regenerates.                                     |
| `bun run check:format`  | Read-only oxfmt, Prettier for `.astro`, and shfmt format check.                                  |
| `bun run check:shell`   | Read-only shellcheck against `scripts/`, `tooling/`, and `.claude/hooks/`.                       |
| `bun run check:lint`    | Read-only oxlint at its default rules, failing on any warning.                                   |
| `bun run check:types`   | Read-only `tsc --noEmit` against `src/`.                                                         |
| `bun run check:install` | Clones the repo to tmp and asserts `canon init` lands a fresh scaffold.                          |
| `bun run format`        | Auto-fix oxfmt, Prettier for `.astro`, and shfmt formatting.                                     |
| `bun run clean`         | Wipe `node_modules/`, clear bun cache, reinstall.                                                |
| `bun run update`        | Interactive `bun update` followed by verification.                                               |

### What reads the table

`claude/skills/context-fold/references/context.md` scopes the `## Scripts` heading to this domain by name, and this file is where it lands. Two surfaces read the table, so a command added anywhere else is invisible to them: every stack reference extends it, and `docs/target/projects.md` tells a target to keep its own copy current.

The table stays a table against the catalog rule beside it, which sends a surface growing a row per shipped thing to a bullet list. That rule answers reflow conflicts between sibling branches, and the same standard names this section a table. `canon context audit` reports the row count under Tables on every run, so the finding is expected.

## Gotchas

### Why `check:lint` disables nested configs

Without `--disable-nested-config`, oxlint loads the golden `.oxlintrc.json` under each `tooling/*/configs/` and fails on JS plugins this repository does not install. A root `ignorePatterns` entry does not stop that discovery at the pinned version.

The root `.oxlintrc.json` still ignores those folders, which keeps their stand-in files out of the run, since `canon tooling verify` lints them under each stack's own config.

### Why the entry is a folder

The entry is a folder on the sub-area condition rather than length. `claude/skills/context-fold/references/context.md` splits a domain at three or more sub-areas that do not fit in one file, and this domain has setup, `bun run check` scoping, test scoping, regeneration, gating, hooks, session scratch, and record folders.

The stages that gate and the hook families each span enough sub-areas to be folders of their own, `canon/context/development/gates/` and `canon/context/development/hooks/`.

### Why most citations kept the flat path

Fifteen files name the flat path and ten of them instruct a target project about its own entry rather than pointing into this repository. A target seeded from `tooling/base/seeds/` carries a flat `development.md`, so retargeting those sites would ship a path that resolves nowhere into every scaffolded project, and no stage here would report it.

Those sites keep the flat spelling, so the citation gate, which resolves every `canon/context/*.md` string against this root, passes a pre-split flat path only because it describes a target's layout. Which repair applies turns on whether the surface installs.

- A line in a file that reaches a target drops the path, since a marker there is toolkit bookkeeping in someone else's tree, as in the seeded `CLAUDE.md`
- A line that stays in this repository carries `<!-- audit-ignore-citations -->`, which is `docs/target/projects.md` alone
- Where a stop message has to spell the flat path, a fenced block carries it, since the gate skips fences in markdown
- Widening the gate by location would silence a real stale reference in the same trees

### A prose edit can break a test no stage in that push runs

The Types and Tests stages are scoped to changed files, and several `src/` test files assert over a corpus outside `src/`. Tests runs on a change to a corpus the census names and skips other markdown-only pushes, so an unnamed corpus breaks a test nothing in that push runs. `canon/context/development/tests.md` holds the census.

The markdown checkpoints are not in it. `CHECKPOINTS` and the ban set ship as literals in `src/markdown/`, and `src/markdown/structure.test.ts` asserts them against itself rather than `claude/skills/markdown-craft/references/markdown.md`. Editing a standard that states one fails nothing, and the prose drifts unless the editor catches it.

### The consumed-copies stage fails on its own regeneration

The stage regenerates the copies and asserts `git diff --exit-code` over `.claude/rules`, so a session editing a governance rule sees it fail on the regeneration of that same edit. An edit under `standards/` or `internal/` no longer reaches the stage, since nothing mirrors those corpora.

Staging the regenerated file satisfies the assertion as well as committing it, which lets the stages below it run before the session reaches its commit step. Re-running the command alone never clears it, since the second run regenerates the same diff.
