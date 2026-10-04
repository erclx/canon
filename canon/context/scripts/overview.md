---
title: Overview
description: What the scripts domain owns, the folder layout, and the decisions behind what has not moved to TypeScript yet
---

# Overview

Owns every bash script in the repo: the domain entry points behind each `canon` command, repo maintenance, sandbox provisioning, and the shared library functions the rest source. The TypeScript side that parses arguments and dispatches here lives in `canon/context/cli/index.md`.

## Layout

- `scripts/` owns `sandbox-hook.sh`, the bash entry the TypeScript sandbox harness spawns to run a scenario's hooks. No domain keeps a bash dispatcher
- `scripts/core/` owns repo maintenance: bootstrap, verify, regen
- No domain keeps a verb folder under `scripts/`. `tooling` was the last to empty its own, once `canon tooling verify` moved to `src/tooling/verify-stack.ts`
- `scripts/eval/` holds the frozen records of a retired authoring test, being a ledger, a pre-registration, and three results. It carries no runner and nothing dispatches to it
- `scripts/lib/` owns shared functions, sourced and never executed directly. No bash function is under test
- The scenario tree that `canon sandbox` provisions from sits at `sandbox/` in the project root, outside this folder, covered in `canon/context/sandbox/index.md`

## Decisions

- The sandbox scenarios stay bash permanently by decision. Their provisioning order moved to `src/sandbox/provision.ts`, and each scenario's hooks run through `scripts/sandbox-hook.sh`, so read both before assuming a scenario's behavior sits in its own file.
- A migrated domain loses its dispatcher entirely, and `src/commands/<domain>.ts` routes every verb it owns.
- A dispatcher holding domain logic migrates in one pull request per file rather than verb by verb, since splitting the migration of dispatchers that share the same tracking documents would collide there for no review benefit.
- A dispatcher that grew domain logic migrates that logic out to `src/<domain>/` rather than into the command file. Seed collection, gitignore scanning, and a settings merge are the shape that forces it, since a command file can unit-test none of them while `src/exec.ts` throws under vitest.
- The language end state is the stack entry in `canon/ARCHITECTURE.md`. The stays-bash verdicts below record why each file has not moved yet rather than that it never will, and an inventory pass sorts each one into delete, rebuild, or wrap.
- The frontmatter-loop cost is not on its own enough to keep a verb in bash. `gov/list.sh` reads frontmatter in a loop yet is migrated, because a stack entry naming a rule folder has to expand somewhere, and expanding it in bash beside the TypeScript resolver would put one rule in two languages. A parse the CLI already owns outweighs a process per read.
- A recorded verdict is only as wide as its own reasoning. The frontmatter-loop cost above did not apply to every list verb: `claude/seeds-list.sh` reads with a plain `read -r` loop and `tooling/list.sh` uses `awk`, and both are migrated regardless. Check a stated reason against each file before counting one as settled.
- Configs always overwrite and seeds preserve user edits. A config is toolkit-owned and a seed grows with the project, so the two need opposite sync behavior.

## Gotchas

- Domain scripts require bash 4+. `scripts/lib/ui.sh` guards the version on source and exits with `brew install bash` instructions when stock macOS bash 3.2 is detected.
- Deleting a bash file needs a sweep by path (`source`, `exec`, `bash <path>`), not by function name. Twelve sandbox scripts sourced `lib/inject.sh` without calling any of its functions, and a sweep by function name missed every one of them along with five live `exec` sites.
- `EXCLUDED_STACKS` in `src/tooling/manifest.ts` currently holds only `claude`. Excluded names print a redirect error pointing at the correct CLI and exit 1.
- Headless picker behavior moved to `internal/rules/core/097-non-interactive.md`, which globs `scripts/**/*.sh`, `sandbox/**/*.sh`, and `src/**/*.ts` so it loads when a picker is added rather than when someone thinks to check
- `canon gov install` is the live refusal, returning 1 with the valid names when the argument is missing, because defaulting there picked a whole stack for the caller
