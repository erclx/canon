---
title: Sessions transfer
description: Moving a session to another machine with export and import, the manifest fields, the refusal reasons, and what a resume on the target depends on
kind: reference
---

# Sessions transfer

`canon sessions export` packs one session into a gzip tarball, and `canon sessions import` places it under this machine's configuration directory so `claude` can resume it.

```bash
canon sessions export <id> --out ~/session.tar.gz --json
canon sessions import session.tar.gz --root ~/repos/canon --json
```

Run `canon sessions export --help` and `canon sessions import --help` for every flag.

## Output

Export writes the transcript, its side folder, and a manifest to `.canon/tmp/session-export/<id>.tar.gz` unless `--out` says otherwise. It never uploads. A transcript can hold credentials printed in the session, so treat the bundle as private.

The manifest names the session, its `branch` and `head`, and these fields:

- `live`: whether the id was live in the roster at export
- `handoff` and `handoffCommitted`: the newest `.canon/compact/` note since the session began, and whether the records history holds it
- `recommend`: `handoff` where one exists, `transcript` otherwise, since a transcript carries the source machine's absolute paths

Import writes new files only. The record's `behind` list carries `repository-behind` when this checkout lacks the exported `HEAD`, and `records-behind` when `canon records pull` has records to bring. Neither refuses. Its two `routes` are `claude --resume <id>` and a fresh `claude` running `/canon:session-resume`.

Resuming while the source keeps running forks the conversation, and only `live` warns of it.

## Refusals

Branch on `reason` in the record, not the exit code.

| Reason             | Meaning                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| `not-found`        | Export found no transcript for the id                                                 |
| `not-a-bundle`     | No gzip tarball, no manifest at format `1`, or a path outside itself                  |
| `other-repository` | The local `origin` differs from the one the bundle recorded                           |
| `exists`           | The transcript or side folder is already here, or another project folder holds the id |
| `live-here`        | The id is live in the local roster, so a second copy would fork it                    |
| `write-failed`     | A write failed partway. The run removes what it placed before refusing                |
| `no-archive`       | The running Bun predates `Bun.Archive`                                                |

## See also

- `canon sessions list --help`: the roster these verbs check an id against
- `canon:session-compact` and [records push](records.md): write and back up a handoff before export
