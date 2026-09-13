---
title: CLI
subtitle: TypeScript entry point and the layer boundary to bash, command registration and migration, the sync engine and its install stamp, the audit commands, and packaging. Start with overview.
---

# CLI

TypeScript entry point and the layer boundary to bash, command registration and migration, the sync engine and its install stamp, the audit commands, and packaging. Start with overview.

- [Audits](audits.md): The aggregate that runs them all with its retained baseline, then the context audit, the markdown audit, the skill audit, the comment census, the board and record validators, the test-order report, and the two state-scoped checks over the shipped tree and the dependency set
- [Commands](commands.md): Command registration in commander, migrating a domain off bash, shared helpers, and how a command writes files and prompts
- [Overview](overview.md): What the CLI domain owns, the folder layout, and the gotchas that cross every command
- [Packaging](packaging.md): What the published package carries and excludes, how a browser command keeps its engine off the startup path, and the two capture sources
- [Sync](sync.md): The sync engine and its adapters, the install stamp and what it covers, attribution from git history, and the freshness report
