---
title: Rule audit checklist
description: Criteria for auditing newly written or revised rule bullets
---

# Rule audit checklist

For each bullet in the rule under audit, return `✅ keep`, `⚠️ revise`, or `❌ drop` with a one-line reason.

## Criteria

1. **Mechanical, not stylistic.** A reviewer must be able to grep for the violation. `Use X over Y` beats `prefer X` or `be careful with Z`.
2. **Catches a real footgun.** Violation should produce a concrete bug class such as data injection, blocking I/O in async, or runtime introspection breakage. If the worst case is "code looks off," drop it.
3. **Not redundant with the toolchain.** Skip anything the project's formatter, linter, type checker, or spell checker already enforces. Rules cover what tools cannot.
4. **Uncontested.** If the community is split (`from __future__ import annotations` is the textbook case for Python), drop the bullet or pick a side with explicit rationale tied to the stack.
5. **Scoped to observable patterns.** "Define a project exception hierarchy" is borderline because it cannot be grepped. Keep these sparse.
6. **Frontmatter integrity.** `description` follows `standards/markdown.md` § Frontmatter descriptions. Path-scoped rules carry a `paths:` list with one entry per glob. Always-on rules omit `paths:` entirely. Reject any source that still carries `globs:`, `alwaysApply:`, or `priority:`. Numeric prefix matches the domain range in `canon/context/governance/rules.md`.
7. **Template precedent.** H1 and H2 in sentence case, period-terminated bullets. Match the existing rule shape under `governance/rules/`.

## Output shape

Group findings by file. Lead each file block with the per-file verdict count.
