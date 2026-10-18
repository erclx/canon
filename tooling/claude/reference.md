# Tooling Claude reference

## Overview

The claude stack installs the `.claude/` workflow directory into a project. Tooling writes state docs once and never overwrites them. `CLAUDE.md` is one of those seeds, and a project fills it in after init.

## Structure

```plaintext
CLAUDE.md              ← seeded. Project context and rules, auto-loaded by Claude Code each session

canon/
├── REQUIREMENTS.md    ← seeded. Project problem, goals, non-goals
├── DESIGN.md          ← seeded. Visual intent and the decisions behind it
└── context/           ← seeded. Per-domain narrative. `index.md` is the discovery anchor.

.claude/
├── GOV.md             ← retired. Removed by `canon gov sync` if present from a prior install
├── settings.json      ← seeded. Project-level Claude Code config (PreToolUse and PostToolUse hooks). User-level config installed separately via `canon claude setup`.
└── worktrees/         ← gitignored. Where EnterWorktree creates a linked worktree, which is why it did not move.

.canon/
├── tasks/             ← seeded. One file per task plus a generated index.md, local scratch only. `archive/` holds the tasks that shipped.
├── plans/             ← execution detail for multi-step tasks. `feature-*.md` entries moved into `archive/` by `canon tasks archive` when the `post-merge` hook archives their task.
├── review/            ← one subfolder per producer. `branch/` no longer written, `design/` for canon design render.
└── tmp/               ← ephemeral scratch space, safe to delete without loss
```

One ignore entry covers `.canon/` whole, so nothing under it is named separately and nothing tracked may land there. A project scaffolded before the move keeps its records under `.claude/`, and every command reads either root.

## Moving the records to `.canon/`

A project installed before the split holds its records under `.claude/`. `canon migrate records` moves them and repoints every tracked file that cites one, reporting the plan until `--write` is passed.

- Run `canon tooling sync claude . --write` first. The verb refuses until the project ignores `.canon/`, since a relocated folder under a tracked root commits the task board and plans.
- Until the move runs, the records sit at a root the shipped ignore set no longer names, so a `git add -A` in that window picks them up.
- An installed binary answers `unknown command` until a published release carries the verb. Meanwhile run `bun src/cli.ts migrate records --root <project> --write` from a canon checkout.
- Read the `ok` field out of `--json` rather than the exit code, which a shell wrapper around `canon` can flatten.

## Upgrading from a single-file board

A project installed before the board became a folder still holds `.claude/TASKS.md`, and nothing migrates it. `canon claude init` seeds an empty `.canon/tasks/index.md` beside it and leaves the old file untouched, so every skill reads the empty catalog while the real board sits unreferenced.

Convert by hand, once per project.

1. Split each `###` block into `.canon/tasks/vXX.Y-<slug>.md`, adding the `title` and `description` frontmatter the `task-board` skill requires. Compare each new file against its source block.
2. Run `canon indexes regen --no-stage --root . .canon/tasks/<any-task>.md` to build the catalog.
3. Delete `.claude/TASKS.md`, and swap its `.gitignore` entry for `.canon/tasks/`.

## Gitignore

The `# Claude` group holds two entries, being `.canon/` and `.claude/worktrees/`.

- The first entry covers the whole record root, so a record folder added later needs no line here and no sync.
- The second is the carve-out the harness owns, since it creates a worktree under `.claude/` and requires its target to sit there.

## CLI

| Command              | What it does                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canon claude init`  | Seeds `.claude/` workflow docs, updates `.gitignore`                                                                                                                             |
| `canon claude sync`  | Reconciles `.gitignore` against the manifest. Reports seeded file status.                                                                                                        |
| `canon claude setup` | Installs user-level config to `~/.claude/` once per machine: statusline and the permissions allow and deny lists, and removes the empty attribution pair an earlier setup wrote. |

## CLAUDE.md

- It ships as a seed with placeholder project name, description, and key paths, to fill in after init.
- Its sections are `Context`, `Commands`, and `Key paths`. Each groups rules that share a surface, so skills can detect, extend, or skip by heading.
- The `Context` section points at `.claude/` state docs in one line. `plan-feature` does the parallel read when invoked, so the seed does not re-list every file.

## Seed docs

Seed docs ship with a guidelines preamble above the first H2. Claude internalizes those instructions before filling in the sections below, and they are not sections to populate.

## settings.json

The project and user files split what is project-specific from what is personal.

### Project seed

The seed at `tooling/claude/seeds/.claude/settings.json` ships hooks that pair with scripts under `.claude/hooks/`.

- Three PreToolUse hooks pair with `index-reminder.sh`, `search-reminder.sh`, and `scratch-guard.sh`.
- A PostToolUse hook pairs with `standards-audit.sh`.
- Project settings layer over user settings, so a project file carries only what is project-specific.

### Session defaults

The seed also sets two defaults every session in the target runs under.

- `permissions.deny` holds `Agent` and `Task`, so no session spawns a subagent. Parallel work runs as separate background sessions instead.
- `autoMemoryEnabled` is `false`. A person turns it back on for themselves in `settings.local.json`.
- `canon migrate session-defaults` adds both to a target seeded before them, since sync never rewrites an existing settings file.

### User template

The template at `tooling/claude/user/settings.template.json` is installed once per machine by `canon claude setup`.

- It allows `Bash(bun run *)` under `permissions.allow`.
- Its `permissions.deny` holds `Read(**/.env)` and `Read(**/.env.*)`, blocking accidental secret exposure across any project.
