---
title: Record validator
description: The canon records validate kinds, why the board keeps its own verb, and root resolution per kind
---

# Record validator

## Decisions

### Why one verb covers the record folders

`canon records validate <kind>` extends the board validator's shape to the other gitignored session records, taking `plans`, `groundwork`, or `intake` as an argument. The folders share every property that makes them unreachable, so one verb over a kind argument beat a verb per folder. Memory, standards, and teach each arrived later as a kind.

`src/records/validate.ts` parses and checks while `src/commands/records.ts` renders, the split `tasks` uses.

### The board keeps its own verb

`.canon/tasks/` has every property above and keeps its own verb anyway. What separates it is the checks, not the corpus. A record kind reports where a file's shape and its standard disagree, while the board's seven checks read one table against itself or the rest of the tree.

- A row's cell count against its own table's header, and a row stranded behind a table a blank line already closed
- A `## Needs a plan` row's stated position against where it sits, and a row stating none
- A row mapping to a task file and back
- A task sitting in two readiness groups
- A `Plan:` pointer resolving

Two more checks cover `## Run now` rows touching a path in common, and a parked row whose cited task has closed or whose cited file nothing running still holds.

### Take a folder in by its checks

None of the board's checks has an analogue in a folder of independent records, so folding it in would add a kind sharing the reporting shell and no check. Take a later folder into `records` when its checks are per-record, and leave it out when they are relational.

### It reports and never writes

The board verb set the reasoning. A record folder is per-machine scratch with no history behind it, so a repair that guessed wrong could not be undone.

### Folders resolve from candidate lists

Each kind resolves a list of candidate folders rather than one path, and a `no-folder` message names every candidate. The four scratch kinds keep a single-entry list, so their message is unchanged.

`standards` was a tracked kind with its own filename check. It retired with the `canon standards` verb when each standard moved into an owner skill's `references/`.

### The teach kind

`teach` is the sixth kind and the third whose records are folders, joining `groundwork` and `intake` over a learning workspace at `.canon/teach/<nn>-<topic>/`. The three dispatch through `FOLDER_CHECK`, keyed by `Exclude<RecordKind, 'plans'>`, so a seventh kind fails to compile until it gets a walk or joins the exclusion.

### The workspace walk reads markdown only

It reads the root files, `reference/`, and `learning-records/`. `lessons/` and `assets/` are never reached, since a lesson is generated markup with no frontmatter and a walk would report every one as malformed. This is the first kind whose folder holds a shape the validator deliberately skips.

### The subfolder guard tests for a directory

Every other walk takes its path from `listFolders` and is a directory by construction. This one builds the path from a fixed name, so a workspace holding a plain file called `reference` would reach `readdir` and take the run down with `ENOTDIR` instead of reporting the finding.

### Root default

The `--root` default is the main worktree root for every kind, so every session validates one set of records.

### Nothing fires it automatically

That is the constraint the verb answers, not a gap. `.claude/hooks/standards-audit.sh` exits early on the scratch paths. Dropping the hook's exemption would audit a record mid-authoring, where the verb run when a session claims the record is done reads a finished state.

### Exit codes match the board verb

The codes are `0` clean, `1` refused, `2` findings. `VALIDATE_REFUSALS` carries `unknown-kind` beside `no-folder` though the walk never returns it, since both reach a caller through the `reason` field and a union covering only the walk would type a record the command emits as impossible.

### Three checks need a machine

Each keys on something a reader cannot run by eye.

- A groundwork track holding `06` without `07` reads as closed to anyone scanning filenames while the file a returning session opens is absent
- A plan question carries a suggestion with no answer slot
- An intake item carries `Open` with no `Suggested`

### The item scan skips two files

`00-overview.md` and `99-next-session.md` hold no items. Every overview opened before the standard stopped requiring the copy carries a fenced item-format block, so scanning it would report the template as a malformed item.

### Scans ignore fences

Every scan reads `linesOutsideFences` rather than the raw text, and a plan section closes on any marker-shaped line rather than a recognized one. Both fix one defect, a reader of markdown ignoring structure and reporting the document's examples as its content.

### `entry-unreasoned` calibration

Measured against the 178 archived plans, `entry-unreasoned` reads 5 against a naive scan's 80. The survivors are entries naming no file at all, which is what the rule is for.

### `stack-foldable` reads across files

It is the only plans finding that reads across files. The command layer appends it to the `plans` report from the live folder, so the per-folder walks stay free of it. Calibration is 15 reporting pairs of 87 stack pairs over 1,043 plans.
