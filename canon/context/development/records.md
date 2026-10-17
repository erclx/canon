---
title: Record folders
description: How each gitignored record folder is indexed, named, archived, and backed off the disk, and the skew a layout change meets
---

# Record folders

## Decisions

### Indexing the board and the pen

The task board is a folder of one file per task, which keeps concurrent sessions from overwriting each other on a board with no history.

- A `PostToolUse` hook regenerates its `index.md` rather than `bun run check`, because the whole-repo index walk filters through `git check-ignore` and never sees a gitignored folder
- Positional regen reaches it, since the walk-up never consults git

`.canon/review/` carries a subfolder per producer.

- `branch/` holds reports nothing writes now, `memory/` receipts nothing writes now, and `design/` the `canon design render` preview
- The filename prefix does the job for a producer with no subfolder, so `ux-audit-*`, `ux-measure-*`, and `seed-audit-*` land at the folder root, covered by the ignore and backed-folder entries
- The canvas content sits at `.canon/canvas/` rather than under `review/`, since it is a drafting surface the operator keeps open and not a report read once
- A branch report is the one thing swept rather than archived, so `task-complete` deletes any older report whose branch is gone, since the durable record is the comment `review-pr` posts

### The retired memory folder

`.canon/memory/` is retired as a live folder, no skill writes it, and `canon records` does not read it as a kind. An older target keeps its entries, and `records push` still backs the folder with the rest.

- A `.canon` root's push carries every top-level folder its listing finds, and a legacy root's records index keeps tracking one it already held
- The name sits in neither `BACKED_FOLDERS` nor `RETIRED_FOLDERS`, and `LEGACY_RECORD_FOLDERS` keeps a legacy `.claude/memory/` visible to the split-roots guard <!-- canon-keep-record-root -->
- Retiring it would stage the archive's deletion from the remote's head

### A durable record is named for what it is

`groundwork/`, the archives, and `.canon/evidence/` sit outside `tmp/`, leaving it to hold only what can be deleted without loss. A folder cited by task files months later fails that test, so a folder announcing itself as temporary is the wrong container for anything a later session must find.

A folder can be a durable record without being cited, since the disk-loss risk separating `tmp/` from a backed folder has nothing to do with citation. That is why a retired memory entry sits under the memory folder rather than scratch.

### Evidence a record cites

A folder a durable record cites as its evidence belongs outside `tmp/`, and `canon migrate scratch-evidence` moves one to `.canon/evidence/<nn>-<folder>/`.

- The verb walks every live and archived record for a citation, refuses a folder a source file still names by path, and leaves a folder a script writes on its own schedule
- Committed images `canon pr evidence` compares sit under an `evidence/` segment beside their area, such as `assets/evidence/`, a different folder from the record root
- `canon/context/development/evidence.md` sorts those into dev and prod, and a gitignored spike's evidence counts as neither
- Prefixing the other record surfaces with a dot was declined, since it rewrote several times the occurrences the shipped move did, broke every installed target, and hid the daily board

### Where each folder archives to

An archive sits inside the folder it archives, so a listing of the root shows records rather than records paired with their history. Splitting a retired entry to a scratch archive and a receipt to a review archive was declined, because it names two surfaces for one record.

- A retired memory entry moves to `.canon/memory/archive/`, and a triage receipt from `.canon/memory/review/` moves beside it. A resolved receipt is deleted, its declines folded into the entries.
- A shipped plan moves to `.canon/plans/archive/` under its original name, carried by `canon tasks archive` with its task, and a re-shipped slug overwrites the earlier file
- A shipped task moves to `.canon/tasks/archive/` through `canon tasks archive`, which owns the move, the `priority.md` row removal, and the index regen as one unit

Citation does not decide whether a folder is backed. `memory/` is not among the names `EXCLUDED_ENTRIES` withholds from `canon records push`, so a wrong call recovers through `canon records pull`.

The `Pull request:` line `git-pr` writes onto the task is what lets a merge close it, since every merge on `main` is a squash carrying that number while the branch name never lands.

### Changing where a folder sits

A path convention over these folders takes effect on disk when a branch applies it and in the tooling only when a release ships, so both layouts are live between. Every ship chain in that window uses the installed CLI and writes the old path back, so the citation sweep behind a rename runs a second pass before the branch merges.

An older binary meets the nested archives three ways.

- `resolveLivePlan` without an archive subtraction reads a `Plan:` line into `.canon/plans/archive/` as live and refuses with `plan-unswept`, so every shipped plan's task is declined. It fails closed.
- A binary predating the plan move archives the task and leaves the plan live, reporting success. A live plan is recoverable and one archived early is not, so the lag is accepted.
- A binary predating the task move lands the file in a flat `task-archive/` sibling, untracked and unignored on purpose so a stray write shows in a status read

`RETIRED_FOLDERS` in `src/records/backup.ts` names both flat task-archive spellings as moved paths, which an ignore entry would contradict.

### Moving off the older layout

`claude/skills/task-board/references/tasks.md` and `claude/skills/plan-feature/references/plan.md` state the nested position as a convention a project receives, so the failures above are what an old binary produces against either layout, not a defect in either standard.

The move is named rather than worked out per visit. `git mv` both archive folders onto the nested path, retarget every citing pointer in the same commit, then run `canon tasks archive` in that checkout to confirm it resolves. It runs inside the project that owns the files, on its own branch, never from this checkout.

### The record roots the sweep passes over

The citation sweep behind `canon migrate records` passes over the records themselves. `canon tooling sync claude . --write` prunes the old ignore entries down to one `.canon/` line immediately before the verb runs, so every record folder still at the old root becomes visible to `ls-files --others --exclude-standard` and enters the sweep as source.

- `isRecordArtifact` in `src/migrate/records.ts` closes it, applied inside `planRecordsMove` and again in `runRecords` ahead of `readSources`, keeping every excluded record file off the read path
- The verb reports what it passed over as a count on its own line rather than in `excluded`, which lets a reader check a handful by hand
- The predicate ships exported so a decision entry can invert it rather than restate it
- A rewritten file can still couple to an excluded one by naming its path as plain text, which `referencesExcluded` reports on `RecordsPlan.coupled`, and a live pointer keeps the old spelling

### The two roots take different rules

The asymmetry is deliberate. `.canon/` is read whole, since `canon/context/context-model/overview.md` fixes the rule that every gitignored record moves there and nothing tracked lands there, covering a folder `RECORD_ENTRIES` has yet to learn about.

`.claude/` is mixed and has to be entry-scoped, because a bare prefix drops tracked files and strands a target's installed `.claude/rules/canon/canon/task-scope.md`, which the sweep repoints. The marker's comment syntax has to match the file it sits in, since the sweep tests the raw substring on the line or the nearest non-blank line above.

- A `.gitignore` pattern takes no trailing comment, so the marker needs its own comment line directly above
- A TOML array entry can carry it trailing on the same line
- A markdown sentence takes the inline `<!-- canon-keep-record-root -->` form
- Forgetting it on a new `.claude/<record-entry>` citation fails the Record idempotence stage

### What a spike leaves behind

`plan-groundwork` sends every experiment input to `.canon/tmp/runs/groundwork-fixtures/<slug>/` and every piece of evidence to `evidence/` inside the track. The split is input against output, since a fixture page or arm script is re-runnable and cited by nothing, while a recording and its frames are what a later reader opens to check a claim.

- Nothing sits beside a track at the groundwork root, because mode detection matches entries at its top level, so a sibling can be taken for a track and a nested folder cannot
- `canon records validate groundwork` reports nothing on a track's `evidence/`, because `listMarkdown` in `src/records/validate.ts` filters `readdir` to `.md` files at the track's own level
- Intake needs no equivalent, since `plan-intake` routes any finding needing an experiment to a track
- `claude/skills/plan-intake/references/intake.md` says nothing about a subfolder, though a live folder can carry one holding markdown

### Backing the record folders off the disk

Archiving moves a record between folders on one disk, so `canon records push` carries them to a private remote and `canon records pull` brings them back. `docs/agents/records-push.md` carries the verb surface and refusal table.

The set is the record root's entries less three: `tmp`, deletable by definition, `ordinal-locks`, transient per claim, and `.records.git`, the history the rest push into. Those names bound the records index too, so one an older binary committed leaves the history once rather than being re-staged by the `--force` that carries the payload.

- `BACKED_FOLDERS` in `src/records/backup.ts` bounds only the legacy `.claude/` root
- A folder `canon migrate scratch-evidence` promotes lands inside `evidence`, which the exclusion-based push already carries
- The payload guard in `src/records/push-guard.ts` refuses the whole push when a pending file is over 25 MB or carries a credential the `src/secrets/` patterns match

### The second git directory

The history lives in `.canon/.records.git` with `.canon/` as its work tree, so every tracked file spelling one of these paths keeps working. A separate checkout would move every such file. An orphan branch on this repository was cheaper and the one it cannot take, since the repository is public.

`recordRoot` resolves the root and `workTree` takes whatever it returns, so a half-migrated tree cannot open a history at one root and stage at the other. Staging uses explicit pathspecs with `--force`, which lets an ignored folder reach an index, and neither verb touches the project index or working tree.

## Gotchas

### Refusals

A tree with records under both roots is refused by both verbs before any other gate. `recordRoot` answers for the first root that exists, so a folder a failed move left behind is absent from the work tree while the index names it, and `add -A` drops it from the remote. `canon migrate records` stops on its first failed rename for the same reason.

### Pathspecs in a worktree

Each pathspec is a bare folder name and git derives its prefix from the current directory, so the invocation carries `-C` at the work tree beside `--git-dir` and `--work-tree`. Without it a session under `.claude/worktrees/` picks up that worktree's path in every name and the push fails with a pathspec mismatch.

Pull is the more dangerous direction. `add` refuses an unmatched pathspec outright while `status` tolerates one, so a reset behind a clean-looking status would take an unpushed record.

### The remote

The remote is created by hand, once per machine, and both verbs refuse with the two setup commands until it exists, since provisioning a private repository needs a `gh` scope this toolkit asks for nowhere else.

`push` also refuses when the records origin is a remote of this project, because this repository is public and the payload is the task board, review reports, and groundwork trails. Failing to read the project's remotes refuses under its own reason rather than answering an empty list, which would clear the comparison for every origin.

```bash
git --git-dir=.canon/.records.git init
git --git-dir=.canon/.records.git remote add origin <private-repo-url>
```
