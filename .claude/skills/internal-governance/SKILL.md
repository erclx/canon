---
name: internal-governance
description: Governance rules and stack definitions. Source `.md` files install as path-scoped Claude rules in `.claude/rules/`. Use for adding rules, editing stacks, or install and sync.
---

# Governance

Read `canon/context/surfaces/governance.md` for the system overview, rule naming, stack structure, and install and sync before editing.

## Rules

- Read `canon/context/surfaces/governance.md` for how a rule is named before picking a slug for a new one.
- Follow `claude/skills/create-rule/references/rule.md` for frontmatter, heading style, and bullet conventions when writing a new rule file.
- `ruleSubdir` lives in `src/gov/install.ts` and frontmatter stripping in `src/markdown/frontmatter.ts`. Do not duplicate either.

### Engine and adapter

Every verb is TypeScript. What counts as a change, or where a rule's source lives, belongs in the adapter, and the scan report, the prompt, and the apply loop belong in the engine, where any future adapter inherits them.

| Part           | File                 |
| -------------- | -------------------- |
| Sync engine    | `src/sync/engine.ts` |
| Gov adapter    | `src/gov/adapter.ts` |
| Payload        | `src/gov/payload.ts` |
| Stack resolver | `src/gov/stacks.ts`  |
| `list` catalog | `src/gov/list.ts`    |

`internal/rules/` follows the naming and frontmatter convention of `governance/rules/`, per `canon/context/surfaces/governance.md`, and mirrors to `.claude/rules/internal/`.

## Install path

- `canon gov install <stack> <target>` copies each source `.md` as-is to `.claude/rules/<subdir>/<rule>.md`, preserving subdirectories, since sources carry the Claude shape directly.
- `canon gov sync` diffs `.claude/rules/` against source. It also removes any stale `.claude/GOV.md` left over from the retired build.
- `canon gov build` produces a single concatenated paste-payload at `.canon/tmp/gov/rules.md` from `.claude/rules/`.

## Stacks

- New stack: create a `.toml` in `governance/stacks/`, set `extends`, list rule names without `.md`

## Sync checklist

When adding a rule:

- Add it to the relevant `rules` array in `governance/stacks/*.toml` if it belongs to a stack

When adding a stack:

- Create `.toml` in `governance/stacks/`, set `extends`, list rules

## Rule audit

After writing or revising a rule, or on "audit this rule" or "review the governance rule", audit each bullet against the checklist.

- Read `claude/skills/create-rule/references/checklist.md` for the criteria and output shape. It ships with `canon:create-rule`, so a target runs the same checklist.
- A toolkit rule under `lang/`, `lib/`, `framework/`, `ui/`, or `tooling/` carries a source ledger at `governance/ledger/<folder>/<slug>.md`, shaped per `references/ledger.md`.
- A core rule under `canon/`, `claude/`, `code/`, or `writing/` created or touched on the branch carries a decision ledger at the same path, written in that change.
- Run `bun src/cli.ts gov audit --touched <path>` on the rule, and fix every shape and ledger finding before reporting.
- A verdict on whether a whole rule earns its place, where it loads, and whom it reaches is `internal-rule-audit`.

## Reference

- `canon/context/surfaces/governance.md`: the domain entry, covering rules and their names, stacks, and install and sync
- `claude/skills/create-rule/references/rule.md`: conventions for writing rule files
