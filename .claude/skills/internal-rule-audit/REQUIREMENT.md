---
name: internal-rule-audit
description: Scope boundary for the per-rule verdict over the governance rule set, and what stays with the bullet checklist and the verbs it reads
---

# Internal rule audit requirement

## Gap

Without this skill, a rule review is re-derived by hand every time, reading load mode, stack membership, and restatements one rule at a time and landing on verdicts nobody can repeat. The failure that cost most was reach: generic code rules loaded in every `base` project, docs and writing projects included, because no check ever asked which projects a rule's stacks reach and whether those projects have the rule's subject.

The bullet checklist does not close this. It judges whether a freshly written bullet is well formed, and a well-formed bullet loading in a project that can never apply it passes every criterion it holds.

## Must

- Emit one row per rule in the corpus, covering `governance/rules/` and `internal/rules/`, with a rule no stack selects reported as opt-in or as reaching nothing rather than skipped
- Read audience from stack membership and load mode from `paths`, each through the verb or frontmatter that answers it
- Read an `internal/rules/` rule's load mode from its frontmatter, since `gov list` does not list it
- Name the deciding check on every row, and keep the verdict set closed at keep, move, retire, and merge
- Attach the parsing file to a retire or merge verdict on a rule some verb reads by heading, and hold the row when an open branch edits the rule

## Must not

- Write a rule, a stack, or a task file. The skill reports verdicts, and a plan acts on them.
- Name a governance folder, a band, or a rule number in the body or its reference. A regroup renames most of the set, and each hardcoded name is one stale line per rename.
- Work around the restatement matcher here. A gap it leaves is fixed in `canon gov restated` rather than read by hand in this skill.

## Guards

- Run the verbs from the checkout, since the global binary reads a published package older than the tree under audit.
- Report a check whose source is silent as unread rather than as a pass.

## Out of scope

- Judging a single bullet of a rule just written or revised, which the bullet checklist in `internal-governance` owns
- Lifting the mechanical checks into a `canon gov` verb, deferred until the hand reads repeat
- Acting on a verdict, which belongs to the plan that reads the report
