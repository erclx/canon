---
title: App drive config
description: The canon/config/app-drive.toml keys launch, data, personas, and proposals, and what a drive does when the file is absent
---

# App drive config

Read at Step 1 of `app-drive`. A project describes how its app is driven in `canon/config/app-drive.toml`, which the drive reads and never writes.

```toml
launch = "bun install --frozen-lockfile && bun run build && PREVIEW_PORT=4530 bun run preview"
data = "fixtures/demo-board"
personas = ["a designer laying out a board", "an agent calling the CLI"]
proposals = ".canon/picks"
```

## Keys

| Key         | Holds                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| `launch`    | The shell command that installs, builds, and serves the app in a worktree |
| `data`      | A fixture path inside the worktree to load before serving, if any         |
| `personas`  | Who uses the app, each driven through every goal                          |
| `proposals` | The folder a taste finding's now frame and fix frame go to                |

Three of the keys carry a reading the table cannot hold.

- `launch` runs from the worktree root and names the port it serves on, so `canon pr local --root` finds it
- `personas` covers an agent or API caller as well as a person in the UI, when the app has one
- An absent `data` means the app starts empty, and an absent `proposals` means the frames stay in the intake folder's `evidence/`

## When the file is absent

Ask the operator for `launch`, `data`, and `personas` once, before the copy is built, putting each through the structured question surface with a proposed default read off the project's manifest and requirements record.

- Propose the manifest's own build and preview scripts as `launch`
- Propose the requirements record's named users as `personas`
- Hand the operator the file's text at the close, since the first drive in a project is where the config gets found. The drive never writes it, because the file is tracked.
