---
title: Target migrations by verb
description: One-time moves a canon migrate verb runs, for a project scaffolded under an older toolkit, in the order canon migrate status lists them
category: Agent surface
---

# Target migrations by verb

Each section is a move a `canon migrate` verb runs once, for a project scaffolded before the change it names. Run `canon upgrade` first, then `canon migrate status --json` to list the moves still pending in the order to run them. A pending verb with no section here, such as `scratch-evidence` or `rename`, is in [migrate](../agents/migrate.md).

`canon:target-update` is the guided path through both, running the moves in that order once you approve its preview. The moves no verb runs are in [target migrations by hand](by-hand.md), and the recurring sync that follows is in [target sync](../target/sync.md).

## Move the records first, once

Gitignored session records, being the task board, plans, review reports, and scratch, moved from `.claude/` to `.canon/`. Run these from inside the project, and read the `ok` field of the `--json` record rather than the exit code.

```bash
canon tooling sync claude . --write
canon migrate records --json
canon migrate records --write --json
```

The first line takes the `.canon/` ignore entry. The second reports and the third applies, repointing files that cite a moved folder and deleting a `.gitignore` line `.canon/` covers, as `dropped`. A line naming an old path keeps it via `canon-keep-record-root` on that line or the nearest non-blank one above.

Then sweep the citations inside the records, which the verb above never reaches.

```bash
canon migrate record-tree --json
canon migrate record-tree --write --json
```

It covers `diagrams`, `memory`, `plans`, `proposals`, `review`, `tasks`, and `teach`. Read the report before `--write`. The record tree is untracked, and a wrong rewrite has no undo.

## Move the design board to `board/`, once

A pick round with no board named now drafts in `.canon/board/`, the folder Frameboard reads, rather than `.canon/canvas/`. Stop any `frameboard serve` on the old folder first.

```bash
canon migrate record-layout --json
canon migrate record-layout --write --json
```

A project holding both folders gets a collision, and neither moves. A `board` key in `design.toml` naming `.canon/canvas` stays as written, so update it by hand.

## Move rules off the flat layout, once

Installed rules moved from `.claude/rules/<subdir>/` to `.claude/rules/canon/<subdir>/`. On the flat layout `canon gov sync` exits 0 reporting `No governance surfaces found in target`, and `canon gov install` lands a second copy.

```bash
canon migrate rule-layout --json
canon migrate rule-layout --write --json
```

Run it once, ahead of `canon gov sync` or `canon gov install`.

## Rename the skill citations, once

Plugin skills dropped their `claude-` prefix, so `canon:claude-docs` is now `canon:context-fold`. Five drafters merged into `write-doc`, seven `draft-` skills took verb-first names, and four joined their family. No old name keeps a pointer, and `canon migrate skill-names --write` moves a project. <!-- canon-keep-retired -->

| Old name           | New name                                        |
| ------------------ | ----------------------------------------------- |
| `draft-doc`        | `write-doc` <!-- canon-keep-retired -->         |
| `draft-figure`     | `draw-figure` <!-- canon-keep-retired -->       |
| `draft-identity`   | `design-identity` <!-- canon-keep-retired -->   |
| `draft-slides`     | `make-deck` <!-- canon-keep-retired -->         |
| `draft-and-pick`   | `design-pick` <!-- canon-keep-retired -->       |
| `draft-ready`      | `plan-ready` <!-- canon-keep-retired -->        |
| `draft-screencast` | `script-screencast` <!-- canon-keep-retired --> |
| `pick-by-eye`      | `design-pick` <!-- canon-keep-retired -->       |
| `ui-record`        | `ui-film` <!-- canon-keep-retired -->           |
| `ux-audit`         | `ui-audit` <!-- canon-keep-retired -->          |
| `ux-measure`       | `ui-measure` <!-- canon-keep-retired -->        |

Replace a citation of a skill with no successor by hand, or delete the sentence.

- `canvas` is now `canvas-board`. The sweep rewrites only `canon:canvas` and `skills/canvas`, so replace a bare mention by hand. <!-- canon-keep-retired -->
- `draft-ready` is rewritten only as `canon:draft-ready` and `skills/draft-ready`, since bare it also describes a pull request, so replace a bare mention by hand. <!-- canon-keep-retired -->
- `design-extract` and `sketch-design` are replaced by `canon:canvas-board`. <!-- canon-keep-retired -->
- `review-branch`, `seed-sync`, `restate-plainly`, `bash-cli-script`, `canon-operator`, `canon-rollout`, and `canon-feedback-triage` have no successor <!-- canon-keep-retired -->
- `create-standard`, `markdown-propose`, `memory-review`, `project-commands`, `repo-metadata`, `ux-walkthrough`, and `plan-ready` have no successor <!-- canon-keep-retired -->

The `memory` record kind left `canon records`, so `canon records validate memory` refuses as an unknown kind and `canon records migrate` is gone.

- `canon repo metadata`, `canon autoship`, and the `120-bash` rule are gone, and `canon gov sync` removes the rule <!-- canon-keep-retired -->
- `memory-capture`, the `603-memory` rule, and the `memory` standard are gone, so send a lesson to the context entry that owns the fact <!-- canon-keep-retired -->

Two held files run, `.husky/post-merge` and `.claude/hooks/pr-create-log.sh`, and a stale copy calls a missing binary or names a removed skill. Resync what the toolkit owns before sweeping what the project wrote, and run the second line once per stack, naming a held hook with `--replace`.

```bash
canon gov sync
canon tooling sync <stack> . --write
canon migrate skill-names --json
canon migrate skill-names --write --json
```

## Move the surfaces off `.claude/`, once

`context/`, `wireframes/`, `ARCHITECTURE.md`, `REQUIREMENTS.md`, `DESIGN.md`, and the install stamp folder, now `canon/config/`, moved under `canon/`. `rules/`, `skills/`, `hooks/`, and `settings.json` stay where Claude Code reads them.

```bash
canon migrate surface-roots --json
canon migrate surface-roots --write --json
```

It moves each surface with `git mv` and repoints every tracked citation. No other command notices a surface left at `.claude/`.

## Deny subagents and merges, and turn auto memory off, once

The seeded `.claude/settings.json` now denies the `Agent` and `Task` tools and both merge commands, and sets `autoMemoryEnabled` to `false`. `canon claude sync` never rewrites a settings file you hold, so it warns while the file holds no default or lacks a merge entry. Removing `Agent` and `Task` later draws no warning.

The plan guard takes two steps. `canon claude init` adds the absent `.claude/hooks/plan-guard.sh`, and the verb below then wires it into `hooks.PreToolUse` for `Bash` and `Write|Edit`. It skips a tool whose matcher already runs the guard, and wires nothing while the script is absent.

```bash
canon migrate session-defaults --json
canon migrate session-defaults --write --json
```

The verb only adds a key that is absent. A person who wants auto memory back sets it in their own `.claude/settings.local.json`.

The verb adds `Bash(canon pr merge:*)` and `Bash(gh pr merge:*)` so a session cannot merge. A project migrated before them runs `--write` once more, which also restores `Agent` and `Task` for a person who removed them to allow subagents, so remove them again after.
