---
title: Length stages
description: The retired Bullet stacks and Paragraph growth gate stages, what each held, and why both folded into the Markdown stage's reading of the audit's exit
---

# Length stages

## Decisions

### Both stages retired into the Markdown stage

The density limits gate through `canon markdown audit`'s own exit now, and the Markdown stage reads it, so neither stage below runs. The audit's scope list keeps plans and records out, which answers the reason both stages once gated apart from the exit. `markdown-weights.md` in the audits folder carries the decision, and the two sections below record what each stage held.

### Bullet stacks

The Bullet stacks stage reads every tracked context entry, docs page, and skill body and reference, and fails on a run of more than 5 plain top-level bullets under one heading. The failure names each file with its longest run and where it opens, so a contributor sees the whole set in one pass. A run whose every item opens with a bold label or a link is exempt, numbered items do not count, and no marker exempts a run, since a marker is how the ceiling's exemptions accumulated. Governance rules and `REQUIREMENT.md` sit outside the scope, because a rule is one imperative per bullet.

The same run definition in `src/markdown/stacks.ts` is now the density bullet-run limit, gated in the same surfaces from the day the stage retired.

### Paragraph growth

The Paragraph growth stage reads the context entries the branch changed and fails on a paragraph past 700 characters or a top-level bullet past 250 whose text is absent from every context entry the merge base held. An unchanged long block passes wherever it now sits, a block moved into a sibling entry passes, and a block with one word changed fails. Emphasis marks and list markers are dropped before the comparison, so labelling a bullet or turning it into a paragraph is a shape change and not a text change. A nested bullet is not counted into its parent.

Only context entries were held to it, because `context-fold` appends after every merge. The two density length limits replaced it, gating every block in a folder once its batch rewrites it, rather than a block a branch grew.
