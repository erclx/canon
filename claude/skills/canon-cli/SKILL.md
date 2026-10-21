---
name: canon-cli
description: Routes a job to the `canon` verb that does it, and warns which verbs can lose a project's edits before one runs. Use when asked "which canon command does X", "is there a verb for X", "which command tells me if X", "will this overwrite my changes", or before running `canon sync`, `canon gov sync`, `canon tooling sync`, `canon design sync`, `canon migrate`, or `canon indexes regen`. Do NOT use to execute a verb, only to pick one and know what it costs.
metadata:
  family: answer
---

# Toolkit CLI router

Consult to pick the `canon` verb for a job, and before running a verb that writes. This skill is reference only. It never runs a verb.

## Find the verb

- Each row below names a verb by its job. Subcommands and flags are not listed here, so read them where they are kept.
- Run `canon <verb> --help --all` for a verb's subcommands and every flag in one read, where `canon <verb> --help` alone stops at the subcommand list.
- Read `canon <verb> --help --all` before running a verb no skill body spells out. A verb a skill gives in full runs as that skill wrote it.
- Run `canon docs agents` for the invocation contract behind every verb, and `canon docs list` for every other reference doc, then `canon docs <topic>` by name.

## Project setup

| Job                                          | Verb                   |
| -------------------------------------------- | ---------------------- |
| Bootstrap a project with toolkit domains     | `canon init`           |
| Bring every installed domain current         | `canon sync`           |
| Reinstall the CLI itself                     | `canon upgrade`        |
| Move a project off a retired name or layout  | `canon migrate`        |
| Read what a project still needs to migrate   | `canon migrate status` |
| Read the releases since a target's install   | `canon changelog`      |
| List the projects the toolkit installed into | `canon targets`        |

## Domains

| Job                                                             | Verb            |
| --------------------------------------------------------------- | --------------- |
| Install or sync governance rules                                | `canon gov`     |
| Sync a tooling stack's configs and seeds, or read its reference | `canon tooling` |
| Set up or sync the Claude workflow                              | `canon claude`  |
| Regenerate the `index.md` files                                 | `canon indexes` |
| Read a toolkit reference doc                                    | `canon docs`    |

## Author and render

Each verb here has a skill that owns the job. Load the skill rather than driving the verb by hand.

| Job                                          | Verb                | Skill                       |
| -------------------------------------------- | ------------------- | --------------------------- |
| Render the design system                     | `canon design`      | `canon:draw-figure`         |
| Render a slide deck                          | `canon slides`      | `canon:make-deck`           |
| Render an HTML source to a PNG               | `canon capture`     | `canon:design-identity`     |
| Serve a directory and print the link         | `canon serve`       | none                        |
| Record a running app                         | `canon demo`        | `canon:script-screencast`   |
| Report one computed property across routes   | `canon inventory`   | `canon:target-check`        |
| Walk a page through interactions and measure | `canon drive`       | `canon:ux-measure`          |
| Fetch a YouTube transcript                   | `canon transcripts` | `canon:youtube-transcripts` |
| Open a learning workspace                    | `canon teach`       | `canon:teach-workspace`     |
| Work on the local canvas                     | `canon canvas`      | `canon:canvas-board`        |

## Session and ship

| Job                                            | Verb              |
| ---------------------------------------------- | ----------------- |
| Read and close tasks on the board              | `canon tasks`     |
| Read and answer intake folders                 | `canon intake`    |
| Validate, size, and move session records       | `canon records`   |
| Resolve live sessions to a worktree and branch | `canon sessions`  |
| Reclaim worktrees whose branches merged        | `canon worktrees` |
| Read a pull request                            | `canon pr`        |
| File toolkit feedback as an issue              | `canon feedback`  |

## Reports

| Job                                       | Verb             |
| ----------------------------------------- | ---------------- |
| Scan the tree for credentials             | `canon secrets`  |
| Read the dependency set for advisories    | `canon deps`     |
| Check a changed set against the label map | `canon labels`   |
| Measure comment density                   | `canon comments` |
| Report context folder health              | `canon context`  |
| Check markdown against the standards      | `canon markdown` |
| Count files, extensions, and lines        | `canon census`   |

## Verbs that can lose your edits

Read the doc each line names before running one of these. `canon docs install-and-sync` covers the governance and design verbs, `canon docs sync` covers tooling, `canon docs indexes` covers regeneration, and `canon docs migrate` covers the migrate verbs. Run the `--check` or `--dry-run` form first where the verb has one.

- `canon sync` runs every installed domain's sync, so it carries each risk below.
- `canon gov sync` replaces a rule you edited and deletes a rule the toolkit retired, edited or not.
- `canon tooling sync --write` replaces every golden config a stack ships. Seeds are copy-once. Nothing writes without the flag. See `canon docs sync`.

### Design, migrate, and indexes

Three more verbs rewrite files in place.

- `canon design sync` replaces the shipped design files and leaves `.claude/design/project/` alone.
- `canon migrate --write` rewrites files that cite a retired name or layout. It reports and writes nothing without the flag. See `canon docs migrate`.
- `canon indexes regen` rewrites each generated `index.md` from the folder's current state, so a hand edit there is lost. See `canon docs indexes`.

`CLAUDE.md` and the other seed docs are copy-once, and no sync updates them. Merge those by hand against the toolkit copy.

## Source of truth

- `canon docs install-and-sync` states what each install and sync verb writes, refuses, or leaves alone
- `canon docs indexes` and `canon docs migrate` state the same for their verbs
- When a doc and this skill disagree, the doc wins
