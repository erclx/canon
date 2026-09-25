---
title: Overview
description: Where shell scripts and hooks live, the eight hooks shared with the seed, the audit hook's unresolved dependencies, the dev command reminder, and linting both hook trees
---

# Overview

## Overview

Owns the Claude Code hooks this repository runs on itself and the husky git hooks that gate commits, pushes, and merges. The seeded copies a target receives are the tooling domain's, and `canon/context/claude-plugin/cli.md` covers what `canon claude init` installs.

## Layout

- `.claude/hooks/` owns the toolkit's own Claude Code hooks, wired through `.claude/settings.json`
- `.husky/` owns the git hooks
- `scripts/` owns every other shell script

`canon/context/development/hooks/guards.md` covers the hooks that guard a tool call, `canon/context/development/hooks/compaction.md` the hooks on `PreCompact` and `Stop`, `canon/context/development/hooks/settings.md` the session budget settings, and `canon/context/development/hooks/husky.md` the git hooks.

## Decisions

### One home per shell script

All `.sh` files live under `scripts/`, except Claude Code hooks, which live in `.claude/hooks/`. Do not place shell scripts anywhere else.

### Eight hooks share a name with the seed

Eight hooks carry the same names as the hooks `canon claude init` seeds from `tooling/claude/seeds/.claude/hooks/`: `index-reminder.sh`, `memory-index.sh`, `path-form.sh`, `pr-create-log.sh`, `scratch-guard.sh`, `silent-turn.sh`, `standards-audit.sh`, and `tasks-index.sh`. Seven stay byte-identical to their seeded copies, checked by a hand diff rather than assumed. `standards-audit.sh` is the one pair that diverges on purpose, covered under the audit hook below.

Five of the eight, `index-reminder.sh`, `memory-index.sh`, `scratch-guard.sh`, `standards-audit.sh`, and `tasks-index.sh`, match on the edited file's own path rather than resolving a root. Each matches both the current `.canon/` root and the retired `.claude/` root, spelling the scratch folder `tmp` under the first and `.tmp` under the second. A hook fixed at one spelling alone stops matching the moment a target sits on the other, and the index goes stale with nothing said.

### What the audit hook could not read

Both copies of `standards-audit.sh` depend on something outside themselves, and each reports the dependency it failed to resolve rather than exiting clean. A pass on a file nobody checked reads the same as a pass on a file carrying no violation, and the report is what separates them.

Neither copy parses a standard directly. Both read a `markdown audit --json` record, so both reach the defect by the same two routes: resolving no runner reports that nothing ran, and a record naming an empty shipped ban set reports a check narrowed to what the verb could measure. The verb returns that field either way, and reading the findings beside it alone is what would let a narrowed check report a pass.

The seed differs from the toolkit copy in what it can resolve rather than in what it reads. It reaches an installed binary alone, since a scaffolded project has no checkout to run the CLI out of, and it names `bun add -g @erclx/canon` when the machine carries none. A non-zero exit is the blunter alternative and carries more than a PostToolUse event warrants.

`hooks-guard.test.ts` covers all four branches, and each case stubs a runner or withholds one, so the verdict comes from the fixture rather than from whichever build the machine carries.

### The dev command reminder

`dev-command-reminder.sh` is toolkit-only and has no seed counterpart. It fires once per session when a `Bash` command runs `check`, `format`, or `check:install`, and points the agent at this domain. The matcher tests the command string rather than the tool name, because `Bash` is the highest-frequency tool in a session and a loose matcher would add latency to every shell call. It stays silent on `check:types` and `test`, which need no reminder.

The filter, the match, and the session id come out of one `jq` pass, so the hot path costs a single process and the second `jq` runs only when the hook actually fires. Splitting the fields through `@tsv` instead looks equivalent and is not: `@tsv` escapes a newline to a literal `\n`, which puts a backslash where the matcher expects whitespace or end of string, and every multi-line command stops matching. A run with no `session_id` exits rather than sharing one marker file, since per-session dedupe needs a real id.

The `entry` the hook names is guarded on existing, so a path this repository does not carry disables the reminder in silence rather than failing it. That target is `canon/context/development/index.md`, the catalog naming every sibling, because the gotchas the reminder exists to surface sit in several of them and no one file holds the set.

## Gotchas

### Silencing a hook discards the guarantee it carries

A hook that is the only enforcer of a rule cannot discard its command's output, because the reflexive `>/dev/null 2>&1 || exit 0` makes the documented guarantee false. The task index hook suppressed a regen failure while `standards/tasks.md` promised a missing frontmatter field surfaces on the next edit, and the folder is gitignored so `bun run check` cannot reach it and no gate stage would ever have gone red. Before silencing a hook, name the stage that catches the same failure. Where none exists, capture into a variable, exit 0 on success, and emit the error lines as `additionalContext`.

### The two hook trees drift with nothing comparing them

`.claude/hooks/` and `tooling/claude/seeds/.claude/hooks/` hold the same scripts maintained twice, and nothing regenerates or compares them. A branch fixing one side can leave the other running the old logic, and the drift is silent because each copy is valid shell that passes every stage, so only a hand diff finds it. `src/hooks-guard.test.ts` is the one exception, walking both directories for the stdin guard covered in `canon/context/development/hooks/guards.md`.

### Linting the hooks

`check:shell` lints `.claude/hooks/` alongside `scripts/`, `tooling/`, and `claude/`. It has to, because the shell stage is gated on any `.sh` change. Linting a narrower set than the gate keys on produces a stage that fires on a hook edit, inspects other directories, and reports a pass that says nothing about the file that triggered it. Keep the glob and the gate pattern in step whenever either moves.

The husky hooks are linted by a second run rather than by that glob, for the reason `canon/context/development/hooks/husky.md` states. A file with no extension is reached by a path list and skipped by a name filter, so the two halves have to move together.

The stage's own `scope` in `src/gate/stages.ts` is the third half and it moves with them. It reads `/\.sh$|^\.husky\/|^package\.json$/`, and the `.husky` prefix is what makes a branch touching only a hook run the stage at all. Widening `check:shell` without it lints those files on a branch that happened to change a `.sh` file or the manifest and skips them otherwise, which is a gate passing by coincidence. `src/gate/stages.test.ts` asserts the three arms so the scope cannot narrow back unnoticed.
