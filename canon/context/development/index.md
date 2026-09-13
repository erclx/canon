---
title: Development
subtitle: Local dev loop and the run command table, how bun run check scopes its work, what each stage regenerates and gates on, the hook families, and session scratch. Start with overview.
---

# Development

Local dev loop and the run command table, how bun run check scopes its work, what each stage regenerates and gates on, the hook families, and session scratch. Start with overview.

- [Gating stages](gates.md): The stages that gate a push on a measure, covering the sandbox coverage ceiling, plugin manifest validation, and the seed independence token walk, plus the one measure-reading stage that reports instead
- [Hooks](hooks.md): Where shell scripts live, the Claude Code hook families and their stdin guard, the three session budget settings the repository records without setting, and the husky hooks with their POSIX sh constraints
- [Overview](overview.md): What the development domain owns, the toolchain setup, the run command table and its consumers, and why the entry is a folder
- [Regeneration stages](regeneration.md): The regenerate-then-assert stages, covering the consumed copies of standards, snippets, internal content, and rules, the tooling path contract, and the hero image with its single-writer rule
- [Session scratch](scratch.md): Why shared scratch lives at the main worktree root, the two write routes a linked worktree has, how each gitignored folder is indexed and archived, where a spike puts what it reads against what it produces, and the second git directory backing them off the disk
- [Verification](verification.md): How bun run check scopes stages to the changed-file set, why the baseline is the remote ref, and the gotchas of running the suite
