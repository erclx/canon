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
- Installed governance rules: `canon gov sync <path>`, which adds no new rules
- Tooling configs and seeds: read differences with `canon tooling diff <stack> <path>`, then `canon tooling sync <stack> <path> --write`, which overwrites golden configs and copies each seed once
- Index regeneration: `canon indexes regen`

Try a scenario from [sandbox](../../canon/context/development/sandbox.md) before syncing a real project.

## Running sync from an agent session

`canon sync .` applies every domain sync, then offers a commit and pull request that needs a terminal. Under `CANON_NON_INTERACTIVE=1` the syncs apply, the git step is refused, and the command exits 0. Commit yourself. Sync refuses a dirty working tree, and `canon sync --check .` does not.
