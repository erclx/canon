---
name: internal-canvas
description: The canvas server, its browser shell, and the verbs behind them. Use for `src/canvas/`, `src/commands/canvas.ts`, or any `canon canvas` verb.
---

# Canvas

Read `canon/context/features/canvas.md` for the layout, the content format, token resolution, and the decisions behind the surface before editing. `docs/agents/canvas.md` is the verb reference.

The canvas exists for Claude to draw frames the operator reviews. Do not add new design-tool features unless the operator asks.

## Working against the canvas

- Pass `--root <provisioned dir>` to every verb and never point at `.canon/canvas/`. Selecting an element writes a real selection, so a test run against the live root changes what the operator has open.
- Expect `canvas serve` to refuse with `missing-client-deps` in a fresh worktree, and run the `bun install` its detail names. Check the live shell as well as the captures, since a shell that builds wrong still passes every capture.
- Drive the shell through `src/canvas/shell.e2e.test.ts` and wait on `load`, never `networkidle`. The page holds a connection open, so `networkidle` never settles. The suite skips where no browser binary exists, so run it locally before a shell change ships.
- Post evidence for every change to the shell. Commit the walk's states for the change to `assets/evidence/canvas/<area>/`, the area folder (`arrange`, `inspector`, `layers`, or `shell`) its walk exercises, post them with `canon pr evidence` and a short checklist of what to look at, then serve the branch's canvas from a scratch root on a free port, never the operator's 8790, and hand that address to the UI reviewer. Re-serve after every push until the UI pass names the head.

## Editing

- Send every property edit through the one writer behind `canvas edit`, which the inspector shares. It carries the frame hash check that refuses a stale address. A second write path skips that check and lands on a shifted element.
- Land a verb before the key binding or control that calls it, so the keyboard and the CLI never disagree about what an action does.
- Bind single-letter keys to act only while the canvas holds focus. A letter typed into a field must reach the field.

## Shipped files and controls

- Name no reference tool in a shipped file. Describe a control by what it does.
- Take the control patterns from behavior. Put a glyph inside the field rather than in a label column, treat a color as one field, and draw a layer row as an icon and a name.

## Reference

- `canon/context/features/canvas.md`: structure, content format, capture, gotchas
- `docs/agents/canvas.md`: every verb, record, and refusal
- `claude/skills/canvas/`: the procedure a session follows to drive the canvas, which is the shipped skill's concern rather than this one's
- `claude/skills/canvas/references/canvas.md`: the frame content format both writers share
- `canon/context/development/evidence.md`: which `evidence` folders are dev baselines and which are prod captures, before committing a walk's states
