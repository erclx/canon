---
title: Code health axes
description: What each axis measures, the verb and record keys behind it, the evidence class it carries, and where a finding routes
---

# Code health axes

One section per axis. Each states what it measures, the record keys that answer it, the evidence class the answer carries, and the skill a finding routes to.

The skill body holds the order, the guards, and the report shape. This file holds the detail a run looks up once it has a finding to place.

## File length

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Measures       | Whether a code file has grown past what one read takes in |
| Verb           | `canon code audit --json`                                 |
| Keys           | `fileLimit`, and `longFiles` with `file` and `lines`      |
| Evidence class | `measured`                                                |

The record lists each code file past `fileLimit`, tests included. Read the limit from the record rather than from a number written here.

- **Routes to:** a split. A source file splits along the roles `codebase-layout` names, and a test file splits by the behavior each part covers.
- **Missing key:** a record without `longFiles` came from a binary older than the length report, so the axis is unread with that cause
- **Empty list:** no file passes the limit, which is a result rather than an unread axis

## Function length

| Field          | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| Measures       | Whether a top-level function runs long enough that a split would help          |
| Verb           | `canon code audit --json`                                                      |
| Keys           | `functionCheckpoint`, and `longFunctions` with `file`, `line`, `lines`, `name` |
| Evidence class | `measured`                                                                     |

A `name` of `null` is an unnamed function, such as a callback assigned nowhere. The verb's `--help` names the languages its function reading reaches, and a file in any other language is unread on this axis.

- **Length is not complexity.** A `register` function holding help text runs long without branching. Report it as long and claim nothing about how hard it is to follow.
- **Routes to:** `code-craft`, which decides whether the function splits and where
- **Gate:** none. The figure reports and never fails.

## Comments

| Field          | Value                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Measures       | A comment block long enough to drift from its code, and degradation terms                       |
| Verb           | `canon comments scan --json`                                                                    |
| Keys           | `blockCheckpoint`, `vocabulary`, and per `snapshot` language `longBlocks` and `degradationHits` |
| Evidence class | `measured` for the counts, `read` for whether a block belongs                                   |

Each `snapshot` entry covers one language. A `longBlocks` entry carries `file`, `line`, and `lines`, the longest run of comment lines in that file. A `degradationHits` entry carries `file`, `line`, and `term`.

- **A long block** asks whether it belongs beside its code or describes several places at once, where it drifts from each
- **Never a deletion:** the project's comment rule forbids moving a file toward a figure, so the report asks the question and proposes no cut
- **A degradation term** marks deferred work or an admitted shortcut. Route it to the tracker, through `plan-intake`.
- **`vocabulary: null`:** no rule publishes the terms, so the degradation half is unread while the block half still reads
- **A language outside `snapshot`:** its files are unread on this axis

## Inline code

| Field          | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| Measures       | Code held in a string, and a long run inside a function that wants a name |
| Verb           | `canon code audit --json` for strings, none for blocks                    |
| Keys           | `limit`, and `blocks` with `file`, `line`, `kind`, `lines`, `branches`    |
| Evidence class | `measured` for strings, `read` for blocks                                 |

A `blocks` entry is a page, stylesheet, or script embedded in a string past `limit`, or a script that branches at any length. These are the findings the audit exits 2 on.

- **String routes to:** its own file with its language's extension, read from disk
- **Long block:** read only inside the functions the function axis listed, and skip test files, which `test-craft` owns
- **Wants a name:** a run carrying its own rule, such as a parse inside a command or a retry inside a fetch
- **Long block routes to:** `code-craft`, which weighs one longer function a reader follows top to bottom against a helper
- **Unread:** a long block is never inferred for a function the verb did not list, since reading every function costs more than the axis earns

## Folder layout

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Measures       | Whether a code folder holds so many files that it may hold two roles  |
| Verb           | `canon census --json`                                                 |
| Keys           | `folderCheckpoint`, and `folders` with `path`, `files`, `byExtension` |
| Evidence class | `measured` for the count, `read` for the role judgment                |

A folder counts its own files and not its subfolders', and the census leaves out gitignored paths and fixtures.

- **Code folders:** an entry whose files other than `md` outnumber its `md` files. A markdown-led folder belongs to `document-health`.
- **Roles:** list the folder's files and group them by what each is for, such as commands beside helpers or types. A test beside the file it covers shares that file's role.
- **One role:** no finding at any size
- **Missing key:** a census record without `folders` came from an older binary, so the axis is unread with that cause
- **Routes to:** `codebase-layout`, which decides where each role's files go

## Why the classes stay apart

A measured finding is a figure against a checkpoint the record carried, and a reading is this session's judgment. Setting the two side by side without the class implies evidence the reading does not carry, so the class travels on every finding rather than once in a preamble.
