---
title: Records
description: Backing the record folders to a private remote, restoring them on a new machine, reading folder size, and pruning stale scratch
kind: reference
---

# Records

`canon records` backs the record folders under `.canon/` to a private remote and reports on them. `canon hooks post-merge` runs `push` after every merge.

```bash
canon records push
canon records pull
canon records size --json
canon records prune-tmp --older-than 30
```

Run `canon records <verb> --help` for every flag.

## Output

Set the history up once per machine, pointed at a private repository that is not a remote of the project.

```bash
git --git-dir=.canon/.records.git init
git --git-dir=.canon/.records.git remote add origin <private-repo-url>
printf '.canon/\n' >> .gitignore
```

- `push` commits every top-level folder under `.canon/` except `tmp`, `ordinal-locks`, and `.records.git`, then pushes. New folders list under `added`.
- `pull` restores the folders on a new machine after the setup above. It refuses rather than overwrite records the history lacks.
- `size` reports one row per folder, heaviest first, with file count, bytes, and growth over 7 and 30 days. After a `pull` every file reads as new.
- `prune-tmp` lists scratch untouched for 14 days and deletes it only with `--write`. It never offers `tmp/handoff/` or `tmp/pr/poll/`.

`push` blocks a file over 25 MB or one `canon secrets scan` would report, listing it under `blocked`. Move it out of the record folders, then push again.

Every verb exits `0` when done and `1` when refused. `prune-tmp` exits `2` when candidates exist and `--write` was not passed.

## Refusals

Branch on `reason` in the `--json` record, not the exit code.

| Reason              | Meaning                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `no-folder`         | The project holds neither record root, from `size` or `prune-tmp`              |
| `split-roots`       | Record folders sit under both roots. Finish the move or put them back together |
| `no-repository`     | No `.canon/.records.git`. Run the setup above                                  |
| `no-remote`         | The records history has no `origin`                                            |
| `remote-unreadable` | The project's own remotes could not be read                                    |
| `remote-shared`     | The records origin is also a remote of the project. Use a private repository   |
| `no-remote-records` | `pull` found no branch on the records origin                                   |
| `local-changes`     | `pull` found records on disk that the history lacks. Run `push` first          |
| `local-ahead`       | `pull` found local commits that never reached the origin. Run `push` first     |
| `unsafe-payload`    | `push` found a file over 25 MB or carrying a credential                        |
| `git-failed`        | A git call failed, with its stderr in the message                              |

## See also

- `canon records ordinal <kind> <slug> --claim`: reserve the next intake or groundwork ordinal
- `canon records validate <kind> [record] --help`: where a record disagrees with its standard, plus a `structure` report that never sets the exit
- `canon records stale --help`: when the requirements and design records were last reviewed
