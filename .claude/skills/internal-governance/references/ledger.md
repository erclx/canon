---
title: Rule ledger template
description: The source ledger an outside-practice rule carries at governance/ledger/<folder>/<slug>.md, one table per H2 and one row per bullet, each row a source link or a house choice
---

# Rule ledger template

A rule under `lang/`, `lib/`, `framework/`, `ui/`, or `tooling/` claims outside practice, so each of its bullets names where that practice comes from. The ledger holds those sources outside the installed tree, so it costs no load and never ships.

## Where it lives

- Mirror the rule's path under `governance/ledger/`, so `governance/rules/framework/react.md` takes `governance/ledger/framework/react.md`
- Behavioral folders and `internal/rules/` carry none, since a behavioral bullet's source is the pull request `git log` already names
- A skill file on the per-bullet list in `src/claude/skills-audit.ts` takes `governance/ledger/skills/<skill>/<file>.md`, keyed by the file's own name
- So `claude/skills/design-taste/references/craft.md` takes `governance/ledger/skills/design-taste/craft.md`, and a listed `SKILL.md` takes `governance/ledger/skills/<skill>/SKILL.md`

## Shape

`canon gov audit` matches rows to bullets by count under a heading of the same name, so the shape is fixed and the content is a review judgment.

- One `## <heading>` per rule H2, spelled as the rule spells it
- One table under each heading, with one row per bullet in the rule's order
- A rule with no H2 takes one table under the title
- Write no table elsewhere in the file, since every table row under a heading counts

## Rows

Each row names the bullet and the one thing behind it.

- **Sourced:** a link to the primary source, with the line it says, such as the framework's own docs or the language spec
- **House choice:** the bug class the bullet prevents, when no outside source takes a side
- Cut a bullet that has neither, rather than writing a row that says so

```markdown
---
title: React rule ledger
description: Sources for governance/rules/framework/react.md, one row per bullet
---

# React rule ledger

## Component patterns

| Bullet                       | Source                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Stable keys over array index | [Rendering lists](https://react.dev/learn/rendering-lists): index keys cause subtle bugs      |
| Named exports                | House choice: a default export renamed at import drifts from the component's name in a search |
```

The worked ledgers from groundwork 158 showed both kinds of row, and each pass changed the rule it recorded, so write the ledger and the rule's rewrite together.
