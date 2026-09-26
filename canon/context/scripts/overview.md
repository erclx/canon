---
title: Overview
description: What the scripts domain owns, the folder layout, and the decisions that set what stays bash
---

# Overview

Owns every bash script in the repo: the domain entry points behind each `canon` command, repo maintenance, sandbox provisioning, and the shared library functions the rest source. The TypeScript side that parses arguments and dispatches here lives in `canon/context/cli/index.md`.

## Layout

- `scripts/` owns `manage-sandbox.sh`, the only entry point in the folder. No other domain has a dispatcher
- `scripts/core/` owns repo maintenance: bootstrap, verify, regen, snapshot, clean
- `scripts/<domain>/` owns the subcommands for that domain, one file per verb. `standards` and `docs` keep only a list command there, `claude` and `gov` keep nothing, and `tooling` keeps only authoring helpers
- `scripts/standards/` and `scripts/tooling/` hold verbs with no dispatcher above them. Their domains are TypeScript now and `src/commands/` routes into what is left. `gov` is the first domain to empty its folder outright
- `scripts/eval/` owns the authoring harness and its ablation variants. It is not a verb and nothing dispatches to it, so it is invoked by path and never through `canon`
- `scripts/lib/` owns shared functions, sourced and never executed directly. `worktree.sh` is the one under test, via `src/worktree-repair.test.ts`
- `scripts/sandbox/` owns scenario provisioning, covered in `canon/context/sandbox/index.md`

## Decisions

- `manage-sandbox.sh` is the last entry point and stays bash permanently by decision. It holds its domain logic in the dispatcher rather than in a verb folder, so read it before assuming a scenario's behavior sits one file down.
- A migrated domain loses its dispatcher entirely. `tooling/`, `gov/`, `standards/`, and `claude/` still hold the verb scripts that have not moved, but nothing in `scripts/` routes to them. `src/commands/<domain>.ts` does.
- A dispatcher holding domain logic migrates in one pull request per file rather than verb by verb, since splitting the migration of dispatchers that share the same tracking documents would collide there for no review benefit.
- A dispatcher that grew domain logic migrates that logic out to `src/<domain>/` rather than into the command file. Seed collection, gitignore scanning, and a settings merge are the shape that forces it, since a command file can unit-test none of them while `src/exec.ts` throws under vitest.
- Bash keeps only what it is good at as domains migrate. `read_frontmatter_field` stays here because `docs/list.sh` and `standards/list.sh` call it once per field inside a loop, where routing through the CLI would cost a process per read. Coarse operations called once per invocation shell into `canon` instead.
- The frontmatter-loop cost is not on its own enough to keep a verb in bash. `gov/list.sh` reads frontmatter in a loop yet is migrated, because a stack entry naming a rule folder has to expand somewhere, and expanding it in bash beside the TypeScript resolver would put one rule in two languages. A parse the CLI already owns outweighs a process per read.
- A recorded verdict is only as wide as its own reasoning. The frontmatter-loop cost above did not apply to every list verb: `claude/seeds-list.sh` reads with a plain `read -r` loop and `tooling/list.sh` uses `awk`, and both are migrated regardless. Check a stated reason against each file before counting one as settled.
- The two remaining verb scripts stay bash because of who calls them, not how large they are. `tooling/verify.sh` and `tooling/create.sh` are toolkit-internal authoring helpers a human runs at a terminal here. They write nothing into a target and no skill consumes them, so they carry none of the agent-path obligations that moved the other five. `canon tooling reference <stack>` is the TypeScript read verb that replaced the sixth such script, `tooling/ref.sh`.
- Configs always overwrite and seeds preserve user edits. A config is toolkit-owned and a seed grows with the project, so the two need opposite sync behavior.

## Gotchas

- Domain scripts require bash 4+. `scripts/lib/ui.sh` guards the version on source and exits with `brew install bash` instructions when stock macOS bash 3.2 is detected.
- Deleting a bash file needs a sweep by path (`source`, `exec`, `bash <path>`), not by function name. Twelve sandbox scripts sourced `lib/inject.sh` without calling any of its functions, and a sweep by function name missed every one of them along with five live `exec` sites.
- `TOOLING_STACK_EXCLUDE` currently holds only `claude`. Excluded names print a redirect error pointing at the correct CLI and exit 1.
- Headless picker behavior moved to `internal/rules/core/097-non-interactive.md`, which globs `scripts/**/*.sh` and `src/**/*.ts` so it loads when a picker is added rather than when someone thinks to check
- `canon gov install` is the live refusal, returning 1 with the valid names when the argument is missing, because defaulting there picked a whole stack for the caller
