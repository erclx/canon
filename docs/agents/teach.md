---
title: Teach
description: Listing learning workspaces with what their records schedule next, opening one with its required files, recording sources and glossary terms, viewing one with its chrome refreshed, where the lesson authoring verbs are described, the refusal reasons, and why every write here runs through a verb
---

# Teach

Learning workspaces sit under `.canon/teach/<nn>-<topic>/`, and `standards/teach.md` fixes their layout, naming, and file formats, apart from the glossary, whose shape `standards/glossary.md` fixes, cited from the `teach-workspace` skill, so it travels with the file wherever a promotion lands it. Every verb here resolves that folder against the main worktree root rather than against the working directory, so a session standing in a linked worktree reaches the one workspace the learner has rather than opening a second.

Passing `--root` a path already named `teach` reaches that folder directly rather than wrapping it in the `.canon/`-or-`.claude/` record-root lookup, which is what lets a workspace committed outside the record root, such as a worked example kept in version control on purpose, take every verb below the same as one under `.canon/teach/`.

That root resolution is also why the writing verbs exist at all. The file-editing tools refuse a main-root path from a linked worktree and offer a worktree copy instead, and a caller naming only the destination reports a success that did not happen. A whole-file create still goes out as a shell heredoc. Changing a line inside a file that already exists has no shell route, because the stream editors are banned, so `resource` and `glossary` are the route for the two files a running workspace edits.

## List

`canon teach list` reports the workspaces under `.canon/teach/`, or what one workspace holds. It reads and never writes.

```bash
canon teach list
canon teach list regular-expressions --json
```

| Option          | Behavior                                    |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Teach root, defaulting to the main worktree |

With no topic it reports one line per workspace, carrying the lesson, learning-record, reference-page, and glossary-term counts, plus `next`, the ordinal an open would take. With one it reports the filenames behind each count and the glossary entries themselves.

A folder not named `NN-<topic>` is not a workspace, so the listing, `nav`, and every selector skip it and it moves no ordinal. That is what lets a teach root carry a sibling folder such as `evidence/` without it drawing as a stub row and receiving a contents page.

The listing also names the required files a workspace does not carry, which is `MISSION.md`, `RESOURCES.md`, and `GLOSSARY.md`. That is a report rather than a refusal, because a workspace missing one is still a workspace a session can resume.

Every record carries `due`, read from the `## Revisit` sections of the workspace's learning records and sorted soonest first. Each entry names the `item`, its `date`, the `rung` it has reached on the spacing ladder, `overdue` once that date has arrived or passed, and the `record` the surviving entry was written in. A later record supersedes an earlier entry for the same item, matched without regard to case, since the schedule is the state of one topic rather than a log of every time it was set.

Each entry also carries `hit` and `miss`, the two dates the next record could write. The ladder is 1, 3, 7, 16, and 35 days, a retrieval the learner passed unaided moving up a rung and a miss dropping back one, both held inside the ladder at either end. Reporting both dates is what lets a session copy one rather than compute it, on the same reasoning that put quiz option order in `canon teach lesson`.

The field rides on the listing rather than on `canon teach lesson`, because a session needs the schedule before it has chosen what to teach and that verb takes a `--slug` naming a choice already made. An entry not written in the shape the standard fixes is skipped rather than reported, since a note carrying no date has no date to schedule.

## Open

`canon teach open` creates a workspace at the next ordinal and writes all three required files.

```bash
canon teach open regular-expressions \
  --subject "Reading and writing regular expressions" \
  --starting-point "Comfortable with the shell, has never written a group" \
  --success "Write a pattern matching a date" \
  --success "Explain what a backreference does"
```

| Option                    | Behavior                                                    |
| ------------------------- | ----------------------------------------------------------- |
| `--subject <line>`        | One line stating what the workspace covers, required        |
| `--starting-point <text>` | What the learner already knows, required                    |
| `--success <line>`        | Observable thing the learner will be able to do, repeatable |
| `--out-of-scope <line>`   | What the workspace does not cover, repeatable               |
| `--title <text>`          | Title, defaulting to the topic in sentence case             |
| `--date <YYYY-MM-DD>`     | Opening date, defaulting to today                           |
| `--json`                  | Emit a machine-readable record on stdout                    |
| `--root <path>`           | Teach root, defaulting to the main worktree                 |

The ordinal comes from the highest already present, incremented, so the caller derives no name and composes no path. A topic another workspace already covers is refused rather than opened beside it, since two workspaces on one subject fork the learning records the folder exists to keep whole.

`--starting-point` is required rather than defaulted because difficulty with no floor under it teaches nobody, and a mission written without one cannot say what the lessons sit above. At least one `--success` line is required for the same reason in the other direction: a mission nothing can test is a mission nothing can call finished.

## Resource

`canon teach resource` records sources in a workspace `RESOURCES.md`, keeping what was read apart from what was only found.

```bash
canon teach resource regular-expressions \
  --read "MDN regular expressions=https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions" \
  --lead "RE2 syntax=https://github.com/google/re2/wiki/Syntax"
```

| Option               | Behavior                                           |
| -------------------- | -------------------------------------------------- |
| `--read <title=url>` | Source that stands behind the material, repeatable |
| `--lead <title=url>` | Source found and not opened, repeatable            |
| `--json`             | Emit a machine-readable record on stdout           |
| `--root <path>`      | Teach root, defaulting to the main worktree        |

The pair splits on the first `=`, so a URL carrying its own separator survives intact. Say in the title which claims rest on the source, since the entry is the only place a later session reads that from. Which sources qualify is the source ladder in `canon standards teach`, and a source below its first two rungs also names why no higher one covers the claim.

A URL either heading already lists is refused rather than written twice. Two entries for one source split what rests on it across two lines, and a reader checking a claim then finds half of the answer. The exception is a `--read` URL already under `## Leads`, which moves to `## Read` under the title the call carries, since opening a lead is how it becomes read. A `--read` URL already under `## Read`, and any `--lead` URL already listed, stays refused, and a refusal leaves the whole batch unwritten.

A URL a file displays inside a fence does not count as listed, which is how a workspace quoting the entry format in its own prose is read as the sample it is.

## Glossary

`canon teach glossary` adds terms to a workspace `GLOSSARY.md`, alphabetically.

```bash
canon teach glossary regular-expressions \
  --term "capture group=A parenthesised part of a pattern whose match is kept" \
  --first-seen 0002-groups.html
```

| Option                     | Behavior                                                  |
| -------------------------- | --------------------------------------------------------- |
| `--term <term=definition>` | Term the subject defines, repeatable                      |
| `--first-seen <file>`      | Lesson or reference page the batch first defines these in |
| `--json`                   | Emit a machine-readable record on stdout                  |
| `--root <path>`            | Teach root, defaulting to the main worktree               |

One call writes one file, which keeps a batch of terms from racing on the glossary every one of them shares. `--first-seen` names one page for the whole batch rather than one per term, because a batch comes from one lesson.

A term already defined is refused rather than replaced. A definition the subject has moved under is a revision of the entry that exists, and nothing on the command line tells that apart from a second definition arriving by mistake.

The entry lands as the standard's shape, leading with the term as a bolded span. A definition not ending in sentence punctuation is terminated before the citation is appended, so a bare phrase does not run into the sentence naming where the term first appears.

## Lesson, render, and nav

`canon teach lesson`, `canon teach render`, and `canon teach nav` build and splice a lesson rather than editing a workspace's records. They are in `teach-authoring.md`.

## Opening a workspace

`canon teach up` runs the `nav` pass and then serves the teach root, so the page a reader opens carries the chrome the installed CLI generates:

```bash
canon teach up 03-fde-system-design --json
```

The link opens the named workspace's contents page, or the root listing when no topic is named. The verb serves the teach folder at its absolute path, so a run from a linked worktree still reaches the main worktree root. `--port` sets the first port tried and `--root` the teach root, as on every other verb. It runs until interrupted, so a session starts it in the background and reads the record off stdout.

The JSON record is one line carrying the `nav` fields, then `served`, the absolute folder, and the server's `host`, `port`, `entry`, `url`, and `entryExists`. A lesson `nav` skips lands in `skipped` and the server still starts, since a partial refresh is still worth viewing. A `nav` refusal starts no server.

While it runs, `up` watches the teach root. A change there, such as a lesson, a workspace, a glossary term, or a reference page added by hand or by another `teach` verb, runs the `nav` pass again, and every open page reloads once that pass changes what is served. Passes run one at a time, so a burst of saves costs one more pass rather than several at once. A pass `nav` refuses, such as one over a workspace deleted while it was served, is reported on stderr, the server keeps running, and no page reloads.

Each refresh is logged to stderr, so stdout stays the one record line. Dotfiles and editor backups ending in `~` start no pass.

The reload script is added to each page as the server sends it and never written to disk, so a page saved from the browser, a promoted lesson, and a committed fixture carry no trace of it. The script listens on `/__live`, which answers only a request naming the server by its loopback address or `localhost`.

Viewing writes. Every page and generated stylesheet `nav` owns is rewritten first, which on a committed fixture shows as a diff. To serve without rewriting anything, `canon teach list <topic>` ends its human output with a `canon serve` line for that workspace, with the teach folder written relative to the cwd, or absolute when it sits outside it. The JSON record of `list` carries no such field.

`canon serve` itself stays general, since nothing about serving a directory is specific to a learning workspace and the same verb carries a slide render and a design preview. What `up` adds in front of it is the refresh and the watch that repeats it, both teach-specific, and it serves through the same server rather than a second one.

Read `url` off the record rather than building one from the port that was asked for. The verb walks forward past a port already in use, which is routine when a second workspace is already open, and the port it took is the one thing a composed URL gets wrong.

## Refusal reasons

| Reason         | Raised when                                                     |
| -------------- | --------------------------------------------------------------- |
| `no-teach`     | The root carries no `.canon/teach/` folder                      |
| `no-workspace` | No workspace matches the topic, with the folder names as detail |
| `ambiguous`    | Two workspaces claim one topic, with both names as detail       |
| `exists`       | A workspace already covers the topic an open names              |
| `no-file`      | The workspace carries no file the verb writes into              |
| `no-section`   | `RESOURCES.md` carries no heading the entries belong under      |
| `listed`       | A URL is already read, or a lead is offered as listed           |
| `defined`      | A term already carries a glossary entry                         |
| `bad-input`    | The command line is malformed, before any folder is read        |

`up` also passes through the refusals `canon serve` raises once `nav` has run, `no-port` when every port in reach is taken and `bind-failed` for any other bind error, such as a privileged port, in the same record shape with the server's detail as `message`.

A `bad-input` refusal reports the working directory as its root rather than the resolved one, since the command line is rejected before the root is worth resolving. `lesson` raises it for a slug that is not kebab-case, for a quiz carrying no question, and for a question carrying fewer than two options, since a question with one option has nothing to confuse the right answer with.
