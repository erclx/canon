---
name: internal-governance
description: Governance rules and stack definitions. Source `.md` files install as path-scoped Claude rules in `.claude/rules/`. Use for adding rules, editing stacks, or install and sync.
---

# Governance

Read `.claude/context/governance/overview.md` for the system overview and `.claude/context/governance/stacks.md` for stack structure before editing.

## Rules

- Read `.claude/context/governance/rules.md` for the numbering ranges before picking a number for a new rule.
- Follow `standards/rule.md` for frontmatter, heading style, and bullet conventions when writing a new rule file.
- `rule_subdir` is all that is left in `scripts/lib/gov.sh`. Frontmatter stripping is `src/frontmatter.ts`. Do not duplicate either.
- Every verb is TypeScript and `scripts/gov/` is gone. The sync engine is `src/sync/engine.ts`, the gov adapter is `src/gov/adapter.ts`, the payload builder is `src/gov/payload.ts`, the stack resolver is `src/gov/stacks.ts`, and the catalog behind `list` is `src/gov/list.ts`.
- Changing what counts as a change, or where a rule's source lives, belongs in the adapter. Changing the scan report, the prompt, or the apply loop belongs in the engine, where snippets and standards will inherit it.
- `internal/rules/` follows the same numbering and frontmatter convention as `governance/rules/`, per `.claude/context/governance/rules.md`, and mirrors to `.claude/rules/internal/`.

## Install path

- `canon gov install <stack> <target>` writes `.claude/rules/<subdir>/<rule>.md` as a passthrough copy. Source files carry the Claude shape directly, so the install copies the `.md` file as-is and preserves subdirectories.
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

After writing or revising a rule, audit each bullet against the checklist. Trigger phrases: "audit this rule", "review the governance rule", "is this rule worth keeping".

- Read `.claude/skills/internal-governance/references/rule-audit.md` for the criteria and output shape.

## Reference

- `.claude/context/governance/index.md`: the domain catalog, with the overview, rules and their numbering, stacks, and install and sync as sub-areas
- `standards/rule.md`: conventions for writing rule files
