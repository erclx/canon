---
title: Overview
description: What the development domain owns, the toolchain setup, the run command table and its consumers, and why the entry is a folder
---

# Overview

Owns the local development loop: toolchain setup, the run commands, and the git hooks that gate commits and pushes. CI runs the same stages through `bun run check:ci`, covered in `canon/context/ci/overview.md`. Domain behavior for what each script does lives in the entry for that domain. `CONTRIBUTING.md` at the repository root states the contributor-facing subset of this domain and points back here for the rest.

## Layout

- `scripts/` owns every shell script except the Claude Code hooks, grouped into a folder per domain
- `.claude/hooks/` owns the Claude Code hooks
- `.husky/` owns the git hooks

## Setup

- Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- Install bash 4+ on macOS: `brew install bash`.
- Install dependencies: `bun install`

## Scripts

| Command                 | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `bun run check`         | Verification scoped to changed files. Auto-formats, regenerates indexes, asserts clean.  |
| `bun run check:ci`      | Every stage via `--all`, asserting formatting instead of applying it. Still regenerates. |
| `bun run check:format`  | Read-only prettier and shfmt format check.                                               |
| `bun run check:spell`   | Read-only cspell check against project dictionaries.                                     |
| `bun run check:shell`   | Read-only shellcheck against `scripts/`, `tooling/`, and `.claude/hooks/`.               |
| `bun run check:types`   | Read-only `tsc --noEmit` against `src/`.                                                 |
| `bun run check:install` | Clones the repo to tmp and asserts `canon init` lands a fresh scaffold.                  |
| `bun run format`        | Auto-fix prettier and shfmt formatting.                                                  |
| `bun run clean`         | Wipe `node_modules/`, clear bun cache, reinstall.                                        |
| `bun run update`        | Interactive `bun update` followed by verification.                                       |
| `bun run snapshot`      | Snapshot project state for diffs.                                                        |

### What reads the table

`standards/context.md` scopes the `## Scripts` heading to this domain by name, and this file is where it lands. Three surfaces read the table, so a command added anywhere else is a command they cannot see: `project-commands` resolves a request against it, every stack reference extends it, and `docs/target/projects.md` tells a target to keep its own copy current.

The table stays a table against the catalog rule beside it, which sends a surface that grows a row per shipped thing to a bullet list. That rule answers reflow conflicts between sibling branches, and the same standard names this section a table in the sentence that scopes it here. `canon context audit` reports the row count under Tables on every run, so the finding is expected rather than outstanding.

## Gotchas

### Why the entry is a folder

The entry is a folder on the sub-area condition rather than on length. `standards/context.md` splits a domain at three or more sub-areas that do not fit cleanly in one file, and setup with the run commands, the scoping of `bun run check`, test scoping, the stages that regenerate, the stages that gate, the hook families, session scratch, and the record folders do not. The stages that gate and the hook families each span enough sub-areas to be folders of their own, `canon/context/development/gates/` and `canon/context/development/hooks/`.

### Why most citations kept the flat path

Fifteen files name the flat path and ten of them instruct a target project about its own entry rather than pointing into this repository. A target seeded from `tooling/base/seeds/` carries a flat `development.md`, so retargeting those sites would ship a path that resolves nowhere into every scaffolded project, and no stage here would report it.

Those sites keep the flat spelling, and the citation gate is what that costs. It resolves every `canon/context/*.md` string in the repository against this root, so a citation naming the pre-split flat path passes only because it describes a target's own layout rather than this repository's.

Two repairs follow, and which one applies turns on whether the surface installs. A line in a file that reaches a target drops the path, since a marker there is toolkit bookkeeping landing in someone else's tree. That covers the seeded `CLAUDE.md` and the `project-commands` guard and the row describing it. A line that stays in this repository carries `<!-- audit-ignore-citations -->` instead, which is `docs/target/projects.md` alone.

Widening the gate by location was the alternative, and it would silence a real stale reference in the same trees. Where a stop message has to spell the flat path, a fenced block carries it rather than a marker, since the gate skips fences in markdown.

### A prose edit can break a test no stage in that push runs

The Types and Tests stages are scoped to changed files, and several `src/` test files assert over a corpus outside `src/`. Tests runs on a change to a corpus the census names and skips every other markdown-only push, so a corpus the census has not named breaks a test nothing in that push runs. `canon/context/development/tests.md` holds the census and the command to run beside each corpus.

The markdown checkpoints are not one of them. `CHECKPOINTS` and the ban set ship as literals in `src/markdown/`, and `src/markdown/structure.test.ts` asserts those numbers against itself rather than reading them back off `standards/markdown.md`. Editing a standard that states one of those numbers therefore fails nothing, and the drift between the prose and the shipped value is caught by whoever edits or not at all.

### The consumed-copies stage fails on its own regeneration

The stage regenerates the copies and then asserts `git diff --exit-code` over `.claude/rules`, so a session that edits a governance rule sees it fail on the regeneration of that same edit. An edit under `standards/` or `internal/` no longer reaches this stage at all, since nothing mirrors those corpora. Staging the regenerated file satisfies the assertion as well as committing it does, which is what lets the stages below it run before the session reaches its commit step. Re-running the command alone never clears it, since the second run regenerates the same diff.
