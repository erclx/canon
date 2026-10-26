---
title: Migrate
description: What each canon migrate verb moves, the markers that keep an old spelling, and what each one refuses
kind: reference
---

# Migrate

`canon migrate <verb>` moves a project off a retired name or layout. Each verb reports its plan and writes nothing until `--write`, takes `--json`, and, except `rename`, takes `--root`. A second run rewrites nothing, which confirms the exclusions and markers fired.

| Verb               | Moves                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `status`           | Nothing. It lists every migration the project still needs, in run order.                                        |
| `rename`           | The retired `aitk` name. `--scope target` rewrites toolkit-owned folders only.                                  |
| `skill-names`      | Plugin skills off their `claude-` and `draft-` prefixes and other retired names, with every citation            |
| `records`          | Session records from `.claude/` to `.canon/`, with every tracked citation                                       |
| `surface-roots`    | Records such as `context/` and `REQUIREMENTS.md`, and the stamp folder, from `.claude/` to `canon/` by `git mv` |
| `record-tree`      | Citations inside the `.canon/` folders a session still follows, listed below the table                          |
| `rule-layout`      | A flat installed-rule layout onto the `canon/`-wrapped one                                                      |
| `scratch-evidence` | A folder a durable record cites out of `.tmp/`, with its citations                                              |
| `record-layout`    | Review receipts, memory archives, feedback, renders, picks, and evidence into their current folders             |
| `session-defaults` | The seeded session defaults into an existing `.claude/settings.json`, listed below the table                    |

`record-tree` follows citations in `diagrams`, `memory`, `plans`, `proposals`, `review`, `tasks`, and `teach`. `session-defaults` denies `Agent`, `Task`, and both merge commands, and turns auto memory off. The bullets below add detail per verb.

- `skill-names` takes no `--scope`, and skips the changelog, eval transcripts, replay fixtures, and the pointer each renamed `draft-` skill leaves at its old name
- `surface-roots` moves `context/`, `wireframes/`, `ARCHITECTURE.md`, `REQUIREMENTS.md`, `DESIGN.md`, and the stamp folder, and leaves `rules/`, `skills/`, `hooks/`, and `settings.json` in place
- `rule-layout` classifies each flat file against the stamp as clean, edited, or unclaimed. Clean and edited files move untouched, and an unclaimed name stays.
- `record-layout` labels each evidence folder `(pick)` or `(evidence)` in the dry run
- `session-defaults` adds a key only when absent, merge entries included, and each older project runs it once. `--write` restores a removed `Agent` or `Task` and never removes a deny entry.

## Output

- The plan lists every citation in scope by file, line number, and line text
- `record-tree` reports closed groundwork and intake trails, the scratch folder, and backup history as counts and rewrites none
- `records` reports skipped record folders as a count on its own line
- A `record-tree` rewrite has no undo in version control, so read the report before `--write`

`status` runs each verb as a dry run and exits 2 while any is pending, with a refusal outranking that. Each entry's `verb` carries the flags its dry run used, so append `--write` to it. A clean entry can turn pending once an earlier one applies, so run it again after each `--write`.

`status --json` also carries `retiredCallers`, the project calls to a verb a release retired.

- Each entry has `file`, `line`, `verb`, `release`, and `movedTo`
- The scan reads the workflow folder, the `package.json` scripts, `scripts/`, and the files those name, matching a command line or an argument list and never prose
- A caller changes no exit code, since no `--write` fixes one, so edit the script by hand

Three markers keep an old spelling on a line. Each also covers the nearest non-blank line, below it for `canon-keep-record-root` and above it for `canon-keep-surface-root`.

| Marker                    | Keeps                                          |
| ------------------------- | ---------------------------------------------- |
| `canon-keep-record-root`  | The old record folder spelling                 |
| `canon-keep-surface-root` | The old `.claude/` surface root                |
| `canon-keep-retired`      | A retired name, for `rename` and `skill-names` |

`surface-roots` also reports and leaves a rule's frontmatter `paths:` glob, a path into another repository, and a citation in a dated paragraph.

## Refusals

| Verb               | Refuses when                                                                          |
| ------------------ | ------------------------------------------------------------------------------------- |
| `records`          | The project does not ignore `.canon/`. Run `canon tooling sync --write` first.        |
| `records`          | A record folder already exists at the destination                                     |
| `surface-roots`    | Any destination already exists under `canon/`, refusing the whole plan                |
| `scratch-evidence` | A destination is occupied                                                             |
| `record-layout`    | A destination already exists, each move refused on its own                            |
| `rule-layout`      | A destination holds different bytes. Neither file is touched and other moves apply.   |
| `session-defaults` | The settings file is not valid JSON, or `permissions` or its `deny` has another shape |

A `rule-layout` destination holding the same bytes marks a duplicate, which `--write` deletes.

## See also

- `install-and-sync.md`: the drift report that names these verbs as remedies
