---
name: internal-rule-audit
description: Scope boundary for the per-rule verdict over the governance rule set, and what stays with the bullet checklist and the verbs it reads
---

# Internal rule audit requirement

## Gap

Without this skill, a rule review is redone by hand each time, one rule at a time, landing on verdicts nobody can repeat. Reach is the costly miss. A generic code rule loads in every `base` project, docs projects included, since no check asks which projects a rule's stacks reach.

The bullet checklist does not close this. A well-formed bullet loading in a project that can never apply it passes every criterion that checklist holds.

## Must

- The report carries one row per rule across `governance/rules/` and `internal/rules/`, and a rule no stack selects reads as opt-in or reaching nothing
- Audience comes from stack membership and load mode from `paths`, each read through the verb or frontmatter that answers it, with the verbs run from the checkout
- Every row names its deciding check, and the verdict is one of keep, move, retire, or merge
- A retire or merge on a rule a verb reads by heading names the parsing file, and a rule an open branch edits is held
- A check whose source is silent reads as unread rather than as a pass

## Must not

- Write a rule, a stack, or a task file
- Name a governance folder or a rule number in the body or its reference
- Work around a gap in `canon gov restated` by reading restatements by hand

## Out of scope

- Judging one bullet of a rule just written, which `create-rule` owns
