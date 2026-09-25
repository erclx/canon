---
title: Records validate
description: Validating the session records and the standards corpus, the per-kind checks, which root each kind defaults to, the exit codes, and the refusal reasons
---

# Records validate

`canon records validate <kind>` reports where a file and the standard governing it disagree. Five kinds are gitignored folders under the record root, resolved at `.canon/` first: `plans`, `groundwork`, `intake`, `memory`, and `teach`. The sixth is `standards`, the authoring corpus, which is tracked and installed rather than scratch.

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

The two record roots every kind resolves at are in `records.md`.

## What each kind checks

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

## Exit codes and refusals

Exit codes: `0` every check passed, `1` refused, `2` at least one record carries a finding. A `reason` field carries which gate fired: `no-folder` when none of the kind's directories exist, and `unknown-kind` when the argument names no published kind. A `no-folder` message names every candidate, so a record kind's refusal names both record roots and the `standards` refusal names the authoring root and the installed copy.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the record's `findings` array and its `reason` rather than the exit when a skill consumes this.

The four record folders are shared scratch at the main worktree root, so `--root` defaults to the first entry of `git worktree list` rather than the working directory. A linked worktree validates the same records every other session reads.

`standards` takes the other default, the root of the checkout the caller stands in. The corpus is tracked, so a linked worktree holds its own edited copy, and resolving the main root there would report on a tree the session never touched while saying nothing about which one it read. A session that adds or renames a standard inside a worktree is the case, and it is the one the check exists for.

Skills branch on the findings rather than on the exit code:

```bash
canon records validate plans --json | jq -r '.findings[] | "\(.kind): \(.subject)"'
```

For the shapes each check enforces, see `standards/plan.md`, `standards/groundwork.md`, `standards/intake.md`, `standards/memory.md`, and `standards/standard.md`.
