---
title: Project ledger reference
description: Where a project's rule and skill ledgers live under canon/ledger/, and the row shape both audits check, one table per H2 and one row per bullet
---

# Project ledger reference

## Contents

- [Overview](#overview)
- [Where it lives](#where-it-lives)
- [Shape](#shape)
- [Rows](#rows)
- [Example](#example)

## Overview

A ledger names what stands behind each bullet of a rule or a skill file, kept beside the file rather than inside it, so the reasoning costs no load. A bullet claiming outside practice names its source, and a bullet recording a project decision names what it prevents.

A project writes a ledger where it wants one and owes none. `canon gov audit` and `canon claude skills audit` check each ledger that exists against its file and report a ledger whose file is gone.

## Where it lives

Every ledger sits under `canon/ledger/`, which Claude Code never loads. A ledger under `.claude/rules/` would load as a rule on every matching read.

- A rule at `.claude/rules/project/<subdir>/<slug>.md` takes `canon/ledger/rules/<subdir>/<slug>.md`
- A skill body at `.claude/skills/<skill>/SKILL.md` takes `canon/ledger/skills/<skill>/SKILL.md`
- A skill reference at `.claude/skills/<skill>/references/<file>.md` takes `canon/ledger/skills/<skill>/<file>.md`, dropping the `references/` segment
- Move or delete a ledger in the change that moves or deletes its file, since the audits report one left behind

## Shape

The audits match rows to bullets by count under a heading of the same name, so the shape is fixed and whether a row supports its bullet is a review judgment.

- Write one `## <heading>` per H2 in the file, spelled as the file spells it
- Put one table under each heading, with one row per bullet in the file's order
- Give a file with no H2 one table under the title
- Write no other table in the ledger, since every table row under a heading counts. A sample table inside a code fence is not counted.

A skill file counts a few lines differently from a rule.

- Give each top-level ordered step a row, the way a bullet takes one
- Give `## Contents` no table, since it repeats the headings
- Stop a `SKILL.md` ledger's tables at the body's first closing section, such as `## Excuses and rebuttals` or `## What this delegates`, since a table under one reads as rows with no bullets

## Rows

Each row names the bullet and the one thing behind it.

- **Sourced:** a link to the primary source, with the line it says, such as the framework's own docs or the language spec
- **House choice:** a cell opening `House choice:` and naming the bug class the bullet prevents, when no outside source takes a side
- **Decision:** a house choice naming what the bullet prevents and the option it beat, with the date it was decided
- Cut a bullet that has neither a source nor a bug class behind it, rather than writing a row that says so

## Example

A project React rule in the `framework/` subdir, with two bullets under `## Component patterns`, takes this ledger at `canon/ledger/rules/framework/react.md`:

```markdown
---
title: React rule ledger
description: Sources for the project React rule, one row per bullet
---

# React rule ledger

## Component patterns

| Bullet                       | Source                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Stable keys over array index | [Rendering lists](https://react.dev/learn/rendering-lists): index keys cause subtle bugs      |
| Named exports                | House choice: a default export renamed at import drifts from the component's name in a search |
```
