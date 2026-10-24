---
title: Target sync
description: Check what drifted in a toolkit-managed project and pull it in, per domain or all at once
category: Agent surface
---

# Target sync

A target pulls toolkit changes per domain, through one catch-all and several targeted entry points. A project scaffolded before a layout move runs [target migrations](migrations.md) first. See [install and sync](../agents/install-and-sync.md) for what each verb writes.

## Check first

`canon sync --check <path>` reports drift without writing, split by cause. `canon:target-check` groups the same state by domain and repairs nothing. `canon:target-update` is the guided path, previewing the drift and then applying it on your go-ahead.

The report opens with the binary version against the newest published one, and a version behind means run `canon upgrade` first.

| Cause             | Meaning                                     | Action                                   |
| ----------------- | ------------------------------------------- | ---------------------------------------- |
| `stale`           | Matches what the toolkit installed          | Take the update                          |
| `customized`      | Carries local edits                         | Decide by hand against the toolkit       |
| `stranded`        | Sits where an older toolkit installed it    | Relocate by hand                         |
| `retired`         | A rule the toolkit no longer ships          | `canon gov sync` deletes it              |
| `renamed`         | A rule shipped under a new name             | `canon gov sync` installs the new one    |
| `seeds`           | A seed the project edited                   | Merge by hand                            |
| `unmovedSurfaces` | A surface still at its `.claude/` spelling  | `canon migrate surface-roots`            |
| `newRules`        | A rule your stack ships that you lack       | `canon gov install <stack> --add <rule>` |
| `reverse`         | A folder at a path the toolkit once shipped | Read its verdict below                   |

Attribution reads `canon/config/config.json`, falling back to `.claude/canon/config.json`. Without a stamp the report reads the toolkit's git history, which needs a clone. `newRules` installs nothing, and a target on a retired stack such as `react` or `astro` runs `canon gov detect . --stack node --json` for the rules its manifests propose.

`reverse` marks each folder:

- `dropped` is the toolkit's copy, with the publishing commit
- `unattributed` means the toolkit shipped the path, but the content matches no published version
- `project` means it only shares a retired name

Add `--json` for a machine-readable report and `--exit-code` to fail CI when a target falls behind. Project-authored files, superseded artifacts, seed drift, tooling, and `reverse` never count toward that code, and an unmigrated domain does.

## Catch-all

`canon sync <path>` runs every installed domain's sync and never touches user-owned seeds.

## Targeted

- Seed docs such as `CLAUDE.md` and `canon/REQUIREMENTS.md`: merge by hand, keeping the project's customizations
- Installed governance rules: `canon gov sync <path>`, which adds no new rules and reports coverage afterward
- Tooling configs and seeds: read differences with `canon tooling diff <stack> <path>`, then `canon tooling sync <stack> <path> --write`, which holds an edited config and copies each seed once
- Tooling dependencies: a dependency on a later major than the stack pins reads as `ahead`, and sync leaves it
- Index regeneration: `canon indexes regen`

After `canon gov sync` applies, it lists each rule it copied with its globs and how many project files match. A `ui/` rule adds a pointer to `/canon:ux-audit`. `--json` writes `{ "coverage": [{ "rule", "paths", "files", "ui" }] }` to stdout, empty when nothing was copied, with `files` null outside git. The report never changes the exit code.

Try a scenario from [sandbox](../../canon/context/development/sandbox.md) before syncing a real project.

### Held, declined, and customized golden files

`--write` replaces a golden config only when canon changed it and the project did not. A config the project edited, or one no earlier write recorded, is held and listed with a `--replace` command that takes the golden copy. A config from a stack the target never synced is a first install and is never held.

A project can also opt out of one golden file without leaving the stack. Each verb below takes the path relative to the target, as `canon tooling diff` lists it.

```bash
canon tooling decline .github/workflows/readme-screenshot.yml --reason "no screenshots here"
canon tooling customize e2e/screenshot.ts
canon tooling lift .github/workflows/readme-screenshot.yml
```

- `decline` keeps sync and inject from writing the file again, and leaves a copy the project still holds in place
- `customize` keeps the project's copy of a config through every write, and `diff` exits 1 once the stack ships a newer golden copy
- A seed cannot be customized, since sync never overwrites one, and the starter `e2e/home.spec.ts` is one
- `lift` hands the file back, so the next sync writes it

These verbs are the only writers of the record in `canon/config/config.json`, so never edit it there by hand.

## Running sync from an agent session

`canon sync .` applies every domain sync, then offers a commit and pull request that needs a terminal. With no terminal on stdin the syncs apply, the git step is refused, and the command exits 0. Commit yourself. Sync refuses a dirty working tree, and `canon sync --check .` does not.
