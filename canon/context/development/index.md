---
title: Development
subtitle: Local dev loop and the run command table, how bun run check scopes its work and its tests, what each stage regenerates and gates on, the hook families, session scratch, and the record folders. Start with overview.
---

# Development

Local dev loop and the run command table, how bun run check scopes its work and its tests, what each stage regenerates and gates on, the hook families, session scratch, and the record folders. Start with overview.

- [Gating stages](gates/index.md): The stages that gate a push on a measure, what sequences them, the report-only Audit set stage, the content stages, and the catalog stages. Start with overview.
- [Hooks](hooks/index.md): Where shell scripts and hooks live, the tool-call guards, the compaction and turn hooks, the session budget settings, and the husky git hooks. Start with overview.
- [Overview](overview.md): What the development domain owns, the toolchain setup, the run command table and its consumers, and why the entry is a folder
- [Record folders](records.md): How each gitignored record folder is indexed, named, and archived, the skew a layout change meets, the record roots the migration sweep passes over, where a spike puts its evidence, and the second git directory backing the records off the disk
- [Regeneration stages](regeneration.md): The regenerate-then-assert stages, covering the consumed copies of standards, snippets, internal content, and rules, the tooling path contract, and the hero image with its single-writer rule
- [Session scratch](scratch.md): Why shared scratch lives at the main worktree root, what worktree isolation refuses, the two write routes a linked worktree has, the hooks a shell write bypasses, and which .canon/tmp/ writers state a root
- [Test scoping](tests.md): Which change runs which src/ test, the census of corpora a src/ test asserts over from outside src/, the vitest invocation forms and their failure signatures, and the include and unused-import gaps
- [Verification](verification.md): How bun run check scopes stages to the changed-file set, why the baseline is the remote ref, the process tier, the install gate, ranking a stage by processor seconds, and the index and spelling gotchas
