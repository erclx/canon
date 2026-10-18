---
title: Governance rule reference
description: Rule frontmatter, body shape, and voice for .claude/rules files
---

# Governance rule reference

## Contents

- [Overview](#overview)
- [Scope](#scope)
- [Whether a skill belongs behind the rule](#whether-a-skill-belongs-behind-the-rule)
- [Location](#location)
- [Names](#names)
- [Frontmatter](#frontmatter)
- [Body](#body)
- [Examples](#examples)

## Overview

Rules give Claude Code coding constraints scoped to file paths. Claude Code discovers `.claude/rules/**/*.md` at session start.

A rule with no `paths:` field always applies, at the same priority as `CLAUDE.md`. A rule with `paths:` applies when Claude reads or writes a file matching the glob. Author one rule per topic so the scope stays precise.

### When a path-scoped rule loads

A rule with `paths:` loads on a read or a write of a matching file, inside a linked worktree as in the main one. A session creating the first matching file gets the rule only after that write lands.

- A rule meant to shape new files therefore also belongs in the skill or the always-on rule a session reads before it writes
- Revisit when Claude Code loads a path-scoped rule before a write to a matching path
- Re-measure with two headless `claude -p` runs in a linked worktree, one reading a matching file and one reading a file that does not, each asking whether the rule's content is in context

## Scope

Governs governance rules under `.claude/rules/`: their location, names, frontmatter, and body shape.

Does not govern:

- Authoring conventions for a document type, which are standards rather than rules. A rule points at the standard that owns one and never restates it.
- Skill folders and skill frontmatter: `skill.md`
- Cross-domain behavior rules, which live in `CLAUDE.md` at the project root

## Whether a skill belongs behind the rule

A rule fires on a path match with no decision from the session, which is what makes it a floor. Every bullet is one directive and nothing else, so an invariant needing procedure, worked cases, or a branch on project state has no room in the body.

- Run the two-part test in reverse before calling the rule finished. The rule already holds what fires on a path edit and ships silently when violated.
- Ask what a session still needs past the directive, and give that to a skill the rule points at
- A rule that grows a procedure has become a skill body wearing rule frontmatter

Write both when both apply. A rule stating the directive and a skill stating how to carry it out are one invariant at two depths rather than two copies of it, and `skill.md` carries the same checkpoint for a session arriving from the other side. Nothing checks either one.

## Location

- A toolkit-shipped rule lives at `.claude/rules/canon/<subdirectory>/<slug>.md`. The wrapper marks the file as toolkit-owned and replaced on sync, so a reader still knows not to edit it.
- Subdirectories group by domain or audience: `code/`, `lang/`, `framework/`, `lib/`, `ui/`, `claude/`, `canon/`, `tooling/`, `writing/`
- `<slug>` is a one-to-three-word kebab topic
- A rule the project authored itself lives at `.claude/rules/project/<subdirectory>/<slug>.md`, a sibling of `canon/` rather than nested inside it, keeping the same subdirectory names
- This repository's own toolkit-only rules, which never ship to a target, live at `.claude/rules/internal/<subdirectory>/<slug>.md`, a second sibling of `canon/`.

## Names

A rule's filename is its slug, with no number in front. Nothing orders rules at load, and the folder already names the domain.

- Keep every basename unique across a rule set, internal rules included, since `canon gov` resolves a stack entry and a rename by basename alone.
- Never name a rule after a subdirectory. A stack entry naming that word expands to the whole folder, so the rule becomes unreachable on its own.
- A project-authored rule needs its slug free only inside its own subdirectory under `.claude/rules/project/`, since `canon/` and `project/` install side by side

### What sync reads

`canon gov sync` walks only `.claude/rules/canon/`, so `.claude/rules/project/` is never matched, read, or reported on. A file under `.claude/rules/canon/` that no toolkit source names is reported orphaned, with no destination offered.

- The toolkit cannot tell a rule the project dropped there from one it shipped and later renamed
- A destination inside `canon/` would be wrong for the first case anyway, since that folder is toolkit-owned and replaced on sync
- Nothing is moved either way, since the project's own rules, skills, and docs may cite a rule's installed path

## Frontmatter

- `description` (required): one line naming what the rule enforces and where
- `paths` (optional): one glob per entry, for a rule scoped to a file set
- Omit `paths` for an always-on rule that states a global principle with no file scope
- Do not emit the legacy Cursor keys `globs`, `alwaysApply`, or `priority`. They are not read.

```yaml
---
description: Enforce strict Python type hints, casing, and import patterns
paths:
  - '**/*.py'
---
```

## Body

- Open with an H1 `# <Topic> standards` in sentence case, then group rules under H2 sections. Proper nouns keep their casing (`# TypeScript standards`, `# Next.js standards`).
- Use imperative voice for every rule (`Prefix booleans with is`, not `Booleans should be prefixed`)
- State one rule per bullet as a single directive line
- State what to do and what not to do. Do not explain the reasoning behind a rule.

### Phrasing

A ban asserting how the model or a tool behaves ends its directive line with one `Revisit when <finding>.` sentence, which states a condition rather than the reasoning. A style, safety, or consistency ban takes none.

- Phrase a rule as a ban on the forbidden shape when it could otherwise enumerate allowed options, so it stays stable as categories grow
- Cut any rule that resists crisp one-line phrasing. Vague guidance is worse than none.

### Scope of a rule file

A rule file holds one topic in its current shape.

- Keep the file to one topic. A second topic is a second rule file.
- Do not restate a rule that a sibling rule or `CLAUDE.md` already owns. Point once, never duplicate.
- Name the current layout only, in a glob and in the body alike
- A layout change ships a migration verb, such as `canon migrate records`, rather than a line or a glob that keeps the old spelling loading

## Examples

### Correct

A scoped description, a `paths` list, and one directive per bullet.

```markdown
---
description: Enforce naming conventions for functions, booleans, and collections
paths:
  - '**/*.ts'
---

# Naming standards

## Semantics

- Prefix booleans with `is`, `has`, `should`, or `can`
- Name functions as actions describing what they do
- Name collections as plurals and items as singulars
```

### Incorrect

A vague description, legacy Cursor keys, and reasoning in place of directives.

```markdown
---
description: Naming
globs: '**/*.ts'
alwaysApply: false
---

# Naming

Good naming matters because it makes code easier to read and maintain, so you
should always pick descriptive names. Booleans are usually prefixed with is or
has, and it can also be a good idea to think about collections too.
```
