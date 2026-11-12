---
title: Code health axes
description: What each axis measures, the verb and record keys behind it, the evidence class it carries, and where a finding routes
---

# Code health axes

One section per axis. Each states what it measures, the record keys that answer it, the evidence class the answer carries, and the skill a finding routes to.

The skill body holds the order, the guards, and the report shape. This file holds the detail a run looks up once it has a finding to place.

## File length

| Field          | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Measures       | Whether a code file has grown past what one read takes in                |
| Verb           | `canon code audit --json`                                                |
| Keys           | `fileLimit`, `lengthExtensions`, and `longFiles` with `file` and `lines` |
| Evidence class | `measured`                                                               |

The record lists each code file past `fileLimit`, tests included. Read the limit from the record rather than from a number written here.

- **Covered:** the bare extensions in `lengthExtensions`, read from the record rather than from a list written here
- **Under the limit:** a covered file absent from `longFiles`
- **Not covered:** a file in any other language is unread on file length, never ok
- **`files` is not coverage:** the record's top-level `files` counts only what the embedded read covers, so never infer a length gap from it

- **Routes to:** `codebase-layout` for a source file, which splits it along its roles, and a split by behavior for a test file
- **Missing key:** no `longFiles` means a binary older than the length report, so the axis is unread with that cause. No `lengthExtensions` means one older than the published list, so coverage is unread.
- **Empty list:** no file passes the limit, which is a result rather than an unread axis

## Function length

| Field          | Value                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Measures       | Whether a top-level function runs long enough that a split would help                                               |
| Verb           | `canon code audit --json`                                                                                           |
| Keys           | `functionCheckpoint`, `functionExtensions`, `longFunctions` with `file`, `line`, `lines`, `name`, and `unreadFiles` |
| Evidence class | `measured`                                                                                                          |

A `name` of `null` is an unnamed function, such as a callback assigned nowhere. Function reading reaches a narrower set of languages than file length, the bare extensions in `functionExtensions`, so a file in any other extension is unread here alone and never on file length.

- **Unread file:** an `unreadFiles` entry carries `file`, `line`, and `reason` for a file the reading could not follow. Report it unread on this axis with that reason, never as under the checkpoint.
- **Missing key:** no `unreadFiles` means a binary older than the unread report, so a file absent from `longFunctions` is only as covered as its `--help` says. No `functionExtensions` leaves the covered set unread.
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

A `blocks` entry is a page, stylesheet, or script embedded in a string past `limit`, or a script that branches at any length. These are the findings the audit exits 2 on. The audit's `--help` names the languages this read covers, and a file in any other language is unread on this half of the axis.

- **String routes to:** its own file with its language's extension, read from disk
- **Long block:** read only inside the functions the function axis listed, and skip test files, which `test-craft` owns
- **Wants a name:** a run carrying its own rule, such as a parse inside a command or a retry inside a fetch
- **Long block routes to:** `code-craft`, which weighs one longer function a reader follows top to bottom against a helper
- **Unread:** a long block is never inferred for a function the verb did not list, since reading every function costs more than the axis earns

## Folder layout

| Field          | Value                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| Measures       | Whether a code folder holds so many files that it may hold two roles        |
| Verb           | `canon census --json`                                                       |
| Keys           | `folderCheckpoint`, and `folders` with `path`, `files`, `byExtension`       |
| Second input   | `prefixGroupThreshold`, and `prefixGroups` with `folder`, `prefix`, `stems` |
| Evidence class | `measured` for the count, `read` for the role judgment                      |

A folder counts its own files and not its subfolders', and the census leaves out gitignored paths and fixtures.

- **Code folders:** an entry whose code files outnumber its `md` files, counting as code a language's source, such as `ts`, `js`, `py`, `go`, `sh`, or `css`
- **Not code:** images, fonts, markup, and data, so an asset folder is no candidate, and a markdown-led folder belongs to `document-health`
- **Roles:** list the folder's files and group them by what each is for, such as commands beside helpers or types. A test beside the file it covers shares that file's role.
- **One role:** no finding at any size
- **Prefix groups:** sibling stems in one folder sharing the text before their first hyphen or underscore, at any folder size
- **Prefix reading:** whether the group is a role the folder should name, reported without proposing a folder name
- **A shared verb:** a prefix such as `check` over files doing unrelated jobs is no role, so the group alone is never a finding
- **Missing key:** a census record without `folders` came from an older binary, so the axis is unread with that cause
- **Missing prefix key:** a record carrying `folders` without `prefixGroups` leaves the prefix reading unread, while the folder reading holds
- **Routes to:** `codebase-layout`, which decides where each role's files go

## Why the classes stay apart

A measured finding is a figure against a checkpoint the record carried, and a reading is this session's judgment. Setting the two side by side without the class implies evidence the reading does not carry, so the class travels on every finding rather than once in a preamble.
