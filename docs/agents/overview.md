---
title: Overview
description: What this folder covers, the invocation rules every command inherits, and how canon docs resolves a topic name
---

# Overview

Reference for an agent driving the `canon` CLI, in this repository or in any project that installed it. It covers invocation and output contracts, not domain behavior. Read the project's own `CLAUDE.md` for that.

`canon --help` is the command catalog. `canon <command> --help` lists subcommands, and `canon <command> <subcommand> --help` prints a leaf's flags, exit codes, and examples. `--help --all` prints both. A pipe gets the same text without the frame glyphs.

## Invocation rules

`output-shape.md` holds the stream and exit contract every command follows. Every command has a non-interactive path, and data on stdout pipes clean.

## Reading a page by name

`canon docs list [--json]` lists the consumer docs, plus the per-domain context entries when the install carries `canon/context/`. A registry install carries `docs/` alone. A clone or a linked worktree carries both.

`canon docs <topic>` prints one doc to stdout, and an unknown topic names the available ones on stderr and exits 1. Three spellings are tried in order, each across both roots before the next, with `docs/` ahead of `canon/context/`.

- A sibling file, such as `docs/agents/indexes.md` for `indexes`
- A folder of that name, which prints its generated `index.md`
- A sub-area file one level down, such as `operating-model` reaching `docs/workflow/operating-model.md`

A bare name carried by two folders of one root resolves to neither and exits 1. Toolkit-internal topics resolve by name and stay off the list.

## See also

- `output-shape.md`: the frame, `--json`, color, and exit discipline
- `docs/index.md`: the full docs directory
