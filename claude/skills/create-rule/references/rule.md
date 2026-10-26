---
title: Governance rule reference
description: Rule frontmatter, shape limits, content test, sources, body shape, and voice for .claude/rules files
---

# Governance rule reference

## Contents

- [Overview](#overview)
- [Scope](#scope)
- [Shape](#shape)
- [Content](#content)
- [Whether a skill belongs behind the rule](#whether-a-skill-belongs-behind-the-rule)
- [Sources](#sources)
- [Location](#location)
- [Names](#names)
- [Frontmatter](#frontmatter)
- [Body](#body)
- [Examples](#examples)

## Overview

Rules give Claude Code coding constraints scoped to file paths. Claude Code discovers `.claude/rules/**/*.md` at session start, and a rule in `~/.claude/rules/` applies to every project on the machine.

A rule with no `paths:` field always applies, at the same priority as `CLAUDE.md`. A rule with `paths:` applies when Claude reads or writes a file matching the glob. Author one rule per topic so the scope stays precise.

### When a path-scoped rule loads

A rule with `paths:` loads on a read or a write of a matching file, inside a linked worktree as in the main one. A session creating the first matching file gets the rule only after that write lands.

- The first write's floor therefore belongs to the skill that creates the file, per `## Whether a skill belongs behind the rule`
- Measured again on Claude Code 2.1.302, when the rule attached after the first write to a new file and before the second
- Revisit when Claude Code loads a path-scoped rule before a write to a matching path
- Re-measure with two headless `claude -p` runs, one writing a new matching file and one reading a matching file first, each read for when the rule attached

## Scope

Governs governance rules under `.claude/rules/`, being their shape, content, sources, location, names, frontmatter, and body.

Does not govern:

- Authoring conventions for a document type, which are standards rather than rules. A rule points at the standard that owns one and never restates it.
- Skill folders and skill frontmatter: `skill.md`
- Cross-domain behavior rules, which live in `CLAUDE.md` at the project root
- Judging each bullet after writing, which is `checklist.md`

## Shape

Every limit is a count a reviewer can take, so a rule passes or fails it without judgment.

| Limit                | Value                                                           |
| -------------------- | --------------------------------------------------------------- |
| Words in the body    | 300                                                             |
| Bullets per file     | 15                                                              |
| H2s per file         | 6                                                               |
| Bullets per H2       | 7                                                               |
| Bullet length        | 200 characters                                                  |
| Sentences per bullet | 2, one directive plus one exception, condition, or short reason |

Two habits keep a rule inside those limits.

- Name one concern in `description`. A rule needing a seventh H2 holds two concerns and splits into two files.
- Keep a reason to the why of its directive, never a paragraph of background

## Content

A bullet loads on every matching edit, so it earns its place only when removing it would cause a mistake.

| Put in a rule                              | Leave out                                                |
| ------------------------------------------ | -------------------------------------------------------- |
| What Claude cannot guess                   | Standard language conventions Claude already knows       |
| A convention that differs from the default | Anything the linter, formatter, or type checker enforces |
| A footgun that ships silently              | Information that changes often                           |

Three habits keep each bullet worth its load.

- Write every bullet concrete enough to verify against a line of code. "Prefer `pathlib.Path` over `os.path`" passes, since it names both sides.
- Pair a ban with the alternative to take, unless the ban or a neighbor bullet already names it
- Use no emphasis words such as "CRITICAL" or "You MUST", which newer models overtrigger on

## Whether a skill belongs behind the rule

A rule fires on a path match with no decision from the session, which is what makes it a floor. Procedure, worked cases, and a branch on project state have no room in its bullets, so they belong to a skill.

Each invariant has one copy, in either the rule or the skill. `skill.md` carries the same test for a session arriving from the other side.

- A skill that creates the file the rule globs owns the floor, since the rule loads only after the first write. The rule keeps the edit-time bullets and a pointer.
- A skill that edits existing files points at the rule, and the rule owns the floor
- A pointer bullet earns its load only when the skill's description does not already fire on the same edit
- Keep at most five directives beside a pointer
- A rule that grows a procedure has become a skill body wearing rule frontmatter

### Checking the installed skills

Before writing, read the descriptions of the skills in the session's listing and stop at one that names the topic. Point the rule at that skill rather than restating it, and skip the check when the listing holds no skills.

## Sources

A bullet claiming outside practice, such as a language idiom or a library's correct use, rests on a primary source. Unsourced practice drifts, and the bullet goes on loading after it turns wrong.

- Cite the source in the commit that adds the rule, naming a primary page or the bug class the bullet prevents
- Cut a bullet that has neither a source nor a bug class behind it
- The toolkit holds its outside-practice rules to a source ledger kept outside the installed tree, so the citation costs no load
- A bullet resting on how Claude Code behaves ends with a `Revisit when` sentence, per `### Phrasing`

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

- `description` (required): one line naming what the rule enforces and where. It is canon's own field, read by `canon gov list`.
- `paths` (optional): one glob per entry, for a rule scoped to a file set. It is the only field Claude Code reads.
- Omit `paths` for an always-on rule that states a global principle with no file scope
- Do not emit the legacy Cursor keys `globs`, `alwaysApply`, or `priority`. They are not read.

```yaml
---
description: Enforce strict Python type hints, casing, and import patterns
paths:
  - '**/*.py'
---
```

Frontmatter that fails to parse loads the rule as if it had no `paths`, so a broken glob turns a scoped rule always-on. Quote every glob that opens with `*` or `{`.

## Body

- Open with an H1 `# <Topic> standards` in sentence case, then group rules under H2 sections. Proper nouns keep their casing (`# TypeScript standards`, `# Next.js standards`).
- Use imperative voice for every rule (`Prefix booleans with is`, not `Booleans should be prefixed`)
- State one rule per bullet as a single directive line
- State what to do and what not to do. Add one short reason when the why is not obvious, inside the limits in `## Shape`.

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

A scoped description, a `paths` list, and one directive per bullet, one of them carrying a short reason.

```markdown
---
description: Enforce migrations, bound queries, and transaction ownership for persistence code
paths:
  - '**/*.ts'
---

# Persistence standards

## Schema changes

- Express every schema change as a migration file committed to version control.
- Never edit a migration that has run in a shared environment. Add a new one.

## Query construction

- Pass every runtime value as a bound parameter.
- Map a table name or sort direction through an allow-list, since neither can be bound.
```

### Incorrect

A vague description, legacy Cursor keys, and a paragraph of reasoning in place of directives.

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
