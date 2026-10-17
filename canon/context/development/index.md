---
title: Development
subtitle: Local dev loop and run commands, how bun run check scopes its stages and tests, the hooks, session scratch, and record folders. Start with overview.
---

# Development

Local dev loop and run commands, how bun run check scopes its stages and tests, the hooks, session scratch, and record folders. Start with overview.

- [Evidence modes](evidence.md): The dev and prod meanings of evidence, the boundary that sorts a folder between them, a row per kind, and the products with no dev baseline yet
- [Gating stages](gates/index.md): The stages that gate a push on a measure, what sequences them, the report-only Audit set stage, the content stages, and the catalog stages. Start with overview.
- [Hooks](hooks/index.md): Where shell scripts and hooks live, the tool-call guards, the compaction and turn hooks, the session budget settings, and the husky git hooks. Start with overview.
- [Overview](overview.md): What the development domain owns, the toolchain setup, the run command table and its consumers, and why the entry is a folder
- [Record folders](records.md): How each gitignored record folder is indexed, named, archived, and backed off the disk, and the skew a layout change meets
- [Regeneration stages](regeneration.md): The regenerate-then-assert stages, covering the consumed copies, sample content, and the hero image with its single-writer rule
- [Session scratch](scratch.md): Why shared scratch lives at the main worktree root, what worktree isolation refuses, the two write routes, the hooks a shell write bypasses, and which scratch writers state a root
- [Test scoping](tests.md): Which change runs which src/ test, the corpus census, the machine lock that runs one suite per box, the vitest invocation forms, and the unused-import gap
- [Verification](verification.md): How bun run check scopes stages to the changed-file set, why the baseline is the remote ref, the process tier, the install gate, and the index gotchas
