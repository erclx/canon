---
title: Records
description: The two roots a record folder resolves at, migrating a record a frontmatter change orphaned, claiming the ordinal intake and groundwork share, reading each folder's size and growth, pruning stale scratch, and where validation, the memory review queue, and the private-remote backup are described
---

# Records

## Record roots

Every verb here resolves a record folder at two roots rather than one. `.canon/<folder>` is read first, `.claude/<folder>` second, and a folder neither root carries resolves to the creation default, which is `.canon/`. The scratch folder is the one name that differs by root, spelled `.canon/tmp` and `.claude/.tmp`, since inside a dotted root the leading dot hides nothing already hidden. <!-- canon-keep-record-root -->

The read order and the creation default agree. While the record folders were moving to a root of their own, creation stayed at `.claude/` so no record landed under a root whose ignore line had yet to reach a project. The ignore line ships now, so a fresh project scaffolds `.canon/` alone, and `.claude/` stays as a read fallback for a project the move has not reached.

A caller never spells a record root by hand for the same reason. A path written as `.canon/plans/...` resolves against one root and reports nothing when it is wrong, which is the quiet failure this ordering exists to prevent: a stale binary meeting a moved layout, writing to the old path, and reporting success. Read a folder through the verb that owns it, and where a skill needs the path itself, take it from that verb's record rather than composing one.

A refusal names every root it looked at, so a message reading `no-folder` says where a write would land as well as where the read failed.

## Validate

`canon records validate <kind>` reports where a record folder or the standards corpus disagrees with the standard governing it. Its flags, the per-kind checks, and the refusals are in `records-validate.md`.

## Migrate

`canon records migrate <kind>` rewrites the records a `validate` finding names a transform for. A standard that redefines its own required frontmatter breaks every record already written to the old shape, and this is the repair `validate` could only report until now.

```bash
canon records migrate memory
canon records migrate memory --write
canon records migrate memory --json
```

| Option          | Behavior                                                            |
| --------------- | ------------------------------------------------------------------- |
| `--json`        | Add a machine-readable record on stdout                             |
| `--write`       | Rewrite every record a transform can repair                         |
| `--root <path>` | Project root, defaulting to the main worktree except on `standards` |

It writes nothing until `--write` is passed, matching the write-flag contract `canon tooling sync` carries: a session record has no history to undo a wrong repair from, so naming a kind is not consent to rewrite every record inside it. A dry run reports which records it would touch and exits non-zero either way, headless or not, since there is nothing to prompt for.

A transform runs only where the missing value is recoverable from the file itself. The one shipped today repairs a memory record missing `category` alone, deriving it from the same filename prefix `checkMemory` already reads it from. `title` and `description` are prose nobody wrote down, so a finding naming either carries no transform and stays for a session to fix by hand, and `validate` keeps reporting it. The transform re-reads the file rather than trusting a value captured at validate time, so a check and its repair cannot disagree about the same record.

Exit codes: `0` nothing carried a known transform, or `--write` repaired everything it found. `1` refused for a reason `validate` shares, every candidate it found failed to repair, or `--write` repaired only some of them. `2` a record carries a known transform and `--write` was not passed.

## Ordinal

`canon records ordinal <kind> <slug>` reports the next ordinal `intake` and `groundwork` share, or claims it with `--claim`. The two kinds share one sequence, per `standards/intake.md` and `standards/groundwork.md`, so this reads both `.canon/intake/` and `.canon/groundwork/` regardless of which kind was asked for.

```bash
canon records ordinal intake my-topic
canon records ordinal groundwork my-topic --claim
canon records ordinal groundwork my-topic --claim --json
```

| Option          | Behavior                                               |
| --------------- | ------------------------------------------------------ |
| `--json`        | Add a machine-readable record on stdout                |
| `--claim`       | Create the folder atomically instead of only reporting |
| `--root <path>` | Project root, defaulting to the main worktree          |

Without `--claim` this only reports, so two sessions reading at once can still report the same number, which is what let two sessions open two different record folders under one ordinal on the same day. `--claim` closes that: it reserves the number at a path both an `intake` claim and a `groundwork` claim resolve to identically, whichever kind is asking, and only creates the kind's own `<nn>-<slug>/` folder once that reservation is won. A losing reservation is retried against a freshly read ordinal rather than reported as a collision, bounded to five attempts before refusing as `ordinal-contended`.

Exit codes: `0` reported the next ordinal, or `--claim` created the folder. `1` refused, `unknown-kind` when the argument names neither `intake` nor `groundwork`. `2` `--claim` lost every retry to a collision.

## Size

`canon records size` reports what each record folder holds and how much of it is recent. It reads the same backed folders push carries, resolved the same way, plus the scratch folder, and it gates nothing.

```bash
canon records size
canon records size --json
```

| Option          | Behavior                                      |
| --------------- | --------------------------------------------- |
| `--json`        | Add a machine-readable record on stdout       |
| `--root <path>` | Project root, defaulting to the main worktree |

The table carries one row per folder that exists, heaviest first, with the file count, the bytes, a count for each growth window, and the dates of the least and most recently written file. Those dates render in the machine's local time, which is the calendar day whoever wrote the file was living in, and the reading is per-machine already. Folders that do not exist are named on one line below it rather than printed as rows of zeros. At the legacy `.claude` root, the record a `--json` call emits carries every folder in the fixed list either way, each with a `present` flag, so a caller reading the record gets a stable set of keys and can tell an absent folder from one the reading skipped. At a `.canon` root, the folder set is read off the directory itself rather than off a fixed list, so an absent folder is not listed at all: nothing enumerates a name nobody has created yet.

Ordering by weight is what makes the reading worth taking. A folder listed alphabetically hides behind its neighbors, and the row a reader came for is the one that grew.

The reading carries two windows rather than one, at 7 and 30 days. A single window cannot separate a folder growing steadily from one that took a single batch: a folder whose 7-day count is most of its 30-day count moved in one pass, and one where the two are proportional is growing at a rate.

Nothing fails on a number here. A record folder has no correct size, so the reading is a number to notice rather than a threshold to gate, and the point of the verb is that the next reading is taken by a command instead of by someone remembering to count the folder. The memory pen went from 44 entries to 236 between two readings taken by hand two weeks apart, which is the measurement this replaces.

The scratch folder is read here and skipped by a backup, because deletable without loss is not the same as empty. The routing handoffs and the memory archive both sit there and both accumulate. `.canon/.records.git` stays out because it is the backup history rather than a record, and `.claude/worktrees/` stays out because each entry is a checkout of the project with its own removal verb, and one of them outweighs every record folder combined.

The window counts read `mtime`, so what they report is a file written inside the window rather than one created there. An entry edited long after it landed reads as recent, which overstates growth and never understates it, and these folders are append-mostly so the two readings agree on nearly every file. The one reading that is wrong rather than early is a machine restored by `canon records pull`, which resets the work tree hard and re-dates every file it writes, so a window taken there counts the restore. Nothing on the filesystem separates the two, since a restored file is new by every stamp it carries.

Exit codes: `0` the reading completed, `1` refused. The one refusal is `no-folder`, raised when the project holds neither record root. A project holding a root and no records is empty rather than absent: at the legacy `.claude` root each folder's own `present` flag says which ones it carries, and at a `.canon` root the folder list itself is already the answer, since nothing absent is named.

## Prune

`canon records prune-tmp` reports scratch nobody has touched inside an age window, and deletes it only with `--write`. Nothing removed an abandoned scratch folder before this, so a spike folder from months ago sat beside the ones a session still needs.

```bash
canon records prune-tmp
canon records prune-tmp --write
canon records prune-tmp --older-than 30 --json
```

| Option                | Behavior                                                       |
| --------------------- | -------------------------------------------------------------- |
| `--json`              | Add a machine-readable record on stdout                        |
| `--write`             | Delete every candidate the report lists                        |
| `--older-than <days>` | Age a unit's newest file must clear to be offered (default 14) |
| `--root <path>`       | Project root, defaulting to the main worktree                  |

A candidate is a unit whose newest file is older than the threshold: a `tmp/<slug>/` folder, a folder one level inside `runs/`, `render/`, or `pr/`, or a single marker file inside `hooks/<hook>/`. `pr/review/` groups its body files by pull request number rather than reporting as one folder, since a review pass leaves one file per pass and a folder holding thousands of them would otherwise report as a single row nobody can prune apart. A unit holding no files, empty subfolders included, is offered whatever its age.

`tmp/handoff/` and `tmp/pr/poll/` are never offered. A reader deletes a handoff themselves once it has been read, and a poll baseline is live state rather than scratch. The pre-split names the reserved split replaced, `memory-routing/`, `teach-promotion/`, `ui-checklist/`, and `pr-poll/` at the scratch root, are skipped the same way on a project the rename never reached, naming the folder they moved to, rather than being offered as ordinary slugs. An unread handoff is the one thing a wrong delete here loses for good.

A scratch-root name `canon migrate record-layout` or `canon migrate scratch-evidence` moves out of scratch for good, such as `memory-archive`, is skipped the same way on a project that has not yet run that migration, naming the verb to run. The retired-entry archive `memory-archive` holds is never deleted, per the memory standard, so it stays skipped rather than aging into an offer.

It writes nothing until `--write` is passed, matching `canon records migrate`: a session record has no history to undo a wrong delete from. It reads `mtime` the way `canon records size` does, so a machine restored by `canon records pull` reads its whole tree as new and fails safe by offering nothing.

Exit codes: `0` nothing to prune, or `--write` deleted every candidate. `1` refused, sharing `no-folder` with `size`, or a delete failed. `2` candidates exist and `--write` was not passed.

## Stale

`canon records stale memory` reports which memory entries are due for review and which cite a path the tree no longer holds, ordered so a review takes the first N as a batch. What makes an entry due, how a cited path resolves, and the refusals are in `records-stale.md`.

## Push and pull

`canon records push` backs the record folders to a private remote and `canon records pull` restores them. The payload, the setup, and the refusals are in `records-push.md`.
