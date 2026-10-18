---
title: Rule bullet checklist
description: Criteria a session runs over each bullet of a rule it just wrote or revised, and the verdict shape it returns
---

# Rule bullet checklist

A session reads this after writing or revising a rule, once the body holds its bullets. `rule.md` sets the shape before writing, and this list judges each bullet after.

For each bullet in the rule under audit, return `✅ keep`, `⚠️ revise`, or `❌ drop` with a one-line reason.

## Criteria

1. **Concrete enough to verify.** A reviewer can read a line of code and say whether it complies. "Prefer `pathlib.Path` over `os.path`" passes, since it names both sides.
2. **Catches a real footgun.** A violation produces a concrete bug class, such as data injection or blocking I/O in async. Drop it if the worst case is "code looks off".
3. **Not redundant with the toolchain.** Skip anything the project's formatter, linter, type checker, or spell checker already enforces. Rules cover what tools cannot.
4. **Uncontested.** When the community is split, drop the bullet or pick a side with a short reason tied to the stack.
5. **Inside the shape.** At most 200 characters and 2 sentences, one directive plus at most one exception, condition, or short reason, per `## Shape` in `rule.md`.
6. **Passes the content test.** Claude could not guess it, and it is not a standard convention or information that changes often, per `## Content` in `rule.md`.
7. **Frontmatter integrity.** `description` names one concern in one line, and a path-scoped rule carries one `paths:` entry per glob.
8. **Retired keys and names.** An always-on rule omits `paths:`, and no rule carries `globs:`, `alwaysApply:`, or `priority:`. The basename names no folder.
9. **Template precedent.** H1 and H2 in sentence case and imperative bullets, matching `## Body` in `rule.md`.

## Output shape

Group findings by file. Lead each file block with the per-file verdict count.
