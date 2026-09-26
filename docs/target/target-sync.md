---
title: Target sync
description: Check what drifted in a toolkit-managed project and pull it in, per domain or all at once
category: Agent surface
---

# Target sync

When the toolkit updates, a target project pulls changes per domain. There is one catch-all and several targeted entry points. A project scaffolded before a layout move runs the one-time moves in [target migrations](target-migrations.md) first.

## Check first

`canon sync --check <path>` reports what has drifted without writing anything. It splits each difference by cause, which is the question that decides what to do next.

`canon:target-check` is the same reading grouped by domain rather than by cause, run from inside the project. It reports the toolkit version, the `canon/` folder, governance rules, tooling, and seeds from the verbs that own each comparison, and reports the Claude harness as unchecked because no verb reads it. It repairs nothing, so it is what to run before deciding rather than instead of deciding.

### The binary first

The report opens by naming the binary running it. The installed version reads against the newest published one, and a version behind that points you at `canon upgrade`, since every section under it is a reading taken by whichever toolkit you happen to have. An unreachable registry reports unknown with its reason rather than failing, so `--exit-code` still gates on the drift the check measured locally and an offline machine stays green.

### Then the causes

A `stale` file still matches what the toolkit installed, so the update is mechanical. A `customized` file carries local edits, so taking the upstream version is a decision and `canon:seed-sync` is the tool for it. A `stranded` file sits where an older toolkit installed it and the toolkit has since moved, which is a relocation the report names but no command runs. A `retired` rule is one under `.claude/rules/canon/` the toolkit no longer ships, and the next `canon gov sync` deletes it. A `renamed` rule is one the toolkit now ships under a new name, and the next sync installs the new name and deletes the old file.

That attribution comes from `canon/config/config.json`, which every install and sync now writes, falling back to `.claude/canon/config.json` for a target stamped before that move. A target stamped before that path shipped is read from the retired `.claude/canon.json` instead, reported rather than migrated. Governance records a hash per installed file, plus the stack `canon gov install` was given, and tooling records the stack chain it resolved instead of any file hash, since its install runs no per-file walk to attribute.

Each domain holds its own toolkit commit, so syncing governance today does not move the revision tooling measures against, and each domain reports the upstream commits touching its own source path. Running any sync stamps that domain, and the report names the ones still unstamped.

A project that has never synced under a toolkit new enough to write a stamp falls back to the toolkit's own git history. Installed content matching any version that history published proves the file untouched, so it reports `stale` naming the commit it came from, and content matching no published version stays `drifted`. That fallback needs the toolkit as a git checkout. Installed from the registry it ships source without history, and the report says attribution was unavailable rather than reading every file as a local edit.

Further causes sit outside the per-domain scan, each naming something that walk cannot see. A seed the project edited is reported under `seeds` and reconciled with `canon:seed-sync`, since no sync command touches a seed. A file a newer seed folder replaced is reported under `superseded`, such as `.claude/TASKS.md` against the `.canon/tasks/` that now ships, and nothing moves it because the content is the project's own. A domain sitting at the root layout with nothing under `.claude/` is reported under `unmigrated`, and no command moves it either. The project moves the content itself.

`unmigrated` currently names no domain, since standards and snippets are the two the toolkit ever installed at the project root and both closed their install channel. A target still holding a root `standards/` or `snippets/` folder from an older toolkit is carrying its own authoring surface now, not an unfinished install, and nothing proposes moving either.

### Rules you never received

A sync refreshes the files you already hold and adds none, so your rule set is frozen at the date you installed governance while every file in it reports as current. `newRules` names a rule you could receive that your tree does not hold, which is the one section that reads your absence rather than your contents. `canon gov sync` reports the same rules per file, marked `missing`, so you see them either way you check.

Take a clean section as reporting rather than as delivering. Nothing here installs, and it counts toward nothing, so pick the rules up with `canon gov install <stack>` or take one with `--add <rule>`. That separation is deliberate: adopting a rule changes what your project is governed by, which is a choice a sync has no business making for you.

Since `canon gov install` records the stack you gave it, the list is read by comparing that stack's current rules against what you hold right now, with no date involved at all. That is what lets it name a rule the toolkit shipped before you last synced: nothing here depends on when you installed. A target stamped before this recording shipped falls back to the older read below.

The fallback filters to what your stack can receive, read off the rule folders you already carry plus the folders the base stack takes whole. A rule under `lang/` or `ui/` belongs to some stacks and not others, so an unfiltered list would name rules you can never install. A target with neither a recorded stack nor a governance anchor reports nothing at all, since there is no date to measure against either.

In the fallback, an empty section is not proof either way when the toolkit running the check is not a full git clone. The read needs history to reach your anchor, and an install from the registry ships none, so the section goes quiet rather than saying it could not measure. Run the check from a clone before reading a clean result as a complete one. The stack-based read above is untouched by this, since it consults no history.

This also closes the case where a rule arrives citing a sibling you do not have. A sync refreshing a rule can land a version pointing at a file it never installs, and the section names the missing sibling rather than the broken citation, which is enough to act on.

### What the toolkit stopped shipping

The last cause runs backwards. Every one above starts from what the toolkit ships and asks whether the target matches, so a folder the toolkit dropped appears in none of them. `reverse` walks the target instead and reports a folder sitting at a top-level path the toolkit once shipped and has since deleted.

Each entry carries a verdict, since a dropped folder and one the project wrote are the same bytes at the same path.

- `dropped` names the commit that published the content
- `unattributed` means the toolkit shipped that path and the content matches no version it published
- `project` means the folder only shares a retired name

Nothing acts on any of them, and the verdict is what makes the list safe to read.

Add `--json` for the machine-readable report, and `--exit-code` to fail a CI job when a target falls behind. Files the project authored itself never count toward that exit code, and neither do superseded artifacts, seed drift, tooling, or anything the reverse walk reports, since each names content the project is expected to edit or place itself. An unmigrated domain does count, because running the relocation closes it.

Tooling reports under a section of its own, and `measured` there says whether the target ever recorded a chain. One that never ran a tooling sync reports unmeasured rather than clean, which is what separates tooling nobody has looked at from tooling that is current. A workspace root records nothing either way, since each package resolves its own chain.

Reconcile the configs with `canon tooling diff <stack> <path>` to read which files differ, then run `canon tooling sync <stack> <path> --write` to apply them. The drift report counts categories and the diff names paths, which is the difference worth knowing before a golden config the project edited is replaced.

## Catch-all

`canon sync <path>` runs every installed domain's sync in sequence. Safe to run on a cadence.

It never touches user-owned seed files. Governance rules in `.claude/rules/` and tooling configs refresh in place. Stale `.claude/GOV.md` from earlier installs is removed.

Standards take no part in that run. Nothing installed them, so there is no copy to reconcile and no `canon standards sync` to reach for.

## Targeted

- Claude seed docs such as `CLAUDE.md` and `canon/REQUIREMENTS.md`: invoke `canon:seed-sync`. The skill splits each file into a preamble (between the H1 and the first H2) plus one part per `##` section, then diffs part by part and proposes per-part edits. User customizations are preserved.
- Governance rules already installed: `canon gov sync <path>` diffs and applies, and never adds new rules. A rule your recorded stack lists reports as `missing` instead.
- Tooling configs and seeds: `canon tooling <stack> <path>` overwrites golden configs and merges seeds
- Reference docs for a stack: `canon tooling reference <stack>` reads and never writes, so there is nothing to sync
- Index regeneration after markdown edits: `canon indexes regen`

Use a targeted entry point when only one surface moved upstream. Use the catch-all when the toolkit lands a bundled release.

## Verify a sync

Before running a sync against a real project, run the relevant sandbox scenario. The sandbox provisions a representative project state and routes `SANDBOX_SCENARIO=sync` through the domain flow. See [sandbox](../../canon/context/sandbox/index.md) for the scenario catalog and routing patterns.

## Running sync from an agent session

`canon sync .` applies every installed domain sync, then offers to commit the result and open a pull request. That last step needs a terminal. Under `CANON_NON_INTERACTIVE=1`, which is how an agent runs it, the domain syncs still apply and the git workflow is refused: the command reports the branch and commit it would have created, writes nothing to git, and exits 0. Review the working tree and commit it yourself, or rerun interactively to reach the commit and pull request options.

Sync also refuses a target whose working tree is dirty, so commit or stash before running it. `canon sync --check .` has neither restriction, since it writes nothing.
