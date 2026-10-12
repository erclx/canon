---
title: Overview
description: What this folder covers, the invocation rules every command inherits, and where domain behavior is documented instead
---

# Overview

CLI catalog and invocation rules for an agent driving the `canon` CLI, in this repository or in any project that installed it.

This folder is an index of what an agent can run and how to run it cleanly from a script. It does not cover domain behavior. Read the project's own `CLAUDE.md` for that. The `.claude/skills/internal-*` skills carry the per-domain editing guidance and live in the toolkit checkout alone, so a reader who installed the package resolves none of them.

## Invocation rules

`output-shape.md` holds the stream and exit contract. It applies to every command in this folder.

## Where to start

- `output-shape.md`: the stream contract every command renders into and the exit discipline behind it, which is what a caller parsing stdout depends on
- `commands.md`: the full command catalog, project-level and per-domain
- `scripting.md`: the runtime catalogs that replace hardcoded names, plus headless invocation examples

## Related

- `CLAUDE.md`: project behaviors
- `.claude/skills/internal-*`: domain-scoped guidance for editing work, in the toolkit checkout only
- `docs/index.md`: full docs directory
