---
title: App drive config
description: The [drive] table of canon/config/app.toml, its keys launch, data, personas, scripts, access, proposals, board-project, and board-folder, the script format, the named targets that let one table drive several apps, the app-drive.toml it replaced, and what a drive does when the table is absent
---

# App drive config

Read at Step 1 of `app-drive`, and cited by every skill that drives the app. A project describes how its app is driven in the `[drive]` table of `canon/config/app.toml`, which the drive reads and never writes.

```toml
[drive]
launch = "bun install --frozen-lockfile && bun run build && PREVIEW_PORT=4530 bun run preview"
data = "fixtures/demo-board"
personas = ["a designer laying out a board", "an agent calling the CLI"]
scripts = ["canon/drive/basics.md"]
access = "/api/access/open"
proposals = ".canon/picks"
board-project = "drive-<nn>"
board-folder = "Drives"
```

## Keys

`canon docs app-config` lists every `[drive]` key with its type and default. The bullets below carry what a drive does with them that a key list cannot hold.

- `launch` runs from the worktree root and names the port it serves on, so `canon pr local --root` finds it
- `personas` covers an agent or API caller as well as a person in the UI, when the app has one
- An absent `data` means the app starts empty, and an absent `proposals` means the frames stay in the intake folder's `evidence/`
- `access` is read by `ui-film` and `review-ui`, which open their address behind it, and a drive ignores it
- A fallback mock is the standalone HTML a decided finding's frames are lifted into when the copy cannot host them

### Scripts

`scripts` is optional, and a config naming none drives as it did. It holds the basics a drive should run the same way every time, which a goal turned into a step does not, since each drive words the step afresh.

A script is a tracked markdown file the project writes. It takes one H2 per scenario, numbered steps under it, and one `Check:` line naming what a pass looks like.

```markdown
## Open a board

1. Open the app at its address
2. Create a board named `drive`
3. Add one frame and rename it

Check: the frame keeps its name after a reload
```

- A path resolves from the project root, never the worktree's `root`
- A path naming no file is recorded `not-driven` with the reason, and the drive goes on
- `canon intake drive-check` reads the same key for the same target, so a script the config names and the drive skipped fails the check

### The board key

`board-project` is optional and defaults to `drive-<nn>`. A drive asks about it only when the board holds a versioned project of the stem, such as `landing-v2`, as Step 1 states, so `drive-<nn>` never triggers it.

- Naming the key opts the project in, even with no board yet, while omitting it leaves the call to whether `.canon/board/` exists
- Keep `<nn>` in a value you set, since one project across drives loses which frames came from which
- The board's root is `.canon/board/` at the main root and never a key here, since a second root setting would let `app-drive` and `design-pick` disagree on which board they draw on

`board-folder` is optional and defaults to `Drives`, so every drive's project sits in one home folder beside the others. Set it to another name to file a project's drives apart, or to an empty string to leave each drive's project loose on home. `board.md` under `design-pick`'s references states the call that files it.

## Named targets

A repository shipping a second app, such as a site under `web/` beside the app at the root, names it as a target. The flat keys stay the default target, so a file holding none drives as it did and asks nothing new.

```toml
[drive]
launch = "bun install --frozen-lockfile && bun run build && PREVIEW_PORT=4530 bun run preview"
personas = ["a designer laying out a board"]

[drive.targets.web]
root = "web"
launch = "bun install --frozen-lockfile && bun run build && bun run preview"
personas = ["a developer reading the landing page"]
board-project = "landing-<nn>"
```

A `[drive.targets.<name>]` table takes the flat keys and one more.

- `root` is the folder inside the worktree the target's `launch` runs from, defaulting to the worktree root
- A key the table leaves out falls back to the flat key of the same name, except `board-project`
- A table may name its own `scripts`, and one leaving the key out runs the flat list
- A target's `board-project` defaults to `<name>-<nn>`, such as `web-<nn>`, while the flat default stays `drive-<nn>`
- A static site with no health path reaches `canon pr local` through `page-only` under `[health]` in `canon/config/app.toml`, so a target carries no health key

Step 1 asks which target a drive runs when the table names any, with the default target among the options.

## The file it replaced

A project that has not run `canon migrate app-config` holds the same keys at the top of `canon/config/app-drive.toml`, with its targets as `[targets.<name>]`. Read that file only when `app.toml` holds no `[drive]` table, and name the move to the operator once.

- A line commented out is no key, so an `app.toml` whose `[drive]` lines are all commented holds no table
- A table in `app.toml` wins over the old file beside it

## When the table is absent

Ask the operator for `launch`, `data`, and `personas` once, before the copy is built, putting each through the structured question surface with a proposed default read off the project's manifest and requirements record.

- Propose the manifest's own build and preview scripts as `launch`
- Propose the requirements record's named users as `personas`
- Hand the operator the `[drive]` table's text at the close, since the first drive in a project is where the config gets found. The drive never writes it, because the file is tracked.
