---
title: Overview
description: Where shell scripts and hooks live, the ten hooks shared with the seed, the audit hook's unresolved dependencies, the dev command reminder, and linting both hook trees
---

# Overview

## Overview

Owns the Claude Code hooks this repository runs on itself and the husky git hooks that gate commits, pushes, and merges. The seeded copies a target receives are the tooling domain's, and `canon/context/claude-plugin.md` covers what `canon claude init` installs.

## Layout

All `.sh` files live under `scripts/`, except Claude Code hooks in `.claude/hooks/`. Do not place shell scripts anywhere else.

- `.claude/hooks/` owns the toolkit's own Claude Code hooks, wired through `.claude/settings.json`
- `.husky/` owns the git hooks
- `scripts/` owns every other shell script

Each sibling entry in this folder covers one family.

- `canon/context/development/hooks/guards.md` covers the hooks that guard a tool call
- `canon/context/development/hooks/command-scanners.md` covers the two that cut a `Bash` command
- `canon/context/development/hooks/compaction.md` covers the hooks on `PreCompact` and `Stop`
- `canon/context/development/hooks/settings.md` covers the session budget settings
- `canon/context/development/hooks/husky.md` covers the git hooks

## Decisions

### Ten hooks share a name with the seed

Ten hooks carry the names of the hooks `canon claude init` seeds from `tooling/claude/seeds/.claude/hooks/`: `index-reminder.sh`, `path-form.sh`, `pr-create-log.sh`, `records-index.sh`, `reply-links.sh`, `review-post-scan.sh`, `scratch-guard.sh`, `search-reminder.sh`, `silent-turn.sh`, and `standards-audit.sh`.

- Eight stay byte-identical to their seeded copies, checked by a hand diff rather than assumed
- `standards-audit.sh` and `reply-links.sh` diverge on purpose, since the seeded copy reaches an installed binary alone and the toolkit copy prefers the checkout's own source
- The first pair is covered under the audit hook below and the second in `canon/context/development/hooks/compaction.md`

Four of the ten, `index-reminder.sh`, `records-index.sh`, `scratch-guard.sh`, and `standards-audit.sh`, match on the edited file's own path rather than resolving a root. Each matches both the current `.canon/` root and the retired `.claude/` root, spelling the scratch folder `tmp` under the first and `.tmp` under the second.

The scratch guard holds a third exemption, the harness's own `.claude/jobs/<id>/tmp/`. A hook fixed at one spelling stops matching the moment a target sits on the other, and the index goes stale with nothing said.

### What the audit hook could not read

Both copies of `standards-audit.sh` report the dependency they failed to resolve rather than exiting clean, since a pass on a file nobody checked reads the same as a pass on a file with no violation.

Neither parses a standard directly. Both read a `markdown audit --json` record, so both hit the same two defects.

- Resolving no runner reports that nothing ran
- A record naming an empty shipped ban set reports a check narrowed to what the verb could measure, since reading the findings alone would let a narrowed check report a pass
- Both copies hand back every density finding in the record, gating or not, since the verb returns one only for a path in its scope

The seed differs in what it can resolve, not in what it reads. A scaffolded project has no checkout, so it reaches an installed binary alone and names `bun add -g @erclx/canon` when the machine carries none. A non-zero exit would be blunter than a PostToolUse event warrants.

`src/hooks/guard.test.ts` covers all four branches, each stubbing a runner or withholding one, so the verdict comes from the fixture rather than the machine's build.

### The dev command reminder

`dev-command-reminder.sh` is toolkit-only. It fires once per session when a `Bash` command runs `check`, `format`, or `check:install`, and points the agent at this domain. It stays silent on `check:types` and `test`, which need no reminder.

- The matcher tests the command string rather than the tool name, because `Bash` is the highest-frequency tool and a loose matcher would add latency to every shell call
- The filter, the match, and the session id come out of one `jq` pass, so the hot path costs a single process
- `@tsv` looks equivalent and is not, since it escapes a newline to a literal `\n` and every multi-line command stops matching
- A run with no `session_id` exits, since per-session dedupe needs a real id

The `entry` the hook names is guarded on existing, so a missing path disables the reminder in silence rather than failing it. That target is `canon/context/development/index.md`, since the gotchas the reminder surfaces sit in several siblings and no one file holds the set.

## Gotchas

### Silencing a hook discards its guarantee

A hook that is the only enforcer of a rule cannot discard its command's output, because the reflexive `>/dev/null 2>&1 || exit 0` makes the documented guarantee false. The task index hook suppressed a regen failure while `claude/skills/task-board/references/tasks.md` promised a missing frontmatter field surfaces on the next edit.

The folder is gitignored, so `bun run check` cannot reach it and no gate stage would go red. Name the stage that catches the same failure before silencing a hook. Where none exists, capture into a variable, exit 0 on success, and emit the error lines as `additionalContext`.

### The two hook trees drift

`.claude/hooks/` and `tooling/claude/seeds/.claude/hooks/` hold the same scripts maintained twice, and nothing regenerates or compares them. A branch fixing one side can leave the other on the old logic, silently, since each copy is valid shell that passes every stage, so only a hand diff finds it.

`src/hooks/guard.test.ts` is the one exception, walking both directories for the stdin guard covered in `canon/context/development/hooks/guards.md`.

### Linting the hooks

`check:shell` lints `.claude/hooks/` alongside `scripts/`, `tooling/`, and `claude/`, because the shell stage is gated on any `.sh` change. A narrower glob than the gate keys on fires on a hook edit, inspects other directories, and reports a pass that says nothing about the file that triggered it. Keep the glob and the gate pattern in step.

The husky hooks are linted by a second run for the reason `canon/context/development/hooks/husky.md` states. A file with no extension is reached by a path list and skipped by a name filter, so the two halves move together.

### The shell stage scope

The stage's own `scope` in `src/gate/stages.ts` is the third half. It reads `/\.sh$|^\.husky\/|^package\.json$/`, and the `.husky` prefix is what makes a branch touching only a hook run the stage at all.

Widening `check:shell` without it lints those files on a branch that happened to change a `.sh` file or the manifest and skips them otherwise, a gate passing by coincidence. `src/gate/stages.test.ts` asserts the three arms so the scope cannot narrow back unnoticed.
