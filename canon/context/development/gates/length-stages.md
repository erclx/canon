---
title: Length stages
description: The retired Bullet stacks and Paragraph growth stages, what each held, and why the Markdown stage replaced them
---

# Length stages

## Decisions

### Both stages retired into the Markdown stage

The density limits gate through `canon markdown audit`'s own exit, and the Markdown stage reads it, so neither stage below runs. The audit's scope list keeps plans and records out, which answers why both stages once gated apart from the exit. `markdown-weights.md` in the audits folder carries the decision.

### Bullet stacks

The stage read every tracked context entry, docs page, and skill body and reference, and failed on a run of more than 5 plain top-level bullets under one heading. The failure named each file with its longest run and where it opened.

- A run whose every item opens with a bold label or a link was exempt, and numbered items did not count
- No marker exempted a run, since a marker is how the ceiling's exemptions accumulated
- Governance rules and `REQUIREMENT.md` sat outside the scope, because a rule is one imperative per bullet

The same run definition in `src/markdown/stacks.ts` is now the density bullet-run limit, gated in the same surfaces from the day the stage retired.

### Paragraph growth

The stage read the context entries the branch changed and failed on a paragraph past 700 characters or a top-level bullet past 250 whose text was absent from every context entry the merge base held. Only context entries were held to it, because `context-fold` appends after every merge.

- An unchanged long block passed wherever it sat, and a block moved into a sibling entry passed
- A block with one word changed failed
- Emphasis marks and list markers were dropped before the comparison, so labelling a bullet or turning it into a paragraph was a shape change and not a text change
- A nested bullet was not counted into its parent

The two density length limits replaced it, gating every block in a folder once its batch rewrites it, rather than a block a branch grew.
