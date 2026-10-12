---
title: Record validator
description: The canon records validate kinds, why the board keeps its own verb, and root resolution per kind
---

# Record validator

- `canon records validate <kind>` extends the board validator's shape to the other gitignored session records, taking `plans`, `groundwork`, or `intake` as an argument rather than shipping a verb per folder. The folders share every property that makes them unreachable, so one verb over a kind argument was chosen over four siblings, and memory, standards, and teach each arrived later as a kind rather than as a command.
- `src/records/validate.ts` parses and checks while `src/commands/records.ts` renders, the split `tasks` already uses
- `.canon/tasks/` is a fifth folder with every property the reason above names, and it keeps its own verb anyway. What separates it is the checks rather than the corpus. A record kind reads a file or a folder and reports where its shape and its standard disagree, while the board's seven checks read one table against itself or against the rest of the tree:
  - a row's cell count against its own table's header, and a row stranded behind a table a blank line already closed
  - a `## Needs a plan` row's stated position against where it actually sits, and a row stating no position at all
  - a row mapping to a task file and back
  - a task sitting in two readiness groups
  - a `Plan:` pointer resolving
  - two `## Run now` rows touching a path in common
  - a parked row whose cited task has closed, or whose cited file nothing running still holds
- None of those has an analogue in a folder of independent records, so folding the board in would have added a kind sharing the reporting shell and no check. Take a later folder into `records` when its checks are per-record, and leave it out when they are relational.
- It reports and never writes, on the reasoning the board verb established. A record folder is per-machine scratch with no history behind it, so a repair that guessed wrong could not be undone.
- `standards` was a tracked kind with its own filename check, and it retired with the `canon standards` verb when each standard moved into an owner skill's `references/`.
- Each kind resolves a list of candidate folders rather than one path, and a `no-folder` message names every candidate. The four scratch kinds keep a single-entry list, so their message is unchanged.
- `teach` is the sixth kind and the third whose records are folders rather than files, joining `groundwork` and `intake` over a learning workspace at `.canon/teach/<nn>-<topic>/`. The three dispatch through `FOLDER_CHECK`, a lookup keyed by `Exclude<RecordKind, 'plans'>`, so a seventh kind fails to compile until it is either given a walk or added to the exclusion.
- The workspace walk reads the markdown half alone, being the root files, `reference/`, and `learning-records/`. `lessons/` and `assets/` are never reached, since a lesson is generated markup carrying no frontmatter and a walk over it would report every one as malformed. That is the first kind whose folder holds a shape the validator deliberately does not read.
- Its subfolder guard tests for a directory rather than for presence. Every other walk here takes its path from `listFolders` and is a directory by construction, while this one builds the path from a fixed name, so a workspace holding a plain file called `reference` would reach `readdir` and take the whole run down with `ENOTDIR` in place of the finding the verb exists to report.
- The `--root` default is the main worktree root for every kind, so every session validates one set of records.
- Nothing fires it automatically, and that is the constraint the verb exists to answer rather than a gap in it. `.claude/hooks/standards-audit.sh` exits early on the scratch paths. Dropping the hook's exemption is the alternative and it audits a record mid-authoring, where the verb this session runs when it claims the record is done reads a finished state instead.
- Exit codes match the board verb at `0` clean, `1` refused, `2` findings. `VALIDATE_REFUSALS` carries `unknown-kind` alongside `no-folder` even though the walk never returns it, since both reach a caller through the same `reason` field and a union covering only the walk would type a record the command emits as impossible.
- Three checks key on something a reader cannot run by eye: a groundwork track holding `06` without `07`, which reads as closed to anyone scanning filenames while the file a returning session opens is absent, a plan question carrying a suggestion with no answer slot, and an intake item carrying `Open` with no `Suggested`.
- The item scan skips `00-overview.md` and `99-next-session.md`. Neither holds items, and every overview opened before the standard stopped requiring the copy carries a fenced item-format block, so scanning it would report the template as a malformed item.
- Every scan reads `linesOutsideFences` rather than the raw text, and a plan section closes on any marker-shaped line rather than on a recognized one. Both are the same defect: a reader of markdown that ignores structure reports the document's examples as its content.
- Measured against the 178 archived plans, `entry-unreasoned` reads 5 against a naive scan's 80. The survivors are entries naming no file at all, which is what the rule is for.
- `stack-foldable` is the only plans finding that reads across files. The command layer appends it to the `plans` report from the live folder, so the per-folder walks stay free of a finding that reads across files. Calibration is 15 reporting pairs of 87 stack pairs over 1,043 plans.
