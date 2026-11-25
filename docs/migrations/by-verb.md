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

A project holding both folders gets a collision, and neither moves.

## Move rules off the flat layout, once

Installed rules moved from `.claude/rules/<subdir>/` to `.claude/rules/canon/<subdir>/`. On the flat layout `canon gov sync` exits 0 reporting `No governance surfaces found in target`, and `canon gov install` lands a second copy.

```bash
canon migrate rule-layout --json
canon migrate rule-layout --write --json
```

Run it once, ahead of `canon gov sync` or `canon gov install`.

## Rename the skill citations, once

Plugin skills took new names, and no old name keeps a pointer. [Skill renames](skill-names.md) lists each old name and its successor, and the ones with none.

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

## Merge the app config into one file, once

One app's settings sat in up to five files under `canon/config/`. They now sit as tables of `canon/config/app.toml`, being `[drive]`, `[preview]`, `[health]`, `[painted]`, and `[device-classes]`.

```bash
canon migrate app-config --json
canon migrate app-config --write --json
```

The verb keeps each TOML comment beside its key and writes a JSON file out as TOML. Three keys change spelling. `health` becomes `paths` under `[health]`, and `painted`, `unpainted`, and `reelInputs` become `paths`, `exclude`, and `reel-inputs` under `[painted]`. A drive target moves from `[targets.<name>]` to `[drive.targets.<name>]`.

- It refuses when a file does not parse or `app.toml` already holds a table whose old file still exists, so merge that pair by hand
- It lists each tracked line still naming an old file and rewrites none, since the wording usually names a key the move changed
- The readers still fall back to an old file until a later release retires it, and `canon migrate status` lists a project that has not moved
- `design.toml` and `tasks.toml` under `canon/config/` are no longer read. A round draws on `.canon/board/`, and a board can no longer require an `Approved:` line on every plan.
- `canon tasks plan-answers` and `canon tasks launchable` no longer refuse as `unapproved` or `bad-config`, so a caller matching either reason never sees it

## Deny subagents and merges, and turn auto memory off, once

The seeded `.claude/settings.json` denies `Agent`, `Task`, and the `gh` merge forms, and sets `autoMemoryEnabled` to `false`. `canon claude sync` never rewrites a settings file you hold, so it warns while the file holds no default or lacks a merge entry. Removing `Agent` and `Task` later draws no warning.

A seeded hook takes two steps. `canon claude init` adds each absent script under `.claude/hooks/`, and the verb below wires it where the seeded settings put it. It skips a tool whose matcher already runs the script, and wires nothing for a script you deleted. Until then, `canon sync --check --exit-code` fails.

```bash
canon migrate session-defaults --json
canon migrate session-defaults --write --json
```

The verb only adds a key or entry that is absent, so a project migrated before an entry runs `--write` once more.

- A person who wants auto memory back sets it in their own `.claude/settings.local.json`
- `Bash(gh pr merge:*)` and `Bash(gh api *pulls/*/merge*)` stop the merge forms that skip `canon pr merge`
- An older `canon pr merge` ask or deny stays, since the verb never removes one. Sync names it until you delete it, since an ask prompts on every merge and a deny blocks one you named.
- A rerun restores `Agent` and `Task` for a person who removed them to allow subagents, so remove them again after

The allow entries let a session run a command without waiting on a prompt, and each is as narrow as its caller needs.

- `git push --force-with-lease` and its `origin HEAD` form are allowed exactly, so a worker pushes after a rebase without waiting
- Any other lease push still goes through auto mode's review, and `canon claude sync` warns while either entry is missing
- `canon drive` and the `canon pr` verbs a UI pass runs are allowed by subcommand, being `head`, `checks`, `evidence`, `local`, `drive-copy`, `frames`, `tick`, and `lift`
- `canon browser`, `canon pr close`, `canon pr preview`, and any delete still prompt or go through auto mode's review, and a browser install or `canon pr frames --drop` or `--prune` is denied
- A rerun restores a UI pass entry you removed, so remove it again after, or add a deny for it, which wins over the allow
