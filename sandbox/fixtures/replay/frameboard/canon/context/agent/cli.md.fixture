---
title: CLI
description: The commands agents run, the docs verb, the frameboard skill, and the plugin hook
---

# CLI

## Overview

Owns the agent interface, being every verb an agent or script runs, the `docs` verb that prints the facts about them, and the `frameboard` skill, check hook, and inbox monitor shipped as a Claude Code plugin. Anything the mouse does on the board, a verb does too.

## Layout

### `src/cli/`

Owns the program and the conventions every verb shares, with `index.ts` bundled to `dist/cli.js` and `hook.ts` to `dist/hook.js`, the check hook's own entry.

- Every verb takes `--json` and `--root`, exits with a stable code, and never prompts, because an agent cannot answer a prompt
- With `--json`, stdout carries one envelope, `{ ok, data }` or `{ ok, error }`, even on a parse error, and each error code keeps one exit in `src/shared/errors.ts`
- A page ref is `<page>` or `<project>/<page>`, a frame ref adds `/<frame>`, and an argument ending in `.html` is the frame file itself
- A verb given no project takes the board's only project, else fails `project-required`, since guessing would write to the wrong one
- Every `edit` refusal exits 7 with its reason as the code, so a script tells a refused edit from a missing frame

### `src/cli/commands/`

Owns one module per verb group, with flags and JSON shapes in `frameboard docs`. `selection`, `notes`, `inspect`, `check`, and `capture` report, `edit` sets one property on one element leaving every other byte alone, and `editing` claims frames.

- `serve` records its address in the board folder, and a second `serve` on a live board prints that address with `reused: true` and binds nothing
- A fresh `serve` waits up to one second for an old writing tab to reconnect, and opens one only when no writing tab is connected, so `opened` is true exactly when this call opened one
- The tab `serve` opens carries a single-use redeem URL, never in the JSON envelope's `url`, and a tab typed in by hand reads but cannot write
- `show` points every open board tab at a frame and exits 3 with `server-not-running` rather than start a server
- `selection` prints what the last writing tab reported selecting, the element in the address `edit --index --hash` takes, and exits 3 with `server-not-running` when no server holds one

The structure verbs reshape projects, pages, and frames.

- `project`, `page`, and `frame` add, duplicate, rename, move, and delete, and `duplicate` and `move` take a target page in any project
- `move` with `--x` and `--y` and no `--to` writes `layout.json` alone, so a move never collides with an agent rewriting the file

### `src/cli/inbox/`

Owns the follower `inbox --follow` runs, apart from `commands/` since it holds a long-lived loop rather than a verb. The program reads flags positionally, so `notes` keeps its flags apart from `reply` and `done`.

- It upgrades the live socket with the address token as a bearer, and the hub takes an `inbox` hello from no other socket, the board's cookie included, so a browser page never registers as a listener
- It waits quietly for a board and a server and retries every 500 ms like a board tab, printing nothing until a note arrives
- It sends `claude · ` and the project folder's name as its tag, and the server shows a session id's first 6 characters instead when two listeners share one
- It acks a note only after printing it, so one killed between the two prints it again on its next start, and acking first would lose it instead
- `notes`, `notes reply`, and `notes done` write `notes.json` with no server, and `inbox` defaults `--session` to `CLAUDE_CODE_SESSION_ID`

### `plugins/frameboard/`

Owns the `frameboard` skill, the check hook, and the inbox monitor, with `lib/resolve.sh` the install lookup the hook and the monitor share.

- The lookup takes the project's `node_modules` install, then its own `dist/` when its `package.json` names `frameboard`, then the install on PATH, so the checkout checks itself

- The skill holds judgment and carries no verb table or rule list, so it cannot drift from the installed tool, and `docs` holds the facts
- The skill follows the Agent Skills format and the hook is a thin call into a CLI entry, so another agent needs only its own manifest
- The monitor runs `inbox --follow`, and Claude Code hands each line to the session as an event, so a sent note is acted on at once with no MCP server
- The board sends a note to the session holding the frame's claim while it listens, else to the only listening session, else to the one the developer picks

`editing` writes `.run/claims.json` under the record lock with no server, and `--release` drops one claim or all of the session's. The claim is also what names the agent on the board's change toast. Its `--session` and `--agent` default to `CLAUDE_CODE_SESSION_ID` and `claude` through `src/cli/session.ts`, which `notes` and `inbox` share.

- A claim is cooperative, so another live session's claim refuses `frame-claimed` with exit 4, and it lapses five minutes after the last `editing`
- The developer's hand edit on a held frame waits in the board until the claim drops, and the server refuses one sent anyway

## Gotchas

- The inbox monitor starts with `when: "always"`, because with `on-skill-invoke` it never started in the spike
- Claude Code runs plugin monitors only in interactive sessions and not on Bedrock, Google Cloud, or Foundry, where a sent note waits as a pinned one
- `frame fit` sets height only, ignores what a cropping ancestor hides, and reports too-wide content. It refuses `fit-unbounded` for content sized off the viewport, like `min-height: 100vh`
- The hook runs the installed check directly, preferring Bun and never a package runner, which costs about ten times the check on every write
- `--no-open` opens nothing on either `serve` path, which is how tests, `preview`, and capture run, so a test never launches a browser on the developer's screen
