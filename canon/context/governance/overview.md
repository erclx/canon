---
title: Overview
description: What the governance domain owns, where its source and consumed trees sit, and why the entry is a folder
---

# Overview

Owns the rules that steer AI agents working in a project. Source rules live here as `.md` files under `governance/rules/` and install to `.claude/rules/` in a target, where Claude Code reads them natively. Stacks group rules so one install command provisions a whole toolchain.

The rules are content rather than code, so the domain is a catalog plus a command surface rather than a system with runtime behavior. What carries the weight is which rules exist, which stack names them, and what an install does to a target's tree.

## Layout

- `governance/rules/` owns the source rules, organized into one subfolder per numbering band
- `governance/stacks/` owns stack definitions as toml, each declaring an optional extends chain and a rules list whose entries name either a rule or a whole rule folder
- `internal/rules/` owns rules that govern toolkit authoring alone, installed into this repository's copy and shipped to no target
- `internal/governance.toml` records which stack and extras this repository consumes, and `src/gov/consumed.ts` produces the copy from it
- `src/gov/` owns the gov half of every verb: the stack reader, the rule lookup, the catalog behind `list`, the install copy, the sync adapter, and the payload builder behind `build`
- `src/sync/engine.ts` owns the shared sync engine every domain runs on

## Gotchas

### Why the entry is a folder

The entry is a folder on the sub-area condition rather than on length. `standards/context.md` splits a domain at three or more sub-areas that do not fit cleanly in one file, and the rule tier with its numbering and frontmatter contract, the stacks that group rules, and the install and sync path with its CLI are three that do not. Length is what raised the question and answers nothing by itself.

### Editing `.claude/rules/` here changes nothing

This repository's own `.claude/rules/` is produced output rather than a working copy, so a rule written into it by hand is deleted on the next `bun run check`. `canon/context/governance/install.md` covers the record it is produced from and where a new rule for this repository is registered instead.
