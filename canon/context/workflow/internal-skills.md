---
title: Claude internal
description: Toolkit-only internal skills, the upstream release digest behind them, local plugin discovery, and the worktree traps a session here hits
---

# Claude internal

## Overview

Owns the Claude surfaces that never leave this repository, being the `internal-*` skills, the upstream release digest, and how a local session loads the plugin. What ships to targets sits in `canon/context/surfaces/plugin.md`, and multi-session coordination in `canon/context/workflow/orchestration.md`.

## Layout

### `.claude/skills/`

Holds the `internal-*` skills, each loaded before editing one toolkit domain and never installed into a target.

- Every skill carries a `REQUIREMENT.md`, so the corpus can be read for whether a skill should exist at all
- `governance/rules/claude/skill.md` gates edits to `SKILL.md` and `REQUIREMENT.md` in both corpora
- `internal-feedback-triage` files this repository's open `feedback` issues into an intake folder, and stays internal since a target has no queue to read
- `internal-sandbox-check` verifies one arm per run through `canon sandbox run` and prints the rest as a command
- `internal-upstream-digest` runs by hand in the operator's session and calls `bun src/cli.ts`, since the global binary lacks the verb until a release

### `src/upstream/`

Reads the Claude Code releases since the last digest and keeps the cursor. The verb contract is in `canon upstream --help`.

- `fetch` and `catalog` only read, and `advance` is a separate call made after the intake pass is filed, so a run that dies between rereads the same range
- The walk stops at the first release not newer than the cursor by version comparison, never an exact tag match
- `due` caches its feed read for a day, failures included, and a cursor seven days old is due
- `.claude/hooks/upstream-due.sh` prints one `systemMessage` line to the operator on an attended startup and skips a background session

### `.claude/worktrees/`

Holds the linked worktrees sessions build in, entered through `session-worktree`.

- Move a batch of files at the main worktree root with `xargs -a <list> mv -t <destination>`, the list built into a scratchpad file by an earlier command
- Exclude `*/.claude/worktrees/*` by name from any `find`, `grep -r`, or checksum sweep over a project root, since a worktree's `.git` is a file and `-not -path '*/.git/*'` misses it
- A plan slug with a hyphen-bounded `git` segment blocks the branch rename, so rename the plan file, re-derive the branch with `canon tasks plan-branch`, then create it off the target commit
- List merged branches with `git branch --merged --format='%(refname:short)'`, which drops the `*` and `+` decoration a literal-indent grep trips on

### Other folders

The entries around this domain each own one slice.

- `claude/.claude-plugin/` is where a session inside this repository auto-discovers the plugin, with no flag on a fresh launch
- Elsewhere pass `--plugin-dir`, and pass it again on `claude --resume`, which restores the registration the session started with
- `docs/workflow/zshrc-aliases.md` owns the launch aliases, and `canon claude setup` provisions user-level config as `canon/context/surfaces/plugin.md` states

## Gotchas

- Worktree entry bases the branch on the local `origin/main` ref without fetching, so a stale ref starts the work behind the remote and nothing reports it
- A session that edits a plugin skill and then invokes it gets the pre-edit body, since `--plugin-dir` resolves against the main worktree
- The isolation guard reads a `Bash` line as text, so a second `git` token such as a `git-followup` pathspec or branch slug, or a command substitution around a redirect, is refused
