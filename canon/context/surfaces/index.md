---
title: Surfaces
subtitle: The CLI, governance, tooling, and the Claude plugin that reach a target project
---

# Surfaces

The CLI, governance, tooling, and the Claude plugin that reach a target project

- [CLI audits](cli-audits.md): `src/audits/`, `src/context/`, and `src/markdown/`, being the aggregate audit run, the context-folder audit, and the markdown attribute standard audit
- [CLI sessions](cli-sessions.md): `src/pr/`, `src/listeners/`, and `src/sessions/`, being the `canon pr` readers and writers, the port listener reads, and the live-session roster with the branch claim
- [CLI sync](cli-sync.md): `src/sync/`, `src/targets/`, and `src/migrate/`, being the sync engine and its install stamp, the machine-level target index, and the one-shot migrations
- [CLI](cli.md): TypeScript entry point and the layer boundary to bash, command registration, the root and git resolvers, packaging, and the pointers to the sync, audit, and session entries
- [Governance](governance.md): Path-scoped Claude rules with their naming, frontmatter, and routing contract, the stacks that group them, and the install and sync path with its CLI
- [Claude plugin](plugin.md): The plugin skills shipped to target projects, the manifest and marketplace entry that deliver them, the canon claude CLI, and the seeds it lands in a target
- [Tooling](tooling.md): The golden configs and seeds a project inherits, the stack layering and manifests that decide what sync injects, the seed gates, the web capture harness, and the end-to-end verify
