---
title: CLI
subtitle: The TypeScript entry point and its sync, audit, and session layers
---

# CLI

The TypeScript entry point and its sync, audit, and session layers

- [CLI audits](audits.md): `src/audits/`, `src/context/`, and `src/markdown/`, being the aggregate audit run, the context-folder audit, and the markdown attribute standard audit
- [CLI](overview.md): TypeScript entry point and the layer boundary to bash, command registration, the root and git resolvers, packaging, and the pointers to the sync, audit, and session entries
- [CLI sessions](sessions.md): `src/pr/`, `src/listeners/`, and `src/sessions/`, being the `canon pr` readers and writers, the port listener reads, and the live-session roster with the branch claim
- [CLI sync](sync.md): `src/sync/`, `src/targets/`, and `src/migrate/`, being the sync engine and its install stamp, the machine-level target index, and the one-shot migrations
