---
title: Config
description: Every file a project writes under canon/config/, the keys of each but app.toml, the starters init seeds, and what the Config gate stage fails and warns on
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

Never edit the last two by hand. Every key is optional unless its row says otherwise. `canon docs app-config` lists the `app.toml` keys, and this page lists the rest.

## What the gate checks

The shared `Config` stage of `canon gate run` reads every file in the folder against the keys on this page and the app config page. It judges names and types, and each reader keeps its own deeper checks.

- A file that is not valid TOML, a key canon does not read, and a value of the wrong type fail the stage, naming the file and the dotted key
- A key written above every table header lands at the top level, so the stage names the table it belongs under
- A file canon does not read warns, and so does one a migration folded into another, naming the verb that moves it

The files `canon migrate app-config` folds into `app.toml` are `app-drive.toml`, `preview.json`, `local.toml`, `painted.json`, and `device-classes.toml`. A reader still takes each one until `app.toml` holds its table.

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
