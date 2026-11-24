---
title: Config
description: Every file a project writes under canon/config/, each key with its type, default, and reader, the commented starters init seeds, and what the Config gate stage fails and warns on
---

# Config

A project configures canon through files under `canon/config/`. `canon init` seeds a commented starter for `app.toml` and `context.toml` beside the label map, and an unedited starter reads exactly as no file does. Uncomment a table header and the keys under it to turn a setting on.

| File             | Holds                                                   | Seeded              |
| ---------------- | ------------------------------------------------------- | ------------------- |
| `app.toml`       | How canon drives, previews, captures, and films the app | Commented starter   |
| `context.toml`   | What `canon context audit` covers and gates             | Commented starter   |
| `pr-labels.toml` | The labels `git-pr` adds to a pull request              | Starter rows        |
| `markdown.toml`  | The markdown paths whose density findings fail the gate | Written by its verb |
| `config.json`    | The installed version and stacks                        | Written by canon    |
| `baseline.json`  | The audit baseline                                      | Written by canon    |

Never edit the last two by hand. Every key below is optional unless its row says otherwise.

## What the gate checks

The shared `Config` stage of `canon gate run` reads every file in the folder against the keys on this page. It judges names and types, and each reader keeps its own deeper checks.

- A file that is not valid TOML, a key canon does not read, and a value of the wrong type fail the stage, naming the file and the dotted key
- A key written above every table header lands at the top level, so the stage names the table it belongs under
- A file canon does not read warns, and so does one a migration folded into another, naming the verb that moves it

The files `canon migrate app-config` folds into `app.toml` are `app-drive.toml`, `preview.json`, `local.toml`, `painted.json`, and `device-classes.toml`. A reader still takes each one until `app.toml` holds its table.

## app.toml

One table per concern. A table left out, or present only as comments, reads as absent, and every reader falls back to the old file beside it.

### [drive]

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

### [preview]

Read by `canon pr drive-copy` and `canon pr local`, so a reviewer's preview runs on a fresh copy of the folders the server writes.

| Key      | Type        | Default               | Holds                                                           |
| -------- | ----------- | --------------------- | --------------------------------------------------------------- |
| `writes` | string list | required              | Folders a running preview saves into                            |
| `keep`   | string list | none                  | Paths inside `writes` a rebuild leaves as the server wrote them |
| `seed`   | string list | none                  | An argv that lays demo state into the copy                      |
| `env`    | string      | `CANON_PREVIEW_ROOT`  | The variable the server reads for the copy's root               |
| `serve`  | string list | none                  | An argv starting a fresh server per review pass                 |
| `port`   | integer     | required with `serve` | The port that server takes before the worktree offset           |

### [health]

Read by `canon pr local` before it posts a local preview link.

| Key         | Type        | Holds                                              |
| ----------- | ----------- | -------------------------------------------------- |
| `paths`     | string list | Paths that must answer, each starting with one `/` |
| `page-only` | string list | Folders whose server has no health path            |

### [painted]

Read by `canon pr evidence`, `ui-checklist`, and the capture gates, to decide whether a diff changes something a person sees.

| Key           | Type        | Holds                                                    |
| ------------- | ----------- | -------------------------------------------------------- |
| `paths`       | string list | Globs that count as a visible change, beside canon's own |
| `exclude`     | string list | Globs that never do                                      |
| `reel-inputs` | string list | Other files a filmed reel depends on                     |

### [device-classes]

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

## context.toml

Read by `canon context audit` and the `Context citations` gate stage. `canon docs context-audit` covers what each check does with these keys.

| Key           | Type        | Default          | Holds                                                                 |
| ------------- | ----------- | ---------------- | --------------------------------------------------------------------- |
| `roots`       | string list | `src` if present | Code folders or globs the context entries must cover, `[]` to opt out |
| `gated`       | string list | canon's own      | Path prefixes whose entries fail the gate on a shape break            |
| `gate-length` | boolean     | `false`          | Fail an entry past the line checkpoint                                |

## pr-labels.toml

Read by `git-pr`, `canon labels sync`, and `canon labels audit`. Each `[domains]` key is a label, and each `[declined]` key is the reason its paths earn none. Matching is prefix-anchored.

A domain row takes one of two forms. The list form names its path prefixes, and the table form adds the `color` that `canon labels sync` creates the label with, as six hex digits.

```toml
[domains]
docs = ["docs/", "README.md"]
app = { paths = ["src/"], color = "1f6feb" }

[declined]
release-managed = ["CHANGELOG.md"]
```

## markdown.toml

Read by `canon markdown audit`, and written by `canon markdown gated add`, which adds a path only when every file under it passes. The file holds one `[markdown]` table.

| Key     | Type        | Holds                                                              |
| ------- | ----------- | ------------------------------------------------------------------ |
| `gated` | string list | Paths whose density findings fail the gate, a folder ending in `/` |
