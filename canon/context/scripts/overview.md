---
title: Overview
description: What the scripts domain owns, the folder layout, and the decisions behind what has not moved to TypeScript yet
---

# Overview

Owns every bash script in the repo, being the domain entry points behind each `canon` command, repo maintenance, and the shared library functions the rest source. The TypeScript side that parses arguments and dispatches here lives in `canon/context/cli.md`.

## Layout

No domain keeps a bash dispatcher or a verb folder under `scripts/`. `canon tooling verify` lives in `src/tooling/verify-stack.ts`.

- `scripts/core/` owns repo maintenance: bootstrap, verify, regen
- `scripts/eval/` holds the frozen records of a retired authoring test, being a ledger, a pre-registration, and three results, with no runner
- `scripts/lib/` owns shared functions, sourced and never executed, and no bash function is under test
- `sandbox/` at the project root holds the scenario tree `canon sandbox` provisions from, covered in `canon/context/sandbox/index.md`

## Decisions

### Migration

A migrated domain loses its dispatcher entirely, and `src/commands/<domain>.ts` routes every verb it owns.

- A dispatcher holding domain logic migrates in one pull request per file, since splitting dispatchers that share tracking documents would collide there for no review benefit
- Domain logic moves out to `src/<domain>/` rather than into the command file, since a command file would otherwise drag the spawn and prompt layer into every unit test
- Seed collection, gitignore scanning, and a settings merge are the shape that forces the move

### Verdicts and ownership

The language end state is TypeScript on Bun, and `canon/context/cli.md` covers the CLI side. The stays-bash verdicts record why a file has not moved yet, and an inventory pass sorts each into delete, rebuild, or wrap.

- The frontmatter-loop cost alone does not keep a verb in bash, since a parse the CLI already owns outweighs a process per read
- `gov/list.sh` migrated anyway, since expanding a rule folder in bash beside the TypeScript resolver puts one rule in two languages
- A verdict is only as wide as its reasoning. `claude/seeds-list.sh` and `tooling/list.sh` read with `read -r` and `awk` and migrated regardless, so check a stated reason against each file.
- Configs always overwrite and seeds preserve user edits, since a config is toolkit-owned and a seed grows with the project

## Gotchas

### Runtime and deletion

Domain scripts require bash 4+. `scripts/lib/ui.sh` guards the version on source and exits with `brew install bash` instructions when stock macOS bash 3.2 is detected.

- Sweep a deleted bash file by path (`source`, `exec`, `bash <path>`), not by function name, since twelve sandbox scripts sourced `lib/inject.sh` without calling a function
- `EXCLUDED_STACKS` in `src/tooling/manifest.ts` currently holds only `claude`, and an excluded name prints a redirect error pointing at the correct CLI and exits 1

### Headless behavior

Headless picker behavior lives in `internal/rules/core/non-interactive.md`, which globs `scripts/**/*.sh` and `src/**/*.ts` so it loads when a picker is added.

`canon gov install` returns 1 with the valid names when the argument is missing, because defaulting there picked a whole stack for the caller.
