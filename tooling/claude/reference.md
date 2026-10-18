# Tooling Claude reference

## Overview

The claude stack installs the Claude Code workflow into a project through `canon claude`. Every file it ships is a seed, written once and never overwritten, so a project fills `CLAUDE.md` in after init.

## Seeded records

- `CLAUDE.md` holds project context and rules, auto-loaded by Claude Code each session
- `canon/REQUIREMENTS.md` holds the project's problem, goals, and non-goals
- `canon/DESIGN.md` holds the visual intent and the decisions behind it
- `canon/context/` holds per-domain narrative, with `index.md` as the discovery anchor
- `.claude/settings.json` holds project-level Claude Code config. User-level config installs separately through `canon claude setup`.

## Record folders

- `.canon/tasks/` holds one file per task plus a generated `index.md`, local scratch only, with `archive/` holding the tasks that shipped
- `.canon/plans/` holds execution detail for multi-step tasks, and `canon tasks archive` moves a `feature-*.md` plan into `archive/` when the `post-merge` hook archives its task
- `.canon/review/` holds one subfolder per producer, with `design/` for `canon design render`
- `.canon/tmp/` is ephemeral scratch, safe to delete without loss
- `.claude/worktrees/` is where `EnterWorktree` creates a linked worktree, which is why it stays under `.claude/`

## Ignored roots

The `# Claude` group ignores `.canon/` whole, so nothing tracked may land there and a record folder added later needs no new entry.

- Keep `.claude/worktrees/` as its own entry, since the harness requires a worktree's target to sit under `.claude/`
- Expect a project scaffolded before the move to keep its records under `.claude/`, since every command reads either root
- Expect `canon gov sync` to remove a retired `.claude/GOV.md` left by a prior install

## Moving the records to `.canon/`

A project installed before the split holds its records under `.claude/`. `canon migrate records` moves them and repoints every tracked file that cites one, reporting the plan until `--write` is passed.

- Run `canon tooling sync claude . --write` first. The verb refuses until the project ignores `.canon/`, since a relocated folder under a tracked root commits the task board and plans.
- Move soon after the sync, since until then the records sit at a root the shipped ignore set no longer names and a `git add -A` picks them up
- Run `bun src/cli.ts migrate records --root <project> --write` from a canon checkout while the installed binary answers `unknown command`
- Read the `ok` field out of `--json` rather than the exit code, which a shell wrapper around `canon` can flatten

## Upgrading from a single-file board

A project installed before the board became a folder still holds `.claude/TASKS.md`, and nothing migrates it. `canon claude init` seeds an empty `.canon/tasks/index.md` beside it, so every skill reads the empty catalog while the real board sits unreferenced.

1. Split each `###` block into `.canon/tasks/vXX.Y-<slug>.md`, adding the `title` and `description` frontmatter the `task-board` skill requires. Compare each new file against its source block.
2. Run `canon indexes regen --no-stage --root . .canon/tasks/<any-task>.md` to build the catalog.
3. Delete `.claude/TASKS.md`, and swap its `.gitignore` entry for `.canon/tasks/`.

## CLI

| Command              | What it does                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canon claude init`  | Seeds `.claude/` workflow docs, updates `.gitignore`                                                                                                                             |
| `canon claude sync`  | Reconciles `.gitignore` against the manifest. Reports seeded file status.                                                                                                        |
| `canon claude setup` | Installs user-level config to `~/.claude/` once per machine: statusline and the permissions allow and deny lists, and removes the empty attribution pair an earlier setup wrote. |

## CLAUDE.md

- Fill in the seed's placeholder project name, description, and key paths after init
- Keep its sections `Context`, `Commands`, and `Key paths`, since skills detect, extend, or skip by heading
- Keep the `Context` section to one line pointing at the state docs, since `plan-feature` does the parallel read when invoked

## Seed docs

- Read a seed doc's guidelines preamble above the first H2 as instructions for filling the sections below, never as a section to populate

## settings.json

- Pair the seed's three PreToolUse hooks with `index-reminder.sh`, `search-reminder.sh`, and `scratch-guard.sh`, and its PostToolUse hook with `standards-audit.sh`, all under `.claude/hooks/`
- Keep only what is project-specific in the project file, since project settings layer over user settings
- Expect `permissions.deny` to hold `Agent` and `Task`, so no session spawns a subagent and parallel work runs as separate background sessions
- Expect `autoMemoryEnabled` to be `false`. A person turns it back on for themselves in `settings.local.json`.
- Run `canon migrate session-defaults` on a target seeded before those two defaults, since sync never rewrites an existing settings file

## User settings

- `canon claude setup` installs `tooling/claude/user/settings.template.json` once per machine
- It allows `Bash(bun run *)` under `permissions.allow`
- Its `permissions.deny` holds `Read(**/.env)` and `Read(**/.env.*)`, blocking accidental secret exposure across any project
