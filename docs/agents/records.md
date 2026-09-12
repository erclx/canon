---
title: Records
description: The two roots a record folder resolves at, validating the session records and the standards corpus, the per-kind checks, the refusal reasons, migrating a record a frontmatter change orphaned, reading each folder's size and growth, backing the folders to a private remote, and which root each kind defaults to
---

# Records

## Record roots

Every verb here resolves a record folder at two roots rather than one. `.canon/<folder>` is read first, `.claude/<folder>` second, and a folder neither root carries resolves to the creation default, which is `.claude/`. The scratch folder is the one name that differs by root, spelled `.canon/tmp` and `.canon/tmp`, since inside a dotted root the leading dot hides nothing already hidden.

The read order and the creation default disagree deliberately. The gitignored record folders are moving to a root of their own, and the CLI learns to read both roots in a release that ships ahead of the move, so the binary a session already holds knows where to look by the time a tree relocates. Creating under the new root before then would write records to a root whose ignore line may not have reached a project yet, and it would split one project's records across two roots with no verb able to reconcile them. The move flips the default and nothing else.

A caller never spells a record root by hand for the same reason. A path written as `.canon/plans/...` resolves against one root and reports nothing when it is wrong, which is the quiet failure this ordering exists to prevent: a stale binary meeting a moved layout, writing to the old path, and reporting success. Read a folder through the verb that owns it, and where a skill needs the path itself, take it from that verb's record rather than composing one.

A refusal names every root it looked at, so a message reading `no-folder` says where a write would land as well as where the read failed.

## Validate

`canon records validate <kind>` reports where a file and the standard governing it disagree. Five kinds are gitignored folders under `.claude/`: `plans`, `groundwork`, `intake`, `memory`, and `teach`. The sixth is `standards`, the authoring corpus, which is tracked and installed rather than scratch.

```bash
canon records validate plans
canon records validate memory
canon records validate standards
canon records validate intake --json
```

| Option          | Behavior                                                            |
| --------------- | ------------------------------------------------------------------- |
| `--json`        | Add a machine-readable record on stdout                             |
| `--root <path>` | Project root, defaulting to the main worktree except on `standards` |

It reads and never writes, and the reason splits by kind. A session record is per-machine scratch with no history behind it, so a repair that guessed wrong could not be undone. A standard installs into every target and is cited by bare filename, so a rename the verb performed would reach further than the file it moved, which is why a finding naming one says so.

`standards` reads the authoring root at `standards/` where it exists and a copy at `.claude/standards/` otherwise. The authoring root wins because it is the only tree anyone authors in and the only one the resolver answers from, so a finding fixed anywhere else is fixed where nothing reads it. No repository generates the second candidate any more, which leaves it as a floor under a target holding a copy an older toolkit installed. The walk stays flat, matching the catalog.

Nothing fires it automatically. The five record folders are gitignored, so the standards-audit hook exits early on them and any check reading changed files from git never lists one. The corpus is tracked and still unreached, since the markdown audit reads content across the files git lists and rules on no filename. The verb runs at the moment a session claims the record is finished, which is the same placement `canon tasks validate` takes over the board.

### What each kind checks

| Kind         | What it reports                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plans`      | A filename that is not `feature-<slug>.md`, a missing `# Feature:` heading, a missing required section, a files-to-touch entry naming no file or saying nothing about one, a question carrying no suggestion or no answer slot, and a batch still staged with a `**Batch N**` sub-heading inside the one file rather than split into its own plan |
| `groundwork` | A track with no `README.md` or no `01-current-state.md`, a file missing `title` or `description`, a `README.md` with no `date` as `YYYY-MM-DD`, an unnumbered file, and a track holding a decision without its handoff or the reverse                                                                                                             |
| `intake`     | A dump with no `00-overview.md`, the same frontmatter and numbering checks, an item missing any of `Problem`, `Fix`, `Worth it`, or `You`, and an item carrying `Open` with no `Suggested`                                                                                                                                                        |
| `memory`     | A filename whose prefix names none of the four types, an entry missing `title`, `description`, or `category`, a `category` disagreeing with that prefix, a title repeating the filename, and a rule-bearing body missing a part                                                                                                                   |
| `standards`  | A standard missing `title` or `description`, an absent `## Scope` section, a scope section carrying no `Does not govern:` list, a statement anchoring nothing, and a filename naming no part of the path the statement governs                                                                                                                    |
| `teach`      | A workspace folder carrying no two-digit ordinal, an absent `MISSION.md`, `RESOURCES.md`, or `GLOSSARY.md`, a file missing `title` or `description`, a mission with no `date` as `YYYY-MM-DD` or no `## Success looks like` section, an unnumbered learning record, and a reference page opening with an ordinal                                  |

The half-closed track is the groundwork check a reader cannot run by eye. A folder holding `06` without `07` reads as closed to anyone scanning filenames while the file a returning session actually opens is absent.

The item check skips `00-overview.md` and `99-next-session.md`, since neither holds items and running it over the handoff would report every heading it carries. The memory walk skips `index.md` for the same reason, since the catalog is generated from its siblings rather than authored as an entry.

A memory `category` is compared against the sentence-case form of the filename prefix rather than checked field by field, so one finding covers a prefix outside the four types, a field disagreeing with the prefix, and a casing drift that would open a second group in the catalog. The body check runs on `feedback` and `project` entries alone, because a `user` or `reference` entry is a single sentence by design and has no rule to apply.

The standards filename check derives a word from the governed path rather than counting words in the name. Every member of the corpus is named for the artifact its scope statement governs, and one word is what that produces rather than the rule itself, so a check keyed on word count would pass a conforming single word naming the wrong artifact. Each path segment offers its own word, a dotted container segment offers none, a hyphenated segment offers its parts, and the singular and the plural both match.

The scope statement is read exactly as `scripts/standards/list.sh` reads it for the catalog's `appliesTo` field: backticked spans in the first sentence alone, with an attribute standard resolving where that sentence backticks nothing and the statement says it governs an attribute. One sentence read two ways would let a standard pass the check while publishing a different jurisdiction to every consumer of the catalog. An attribute standard is exempt from the filename derivation because it governs no path to derive from, and a statement that anchors nothing and claims no attribute is reported as `scope-unanchored` rather than passed, since silence there would let the backticks be removed to disable the check.

An absent `## Scope` section suppresses the filename finding. The name derives from the statement, so a missing section leaves nothing to derive against, and reporting both would name one defect twice and point the fix at the wrong file. The walk skips `index.md`, which is generated from its siblings rather than authored.

A plan section opens as a bold label or as an H2 and the check counts both, naming the standard's spelling when it reports one missing. The corpus splits roughly four to one between the two forms, so failing the variant would report nearly every plan on a rule that costs a reader nothing.

A section runs to the next marker-shaped line whatever it names, so a plan carrying a label of its own closes the section above it rather than collecting into it. Fenced blocks are dropped before any of this, since a plan showing the shape it writes puts real-looking bullets and headings inside a fence.

### Exit codes and refusals

Exit codes: `0` every check passed, `1` refused, `2` at least one record carries a finding. A `reason` field carries which gate fired: `no-folder` when none of the kind's directories exist, and `unknown-kind` when the argument names no published kind. A `no-folder` message names every candidate, so a record kind's refusal names both record roots and the `standards` refusal names the authoring root and the installed copy.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the record's `findings` array and its `reason` rather than the exit when a skill consumes this.

The four record folders are shared scratch at the main worktree root, so `--root` defaults to the first entry of `git worktree list` rather than the working directory. A linked worktree validates the same records every other session reads.

`standards` takes the other default, the root of the checkout the caller stands in. The corpus is tracked, so a linked worktree holds its own edited copy, and resolving the main root there would report on a tree the session never touched while saying nothing about which one it read. A session that adds or renames a standard inside a worktree is the case, and it is the one the check exists for.

Skills branch on the findings rather than on the exit code:

```bash
canon records validate plans --json | jq -r '.findings[] | "\(.kind): \(.subject)"'
```

For the shapes each check enforces, see `standards/plan.md`, `standards/groundwork.md`, `standards/intake.md`, `standards/memory.md`, and `standards/standard.md`.

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

## Size

`canon records size` reports what each record folder holds and how much of it is recent. It reads the ten backed folders named under Push and pull, plus the scratch folder, and it gates nothing.

```bash
canon records size
canon records size --json
```

| Option          | Behavior                                      |
| --------------- | --------------------------------------------- |
| `--json`        | Add a machine-readable record on stdout       |
| `--root <path>` | Project root, defaulting to the main worktree |

The table carries one row per folder that exists, heaviest first, with the file count, the bytes, a count for each growth window, and the dates of the least and most recently written file. Those dates render in the machine's local time, which is the calendar day whoever wrote the file was living in, and the reading is per-machine already. Folders that do not exist are named on one line below it rather than printed as rows of zeros. The record a `--json` call emits carries every folder either way, each with a `present` flag, so a caller reading the record gets a stable set of keys and can tell an absent folder from one the reading skipped.

Ordering by weight is what makes the reading worth taking. A folder listed alphabetically hides behind its neighbors, and the row a reader came for is the one that grew.

The reading carries two windows rather than one, at 7 and 30 days. A single window cannot separate a folder growing steadily from one that took a single batch: a folder whose 7-day count is most of its 30-day count moved in one pass, and one where the two are proportional is growing at a rate.

Nothing fails on a number here. A record folder has no correct size, so the reading is a number to notice rather than a threshold to gate, and the point of the verb is that the next reading is taken by a command instead of by someone remembering to count the folder. The memory pen went from 44 entries to 236 between two readings taken by hand two weeks apart, which is the measurement this replaces.

The scratch folder is read here and skipped by a backup, because deletable without loss is not the same as empty. The routing handoffs and the memory archive both sit there and both accumulate. `.canon/.records.git` stays out because it is the backup history rather than a record, and `.claude/worktrees/` stays out because each entry is a checkout of the project with its own removal verb, and one of them outweighs every record folder combined.

The window counts read `mtime`, so what they report is a file written inside the window rather than one created there. An entry edited long after it landed reads as recent, which overstates growth and never understates it, and these folders are append-mostly so the two readings agree on nearly every file. The one reading that is wrong rather than early is a machine restored by `canon records pull`, which resets the work tree hard and re-dates every file it writes, so a window taken there counts the restore. Nothing on the filesystem separates the two, since a restored file is new by every stamp it carries.

Exit codes: `0` the reading completed, `1` refused. The one refusal is `no-folder`, raised when the project holds neither record root. A project holding a root and no records is empty rather than absent, and each folder's own `present` flag already says which of the ten it carries.

## Push and pull

`canon records push` commits the backed record folders to a private remote and pushes them. `canon records pull` fetches the other direction and writes them back. Both take `--json` and `--root` the way `validate` does, and both exit `0` on agreement and `1` on a refusal.

```bash
canon records push
canon records push --json
canon records pull
```

The backed folders are `diagrams`, `groundwork`, `intake`, `memory`, `plans`, `proposals`, `review`, `tasks`, and `teach`, all under whichever record root the project carries. They are the record root's own entries less three: `tmp`, which is deletable without loss, `.claude/worktrees/`, whose contents belong to the project repository already, and `.records.git/`, which is the history the rest are pushed into. Nothing bounds the list from outside any more, since the claude manifest ships one `.canon/` root entry and names no folder, so spelling the nine out is what keeps a record folder added later from silently entering the payload. Each name is a top-level record folder and every archive sits inside the one it archives, so the list stays at one entry per surface however many archives appear. It is a constant rather than configuration, and it deliberately does not match the six record kinds `validate` hardcodes.

Records are gitignored by design, so the history lives in a second git directory at `.records.git` inside the record root, with that root as its work tree. Both resolve off the root together rather than folder by folder, since a history opened at one root beside a work tree at the other would stage the deletion of every folder a move relocated. Every path stays where it is, which is what a separate checkout could not do. The verbs stage the nine folders by explicit pathspec with `--force`, so nothing outside them can enter the index however the ignore rules read, and the project working tree and its index are never touched. Each pathspec is a bare folder name and git reads it against the current directory rather than against the work tree the same call names, so the invocation carries `-C` at the work tree beside the other two flags. That is what lets either verb run from a linked worktree under `.claude/worktrees/`, which sits inside the records work tree and would otherwise prefix every name with its own path.

### Setup

A person creates the records repository once per machine, and the verbs refuse with the commands when it is absent:

```bash
git --git-dir=.canon/.records.git init
git --git-dir=.canon/.records.git remote add origin <private-repo-url>
printf '.canon/\n' >> .gitignore
```

The ignore line is repeated here rather than left to the install, because the person running these commands is the one who creates the directory and the rule is worth reading beside the command that needs it. The claude manifest ships `.canon/` too, so a project that ran `canon tooling sync` already carries it and this line is a no-op there. One root entry covers the history and every record beside it, which is what makes the rule worth stating once rather than per folder.

Point it at a private repository, and at one that is not a remote of the project. Records carry the memory pen, the review reports, and the groundwork trails, so a public project publishes all of it to anyone who fetches all refs. `push` compares the configured origin against every remote of the project and refuses on a match. A read of that list which fails refuses as well, since an empty list clears the comparison for every origin and a gate that passes on its own failure is no gate.

### Refusals

| Reason              | What fired                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ |
| `split-roots`       | Record folders sit under both roots, so the resolved work tree is not the whole set  |
| `no-repository`     | No `.canon/.records.git`, answered with the two setup commands                       |
| `no-remote`         | The records history has no `origin`                                                  |
| `remote-unreadable` | The project's own remotes could not be read, so the shared-origin gate could not run |
| `remote-shared`     | The records origin is also a remote of the project                                   |
| `no-remote-records` | `pull` found no branch on the records origin                                         |
| `local-changes`     | `pull` found records on disk that the history does not carry                         |
| `local-ahead`       | `pull` found local commits that never reached the origin                             |
| `git-failed`        | A git call failed, with its stderr in the message                                    |

`split-roots` runs ahead of every gate below it and fires on a half-migrated tree, which is what a `canon migrate records` run that failed partway leaves. `recordRoot` answers for the whole tree on the first root that exists, so a folder left at the old root is absent from the work tree while the records index still names it, and an unguarded `add -A` would stage its deletion and drop it from the remote on the next push. Finish the move, or put the stranded folders back beside the others.

The two `pull` refusals exist because the directions are not symmetric. A push only adds, while a pull onto a machine holding work that never left it would discard that work. Resolve either by running `push` first, or by moving the local folders aside. A machine holding none of the ten has nothing to lose, so a restore onto a fresh checkout runs straight through.

### When it runs

`.husky/post-merge` runs `push` after the task archiving loop, on every merge rather than only on one that archived a task. A review report and a memory entry both land on runs that close nothing. The call sits inside an `if` and last in the file, so an unreachable remote neither aborts the hook nor delays the archiving above it, and a checkout that never ran the setup reports nothing. Anything the hook misses is covered by running the verb by hand.
