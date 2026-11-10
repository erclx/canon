---
title: App drive config
description: The canon/config/app-drive.toml keys launch, data, personas, proposals, and board-project, the named targets that let one file drive several apps, and what a drive does when the file is absent
---

# App drive config

Read at Step 1 of `app-drive`. A project describes how its app is driven in `canon/config/app-drive.toml`, which the drive reads and never writes.

```toml
launch = "bun install --frozen-lockfile && bun run build && PREVIEW_PORT=4530 bun run preview"
data = "fixtures/demo-board"
personas = ["a designer laying out a board", "an agent calling the CLI"]
proposals = ".canon/picks"
board-project = "drive-<nn>"
```

## Keys

| Key             | Holds                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| `launch`        | The shell command that installs, builds, and serves the app in a worktree |
| `data`          | A fixture path inside the worktree to load before serving, if any         |
| `personas`      | Who uses the app, each driven through every goal                          |
| `proposals`     | The folder for an undecided taste finding's frames and a fallback mock    |
| `board-project` | The board project a drive draws in, where `<nn>` is the intake ordinal    |

Some of the keys carry a reading the table cannot hold.

- `launch` runs from the worktree root and names the port it serves on, so `canon pr local --root` finds it
- `personas` covers an agent or API caller as well as a person in the UI, when the app has one
- An absent `data` means the app starts empty, and an absent `proposals` means the frames stay in the intake folder's `evidence/`
- A fallback mock is the standalone HTML a decided finding's frames are lifted into when the copy cannot host them

### The board key

`board-project` is optional and defaults to `drive-<nn>`. A drive asks about it only when the board holds a versioned project of the stem, such as `landing-v2`, as Step 1 states, so `drive-<nn>` never triggers it.

- Naming the key opts the project in, even with no board yet, while omitting it leaves the call to `canon/config/design.toml` or `.canon/board/`
- Keep `<nn>` in a value you set, since one project across drives loses which frames came from which
- The board's root comes from `canon/config/design.toml` and never from this file, since a second root setting would let `app-drive` and `design-pick` disagree on which board they draw on

## Named targets

A repository shipping a second app, such as a site under `web/` beside the app at the root, names it as a target. The flat keys stay the default target, so a file holding none drives as it did and asks nothing new.

```toml
launch = "bun install --frozen-lockfile && bun run build && PREVIEW_PORT=4530 bun run preview"
personas = ["a designer laying out a board"]

[targets.web]
root = "web"
launch = "bun install --frozen-lockfile && bun run build && bun run preview"
personas = ["a developer reading the landing page"]
board-project = "landing-<nn>"
```

A `[targets.<name>]` table takes the five keys above and one more.

- `root` is the folder inside the worktree the target's `launch` runs from, defaulting to the worktree root
- A key the table leaves out falls back to the flat key of the same name, except `board-project`
- A target's `board-project` defaults to `<name>-<nn>`, such as `web-<nn>`, while the flat default stays `drive-<nn>`
- A static site with no health path reaches `canon pr local` through `page-only` in `canon/config/local.toml`, so a target carries no health key

Step 1 asks which target a drive runs when the file names any, with the default target among the options.

## When the file is absent

Ask the operator for `launch`, `data`, and `personas` once, before the copy is built, putting each through the structured question surface with a proposed default read off the project's manifest and requirements record.

- Propose the manifest's own build and preview scripts as `launch`
- Propose the requirements record's named users as `personas`
- Hand the operator the file's text at the close, since the first drive in a project is where the config gets found. The drive never writes it, because the file is tracked.
