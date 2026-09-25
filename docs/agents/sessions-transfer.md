---
title: Sessions transfer
description: Moving a session to another machine, the export bundle and its manifest, placing it with import, the refusal reasons, and what a resume on the target depends on
---

# Sessions transfer

The roster these verbs check an id against is in `sessions.md`.

## Export

`canon sessions export <id>` packs one session into a single gzip tarball so it can resume on another machine. The bundle holds the transcript, its side folder with every path kept, and a manifest.

```bash
canon sessions export <id>
canon sessions export <id> --out ~/session.tar.gz --json
```

| Option         | Behavior                                                   |
| -------------- | ---------------------------------------------------------- |
| `--out <path>` | Write the bundle here rather than under the scratch folder |
| `--json`       | Add a machine-readable record on stdout                    |

Without `--out` the bundle lands at `.canon/tmp/session-export/<id>.tar.gz` under the main worktree root, which is gitignored and reclaimed by `canon records prune-tmp`. It writes locally and never uploads. A transcript holds whatever tool output passed through the session, credentials included where one was printed, so treat the bundle as private.

Exit codes: `0` the bundle was written, `1` refused. The refusal carries a `reason` of `not-found`, where no project folder holds a transcript for the id, or `no-archive`, where the running Bun predates `Bun.Archive`.

The lookup walks every folder under the configuration directory's `projects/`, so a transcript filed under any encoding is found. The transcript is read up to its last newline and never rewritten, so a session exporting itself mid-append drops at most the half line it was writing.

Export runs no skill. Write a handoff with `canon:session-compact` and push it with `canon records push` first where one is wanted. The manifest reports whether a handoff exists and whether it reached the records history, and whatever calls the verb owns that order.

### The manifest

| Field              | Holds                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| `format`           | The bundle format version, `1`                                               |
| `sessionId`        | The exported id                                                              |
| `title`            | The last custom title the transcript recorded, or `null`                     |
| `cwd`              | The last working directory the transcript recorded, or `null`                |
| `root`             | The main worktree root of the repository the export read                     |
| `origin`           | The `origin` remote reduced to `host/path`, or `null`                        |
| `branch`, `head`   | The branch and commit of the checkout the export ran in                      |
| `recordsHead`      | The records history `HEAD`, or `null` where no records history exists        |
| `compacted`        | Whether the transcript carries a compaction boundary                         |
| `live`             | Whether the id was live in the roster at export                              |
| `handoff`          | The newest `.canon/compact/` note written since the session began, or `null` |
| `handoffCommitted` | Whether that note is committed in the records history                        |
| `recommend`        | `handoff` where a handoff exists, `transcript` otherwise                     |

`recommend` prefers the handoff even though the transcript resumes in full. A resumed transcript carries the source machine's absolute paths into a session working somewhere else, and a handoff states the work without them.

## Import

`canon sessions import <bundle>` places an exported session under this machine's configuration directory so `claude` can resume it.

```bash
canon sessions import session.tar.gz
canon sessions import session.tar.gz --root ~/repos/canon --json
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--root <path>` | The repository to resume in. Defaults to the main worktree |
| `--json`        | Add a machine-readable record on stdout                    |

The transcript and side folder land under `projects/<encoding>/`, where the encoding is the root with every character outside `[A-Za-z0-9]` turned into a dash. Import writes new files only and never overwrites.

Exit codes: `0` the session was placed, `1` refused. The refusal carries one of these reasons:

- `not-a-bundle`: the file is no gzip tarball, carries no manifest at format `1`, or names a path outside its own session, such as one climbing out with `..` or an absolute one
- `other-repository`: the local `origin` differs from the one the bundle recorded
- `exists`: the target transcript or side folder is already there, or any other project folder already holds a transcript for the id, which `--resume <id>` could reach first
- `live-here`: the id is live in the local roster, so a second copy would fork it
- `write-failed`: a write failed partway for a reason other than a copy appearing, such as a bundle carrying a file where it also needs a folder
- `no-archive`: the running Bun predates `Bun.Archive`

A write that fails partway removes every file this run placed and every folder it created before refusing, so a retry of the same bundle does not refuse on its own leftovers. Any path it could not remove is named in the message. A copy that appears between the existence check and the write refuses as `exists` on the same terms.

A placed session can still lag the source. The record's `behind` list carries `repository-behind` when this checkout lacks the exported `HEAD`, and `records-behind` when the records history lacks the exported records commit, which `canon records pull` brings. Neither refuses, since each has a remedy the reader runs before resuming.

On success the record carries two `routes`. One runs `claude --resume <id>` from the root, and the other starts `claude` there and runs `/canon:session-resume` bare against the handoff.

### What resume depends on

Measured on `claude` 2.1.281 on 2026-09-24, `--resume <id>` found a copied transcript in any folder under `projects/` and chained the next turn onto its full history, run from a repository path the transcript never recorded. `--continue` found it only under the local encoding, which is why import derives the folder rather than keeping the source machine's.

The encoding is inferred from observed folders rather than read from a published rule, and how a client shortens a path past its length limit was never observed. A client changing the rule leaves `--continue` looking elsewhere while `--resume <id>` still works. The framed report names the derived folder so a reader can compare.

The side folder did not change the conversation sent. What it carries is `tool-results/`, which a `persisted-output` pointer in the transcript names by the source machine's absolute path, and `subagents/`, which holds background agent transcripts. On a machine whose path matches, those pointers resolve. On one whose path differs, they dangle.

Resuming on the target while the source session keeps running forks the conversation, and nothing detects that across machines. The manifest's `live` field and the printed routes are the only warning.
