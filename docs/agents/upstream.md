---
title: Upstream
description: The fetch, catalog, and advance verbs that read Claude Code releases against the toolkit, the cursor record, and each refusal reason
---

# Upstream

`canon upstream` reads the Claude Code release feed from a stored cursor and lists canon's own mechanisms beside it, so a triage can match a release line to something canon does. The verbs ship in the published CLI as `canon gate` and `canon sandbox` do, and only this repository has the skill that drives them. A target has no use for them.

Run them as `bun src/cli.ts upstream ...` from this repository's root. The global `canon` resolves to the installed package, which lacks the verbs until a release ships them.

## Verbs

| Verb                                | Behavior                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `fetch [--since <version>]`         | List the release lines since the cursor, with the mechanical noise dropped   |
| `catalog`                           | List the skills, verbs, hooks, and gate stages the tree holds, one line each |
| `due`                               | Say whether a digest is due, from the cursor and the installed version       |
| `advance <version> --intake <slug>` | Move the cursor to a version, and store the current `llms.txt` beside it     |

Every verb takes `--root <path>` for the repository to read and `--json` for a record on stdout. `fetch` and `catalog` write nothing, and `due` writes only its day cache. `advance` is the only writer of the cursor, and the digest skill runs it after the findings are filed, so a run that dies midway reads the same range next time.

## fetch

```bash
bun src/cli.ts upstream fetch --json
bun src/cli.ts upstream fetch --since 2.1.256 --json
```

The range runs from the cursor, or from `--since` when given, to the newest release. The walk stops at the first release whose version is not newer than the cursor, so a cursor naming a version the feed never carried still bounds the range, and a range crossing a page boundary is read whole.

A line survives when it opens with `Added`, `Changed`, `Removed`, `Improved`, or `Deprecated` and carries none of the dropped surfaces: `[VSCode]`, `[Claude Tag]`, `[Code Review]`, `Windows:`, `Self-hosted`, the apps gateway, managed settings, OpenTelemetry, Bedrock, Vertex, and screen reader. A nested bullet and a `*` bullet are read as well as a `-` one.

Without `--json`, stdout carries one `version<TAB>text` row per line. With it, stdout carries one record:

| Field      | Holds                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| `from`     | The cursor version the range starts after                                  |
| `to`       | The newest release version, or `from` when nothing is newer                |
| `releases` | How many releases the range spans                                          |
| `lines`    | Each kept line as `version`, `date`, `text`, and `identifiers`             |
| `llms`     | `added` and `removed` lines of `llms.txt` against the stored copy, or null |

An identifier is a backticked name on a `Changed`, `Removed`, or `Deprecated` line that holds a dash, a slash, a dot, or a capital. It carries up to three tracked files naming it, and one with no hit is left out. `llms` is null when the page could not be fetched, and every line reads as added until `advance` has stored a first copy.

The request sends `GH_TOKEN` or `GITHUB_TOKEN` when either is set. Unauthenticated, GitHub allows 60 requests an hour, and a range takes about three.

## catalog

Prints a heading per section and a line per entry. With `--json` it prints one record whose fields are `skills`, `internalSkills`, `verbs`, `hooks`, `gate`, and `gaps`, each entry as `name` and `text`. A skill folder with no `SKILL.md` or no description appears in `gaps` rather than dropping out. A hook's text is the first comment line after its shebang.

## due

```bash
bun src/cli.ts upstream due --json
```

Answers whether a digest is worth running now. It exits 0 whether or not one is due, so branch on the record rather than the exit. The installed version comes from `claude --version`, and the cursor from the main worktree root.

| Reason            | `due`   | Meaning                                                                    |
| ----------------- | ------- | -------------------------------------------------------------------------- |
| `no-cursor`       | `true`  | No digest has been run, so a first run is prompted                         |
| `week`            | `true`  | The cursor is seven or more days old and the install is ahead of it        |
| `vocabulary`      | `true`  | An `Added` line in the gap names a plugin, skill, hook, worktree, or so on |
| `current`         | `false` | The install is at or below the cursor, as after a downgrade                |
| `recent`          | `false` | The cursor is under a week old and no line in the gap matches              |
| `unknown-version` | `false` | `claude --version` could not be read                                       |

The record is `due`, `reason`, `releases`, `installed`, and `cursor`. `releases` counts the releases in the gap and is `null` when the feed was not read, so a `week` result can arrive without a count.

The gap is read from GitHub only when the install is ahead of the cursor, and the result is cached for a day under the scratch folder at `.canon/tmp/upstream-due/check.json`. A failed read is cached too, so a rate limit hit by one session is not retried by the next. Nothing here moves the cursor.

The `.claude/hooks/upstream-due.sh` hook runs the verb at an attended session start and shows the operator one line when it is due. It stays silent in a background session, on a resume, a clear, or a compaction, and on any failure.

## advance

Writes `cursor.json` and the fetched `llms.txt` under the upstream record folder at the main worktree root, each through a temp file and a rename. `--no-llms` keeps the stored `llms.txt` and fetches nothing. The record is `version`, `intake`, `advanced`, and `llms`, which reads `stored` when a fresh copy was written and `kept` when the stored one stayed, whether by `--no-llms` or because the fetch failed.

The cursor file holds `version`, `date`, and `intake`. The folder is a backed record folder, so `canon records push` carries it.

## Refusals

A refusal exits 1, prints the reason on stderr, and with `--json` adds `reason` and `message` to stdout. Branch on `reason`.

| Reason              | Verb      | Meaning                                                             |
| ------------------- | --------- | ------------------------------------------------------------------- |
| `no-cursor`         | `fetch`   | No cursor is stored and no `--since` was given. Pass the flag.      |
| `bad-since`         | `fetch`   | `--since` is not a dotted version                                   |
| `cursor-missing`    | `fetch`   | Every release the feed returned is newer than the cursor            |
| `rate-limited`      | `fetch`   | GitHub refused the request. Set `GH_TOKEN` or `GITHUB_TOKEN`.       |
| `network`           | `fetch`   | The feed could not be reached                                       |
| `http`              | `fetch`   | GitHub answered with an error status                                |
| `invalid-version`   | `advance` | The version is not a dotted number                                  |
| `older-than-cursor` | `advance` | The version is older than the stored cursor, which never moves back |
