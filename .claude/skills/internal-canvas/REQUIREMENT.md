---
name: internal-canvas
description: Why the canvas implementation needs a domain skill beside the context entry that carries its narrative and the plugin skill that drives it
---

# Internal canvas requirement

## Gap

Without this skill, a session editing canvas code:

- Loads `internal-scripts`, whose body never mentions the canvas, and rediscovers each gotcha from a failing run.
- Runs a verb against `.canon/canvas/` and writes a real selection into the operator's open canvas.
- Verifies from captures alone while a shell that builds wrong serves a blank page, since every capture still passes.
- Waits on `networkidle` in a browser walk and hangs on the connection the page holds open.
- Adds a second write path for a property, skipping the hash check that refuses a stale address.
- Binds a single-letter key without a focus check, so a letter typed into a field fires an action.
- Names a reference tool in a shipped file.

## Must

- Point at `canon/context/features/canvas.md` and `docs/agents/canvas.md` rather than restating them.
- State that a verb runs against a provisioned `--root`, and why.
- Name the one writer for property edits and the order a verb and its key binding land in.
- State how the shell is driven in a browser and what to wait on.

## Must not

- Restate the entry's layout, format, or capture decisions. The ownership table in `CLAUDE.md` puts that narrative in the entry.
- Carry the procedure a session follows to draw on the canvas. `claude/skills/canvas/` owns it.
- Restate a verb's records or refusals, which `docs/agents/canvas.md` owns.

## Guards

No refusal strings. This is a domain skill loaded before editing rather than a procedure with entry conditions.

## Out of scope

- `internal-scripts` covers `src/` generally. This covers what the canvas means, which that skill does not carry.
- `canvas` is the shipped skill an operator or session runs to draft. This is for editing the machinery underneath it.

### The open question this cannot answer

Whether anything loads this other than a session reading the `CLAUDE.md` domain table. That cannot be known before the skill has run, so re-read this file after a few canvas edits have used it. A domain skill nothing loads is a context entry with extra steps.
