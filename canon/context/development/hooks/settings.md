---
title: Session budget settings
description: The Claude Code settings bounding a long session's cost that the repository records without setting, plus autoMemoryEnabled, the one it sets
---

# Session budget settings

Three Claude Code settings bound what a long session costs, and a fourth turns off the harness's auto memory. They sit beside the hooks because `.claude/settings.json` is the file the hooks register in.

This repository and `tooling/claude/seeds/.claude/settings.json` set none of the three. Two are live in the operator's own `~/.claude/settings.json` and the third is deliberately unset, so a session reading the settings file alone would conclude all three are unconfigured and set them again.

- The fourth, `autoMemoryEnabled`, is the one setting this repository sets
- No rule routes a session editing `.claude/settings.json` here, since JSON carries no pointer of its own, the file is rarely edited, and the guard already sits in every seeded hook
- A session editing the file finds the `autoContinueAtUsageLimit` inversion and the `autoCompactWindow` cap through this folder's index
- Every value was read from `https://code.claude.com/docs/en/settings-reference`, `model-config`, `cross-session-messaging`, and `costs`, so re-read them against a newer client

## Decisions

### autoCompactWindow

The setting fixes how full the context window gets before Claude Code compacts. It takes an absolute token count from 100K to 1M rather than a percentage, as a plain integer, a `k` or `M` suffix, or a bare number from 100 to 1000 read as thousands.

- Its documented scope is any settings file, and `/autocompact <value>` writes to the user file rather than the project one
- Unset, a session compacts at its model's context limit
- The operator's user file sets 750000. Claude Code caps the window at the model's own, so a 200K session reaches the cap first and the value bites only on the 1M window.

The value stays in the user file rather than here or in the seed. A threshold that suits an orchestrator open all day is wrong for a ten-minute session, so it is a per-operator preference, and committing one machine's answer would impose it on everyone.

### autoContinueAtUsageLimit

The setting makes a session wait in place and continue its task after a claude.ai usage limit resets. It is `true` in the operator's user file.

- The project file cannot assert it. The key's documented scope is user or managed, and while a repository file sets it and no user, `--settings`, or managed value does, Claude Code reads it as off.
- Writing `true` into `.claude/settings.json` would therefore turn the behavior off for anyone carrying no value of their own
- The rolling five-hour usage window is not readable locally, since there is no `claude usage` subcommand, `/usage` is interactive, and `stats-cache.json` holds daily counts. Do not search again.

### crossSessionInbound

The setting decides what a session does with a message from another of your sessions, on an `accept`, `hold`, `refuse` ladder. An inbound message becomes a new turn carrying the whole context whenever the receiver sits idle, which makes the key a cost lever for a dispatch loop. The vendor's cost page names `hold` as the way to stop paying it.

This repository leaves it unset, because no value both saves tokens and keeps the worker handback the orchestrator loop runs on.

- `hold` and `refuse` bound the cost and break the handback, since a held message reaches nobody until an `accept` later applies and a refused one is dropped
- `accept` bounds nothing
- Precedence rules out the seed too, since a project or local value wins when stricter, so a seeded `hold` would override a target operator's own `accept`

### autoMemoryEnabled

Claude Code tells every session it may keep notes under `~/.claude/projects/<project>/memory/`, but canon keeps none and a fact lands in the owning task's Findings or context entry. `.claude/settings.json` sets `autoMemoryEnabled: false`, which removes the instruction from the system prompt here and stops the harness using the folder.

The key's documented scope is any settings file. Project scope outranks the operator's user file, which reads `true` today, so the repository's value wins here and the user file governs every other project. `CLAUDE_CODE_DISABLE_AUTO_MEMORY` still takes precedence for one session in either direction.

- The setting is the primary control and `memory-guard.sh` is the backstop, covered in `canon/context/development/hooks/command-scanners.md`
- Neither is seeded, since turning off a harness feature in a target is that operator's preference and a target's memory folder stays inert. Revisit when a target asks.
- Verify in a fresh `claude` session at the repository root, where `/memory` shows auto memory off. No test reaches the harness prompt, so this stays manual.
