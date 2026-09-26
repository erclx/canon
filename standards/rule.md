---
title: Governance rule reference
description: Rule frontmatter, body shape, and voice for .claude/rules files
---

# Governance rule reference

## Overview

Rules give Claude Code coding constraints scoped to file paths. Claude Code discovers `.claude/rules/**/*.md` at session start.

A rule with no `paths:` field always applies, at the same priority as `CLAUDE.md`. A rule with `paths:` applies when Claude reads a file matching the glob. Author one rule per topic so the scope stays precise.

## Scope

Governs governance rules under `.claude/rules/`: their location, numbering, frontmatter, and body shape.

Does not govern:

- Authoring conventions for a document type, which are standards rather than rules. A rule points at the standard that owns one and never restates it.
- Skill folders and skill frontmatter: `skill.md`
- Cross-domain behavior rules, which live in `CLAUDE.md` at the project root

## Whether a skill belongs behind the rule

A rule fires on a path match with no decision from the session, which is what makes it a floor. Every bullet is one directive and nothing else, so an invariant needing procedure, worked cases, or a branch on project state has no room in the body.

Run the two-part test in reverse before calling the rule finished. The rule already holds what fires on a path edit and ships silently when violated. Ask what a session still needs past the directive, and give that to a skill the rule points at, because a rule that grows a procedure has become a skill body wearing rule frontmatter.

Write both when both apply. A rule stating the directive and a skill stating how to carry it out are one invariant at two depths rather than two copies of it, and `skill.md` carries the same checkpoint for a session arriving from the other side. Nothing checks either one.

## Location

- A toolkit-shipped rule lives at `.claude/rules/canon/<subdirectory>/<n>-<slug>.md`. The wrapper marks the file as toolkit-owned and replaced on sync, so a reader unfamiliar with the numbering convention still knows not to edit it.
- Subdirectories group by domain or audience: `code/`, `lang/`, `framework/`, `lib/`, `ui/`, `claude/`, `canon/`, `tooling/`, `writing/`
- `<n>` is a number from the band reserved for the rule's source and `<slug>` is a one-to-three-word kebab topic
- A rule the project authored itself lives at `.claude/rules/project/<subdirectory>/<n>-<slug>.md`, a sibling of `canon/` rather than nested inside it, keeping the same subdirectory names
- This repository's own toolkit-only rules, which never ship to a target, live at `.claude/rules/internal/<subdirectory>/<n>-<slug>.md`, a second sibling of `canon/`. See "Two sources numbering into one folder" below.
- Give every rule a numeric prefix. A bare-word filename reads as a folder name where a stack names its rules, so a rule without one is unreachable from a stack entry.

## Reserved numbers

`000-899` is reserved for a rule set that ships to targets, and the nine subdirectories above divide it at 100 per subdirectory, in the order listed. No band is left over, so a subdirectory a shipped set adds later joins an existing band or takes one a retired subdirectory freed.

A project-authored rule takes `900-999`, one sequence across every subdirectory under `.claude/rules/project/`. Scanning for a free number instead is what fails, because a shipped set fills its own band release by release, so what reads as free today is what a later release lands on. One target authored `claude/561-self-check.md` on a day nothing shipped at 561, met the shipped teach rule, then numbered 561, on its next install, and now reads two numbers differently from everywhere else.

The cost is that a project-authored rule's leading digit stops naming its domain. Its subdirectory names it instead, and install preserves that either way. What a shared band costs is worse: a session that loads two rules reading as one number, with nothing in the folder to say which is which.

`canon gov sync` walks only `.claude/rules/canon/`, so `.claude/rules/project/` sits outside the walk by location and is never matched, read, or reported on. A file under `.claude/rules/canon/` itself that no toolkit source names is still reported orphaned, but with no destination offered: the toolkit cannot tell a rule the project dropped there from one it shipped and later renamed, and a destination nested inside `canon/` would be wrong for the first case regardless, since that folder is toolkit-owned and replaced on sync. Nothing is moved either way, since a rule's installed path is one the project's own rules, skills, and docs may cite.

## Two sources numbering into one folder

The reservation above divides one pair, being a shipped set against the rules a project wrote for itself. A third source, a rule set held back from targets and installed only where it was authored, needs its own division too. This repository is the one place all three sources exist at once, and it divides the third pair two ways at once rather than one: `canon/` and `internal/` separate a shipped rule from an internal one by location, the same way `project/` separates a project-authored one, and within each subdirectory the numbering still divides by source as well, one source taking the top of the band and the other the gaps between the tens.

The numbering half stays because location alone does not carry to a reader who only sees the number, such as one comparing `claude/567-planning.md` against a citation written before the rules moved into `canon/`.

The collision this prevents is silent. Two rules that resolve to the same `<n>-<slug>` path leave one file in the installed folder, and neither the install nor the session that reads it reports which source lost. Nothing checks a division outside the reserved bands, so it holds only while both sources follow it. Separating `canon/` from `internal/` by folder removes the filename-collision case specifically, since the two no longer install to the same directory, but the number still carries the source signal for a reader who has only the number in view.

State that division where the rule sources are described, not inside the rules it divides. A rule states its own topic, and a numbering convention spanning two sources belongs to whatever documents the pair.

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
- Phrase a rule as a ban on the forbidden shape when it could otherwise enumerate allowed options, so it stays stable as categories grow
- Cut any rule that resists crisp one-line phrasing. Vague guidance is worse than none.
- Keep the file to one topic. A second topic is a second rule file.
- Do not restate a rule that a sibling rule or `CLAUDE.md` already owns. Point once, never duplicate.

## Examples

### Correct

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
