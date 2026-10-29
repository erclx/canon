---
title: Rule ledger template
description: The ledger a toolkit rule carries at governance/ledger/<folder>/<slug>.md, one table per H2 and one row per bullet, each row a source link or a house choice
---

# Rule ledger template

A rule under `lang/`, `lib/`, `framework/`, `ui/`, or `tooling/` claims outside practice, so each of its bullets names where that practice comes from.

A core rule under `canon/`, `claude/`, `code/`, or `writing/` records a decision instead, so each of its bullets names what it prevents and the option it beat. The ledger holds either kind outside the installed tree, so it costs no load and never ships.

## Where it lives

- Mirror the rule's path under `governance/ledger/`, so `governance/rules/framework/react.md` takes `governance/ledger/framework/react.md`
- `internal/rules/` carries none, since those rules read only in this repository
- A ledgered file of a skill on the per-bullet list in `src/claude/skills-audit.ts`, being each reference it does not exempt and a marked body, takes `governance/ledger/skills/<skill>/<file>.md`
- So `claude/skills/design-taste/references/craft.md` takes `governance/ledger/skills/design-taste/craft.md`, and a listed `SKILL.md` takes `governance/ledger/skills/<skill>/SKILL.md`

### When a core rule owes one

Coverage grows only as core rules are touched, since nobody wrote down the reasoning behind the older bullets.

- Write a core rule's ledger in the change that creates or edits the rule. An untouched core rule with none passes.
- `canon gov audit --touched` owes a ledger for each core rule the branch changed against `origin/main`, and the push gate runs it that way
- Move or delete a core rule's ledger in the same change as the rule, since a ledger left at the old path reads as missing for the moved rule

## Shape and rows

The shipped `claude/skills/create-rule/references/ledger.md` owns the row shape both audits check, one table per H2 and one row per bullet, and the sourced and house-choice rows. Only that copy reaches a project, so this file adds the toolkit's paths above and the two row kinds a core rule takes below.

- **Core decision:** a house choice naming what the bullet prevents and the option it beat, with the decision date alone in `Read`
- **Core, reason lost:** `House choice: Unknown` where nobody remembers why a touched bullet exists, which marks it for `internal-rule-audit`

A core row reads this way:

```markdown
| Bullet                            | Source                                                                                                                                     | Read       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Keep a seconds command foreground | House choice: each wake costs a turn, so backgrounding a quick command spends two turns where one did. It beat backgrounding every command | 2026-10-26 |
```

The worked ledgers from groundwork 158 showed both kinds of row, and each pass changed the rule it recorded, so write the ledger and the rule's rewrite together.
