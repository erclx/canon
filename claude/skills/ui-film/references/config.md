---
title: UI film config
description: What a take reads from canon/config/app-drive.toml, the access key it adds, and what to ask when the file is absent
---

# UI film config

Read at Step 1 of `ui-film`. A take shares its project's drive config at `canon/config/app-drive.toml` rather than keeping a second file, since both build and serve the same app. The skill reads the file and never writes it.

```toml
launch = "bun install --frozen-lockfile && bun run build && PREVIEW_PORT=4530 bun run preview"
data = "fixtures/demo-board"
access = "/write?token=demo"
```

## Keys a take reads

| Key      | Holds                                                                  |
| -------- | ---------------------------------------------------------------------- |
| `launch` | The command that installs, builds, and serves the app in a worktree    |
| `data`   | A fixture path inside the worktree to load before serving, if any      |
| `access` | The path or address that opens the app in the state a take starts from |

`access` is optional and belongs to the take alone. A drive ignores it.

- Join a path value, one starting with `/`, to the served address. Take a full address as it stands.
- Use it for whatever the app needs before its start state shows, such as a write link, a signed-in route, or a demo token
- An absent `access` opens the served root
- `personas` and `proposals` belong to `app-drive`, and a take reads neither

### Single-use access

Every beat opens the address fresh in its own browser, so a link the app honors once, such as a single-use edit ticket, serves one beat alone. A beat that falls back to the screencast opens the address a second time, so the fallback spends the link too, even within one beat.

- Point `access` at a local redirect minting a fresh link per request, so each open gets its own, the one pattern that held across beats and fallbacks alike
- Run `canon take` once per beat with a freshly minted link only where no redirect can be served, with `"route": "screencast"` on each so no fallback reopens it

## When the file is absent

Ask the operator for `launch`, `data`, and `access` once, before the copy is built, putting each through the structured question surface with a proposed default.

- Propose the manifest's own build and preview scripts as `launch`
- Propose no `data` unless the project carries a fixture folder named for demos
- Propose the served root as `access`
- Hand the operator the file's text at the close. The skill never writes it, because the file is tracked.
