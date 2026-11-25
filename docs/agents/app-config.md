---
title: App config
description: Every table and key in canon/config/app.toml, being how canon drives, previews, and films the app and which device classes it supports
---

# App config

One table per concern. A table left out, or present only as comments, reads as absent, and every reader falls back to the old file beside it.

## [drive]

Read by `app-drive`, `ui-film`, `review-ui`, and `canon intake drive-check`, to start the app in a worktree and open it.

| Key             | Type        | Default       | Holds                                                         |
| --------------- | ----------- | ------------- | ------------------------------------------------------------- |
| `launch`        | string      | asked         | The shell command that installs, builds, and serves the app   |
| `data`          | string      | none          | A fixture path in the worktree to load before serving         |
| `personas`      | string list | asked         | Who uses the app, each driven through every goal              |
| `access`        | string      | served root   | A path or address opening the app's start state               |
| `scripts`       | string list | none          | Scenario files a drive runs once per persona before any goal  |
| `proposals`     | string      | intake folder | Where an undecided taste finding's frames go                  |
| `board-project` | string      | `drive-<nn>`  | The board project a drive draws in, `<nn>` the intake ordinal |
| `board-folder`  | string      | `Drives`      | The board's home folder the project files under               |

A second app in the same repository takes a `[drive.targets.<name>]` table holding the keys above and `root`, the folder its `launch` runs from. A key it leaves out falls back to the flat key, except `board-project`, which defaults to `<name>-<nn>`.

```toml
[drive]
launch = "bun run build && bun run preview"
personas = ["a designer laying out a board"]
access = "/"

[drive.targets.web]
root = "web"
launch = "bun run build && bun run preview"
```

## [preview]

Read by `canon pr drive-copy` and `canon pr local`, so a reviewer's preview runs on a fresh copy of the folders the server writes.

| Key      | Type        | Default               | Holds                                                           |
| -------- | ----------- | --------------------- | --------------------------------------------------------------- |
| `writes` | string list | required              | Folders a running preview saves into                            |
| `keep`   | string list | none                  | Paths inside `writes` a rebuild leaves as the server wrote them |
| `seed`   | string list | none                  | An argv that lays demo state into the copy                      |
| `env`    | string      | `CANON_PREVIEW_ROOT`  | The variable the server reads for the copy's root               |
| `serve`  | string list | none                  | An argv starting a fresh server per review pass                 |
| `port`   | integer     | required with `serve` | The port that server takes before the worktree offset           |

## [health]

Read by `canon pr local` before it posts a local preview link.

| Key         | Type        | Holds                                              |
| ----------- | ----------- | -------------------------------------------------- |
| `paths`     | string list | Paths that must answer, each starting with one `/` |
| `page-only` | string list | Folders whose server has no health path            |

## [painted]

Read by `canon pr evidence`, `ui-checklist`, and the capture gates, to decide whether a diff changes something a person sees.

| Key           | Type        | Holds                                                    |
| ------------- | ----------- | -------------------------------------------------------- |
| `paths`       | string list | Globs that count as a visible change, beside canon's own |
| `exclude`     | string list | Globs that never do                                      |
| `reel-inputs` | string list | Other files a filmed reel depends on                     |

## [device-classes]

Read by the screenshot harness, `canon design classes`, and the `Device classes` gate stage. Without the table a project supports phone, tablet, and desktop.

| Key       | Type        | Holds                                                                     |
| --------- | ----------- | ------------------------------------------------------------------------- |
| `default` | string list | The classes every surface supports, from `phone`, `tablet`, and `desktop` |
| `why`     | string      | The reason, required whenever `default` is set                            |

A surface that differs takes a `[device-classes.scopes.<name>]` table holding `groups`, `paths`, `classes`, and a `why`. A changed path matches a scope by a prefix or by sitting under `canon/design/<group>/`.

```toml
[device-classes]
default = ["desktop"]
why = "The board is a canvas"

[device-classes.scopes.landing]
paths = ["web/"]
classes = ["phone", "tablet", "desktop"]
why = "The landing page meets phones first"
```
