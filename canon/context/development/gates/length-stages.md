---
title: Length stages
description: The Bullet stacks and Paragraph growth gate stages, their scope, and why they gate apart from the markdown audit's exit code
---

# Length stages

## Decisions

### Bullet stacks

The Bullet stacks stage reads every tracked context entry, docs page, and skill body and reference, and fails on a run of more than 5 plain top-level bullets under one heading. The failure names each file with its longest run and where it opens, so a contributor sees the whole set in one pass. A run whose every item opens with a bold label or a link is exempt, numbered items do not count, and no marker exempts a run, since a marker is how the ceiling's exemptions accumulated. Governance rules and `REQUIREMENT.md` sit outside the scope, because a rule is one imperative per bullet.

The stage and `canon markdown audit` read one definition in `src/markdown/stacks.ts`, so the report and the gate cannot disagree about what a run is. It gates here and not in the audit's exit code for the reason the Document ceiling stage gives: the plan and groundwork skills run the audit on gitignored records, where a long list is not a defect.

### Paragraph growth

The Paragraph growth stage reads the context entries the branch changed and fails on a paragraph past 700 characters or a top-level bullet past 250 whose text is absent from every context entry the merge base held. An unchanged long block passes wherever it now sits, a block moved into a sibling entry passes, and a block with one word changed fails. Emphasis marks and list markers are dropped before the comparison, so labelling a bullet or turning it into a paragraph is a shape change and not a text change. A nested bullet is not counted into its parent.

Only context entries are held to it. Length drifts there because `context-fold` appends after every merge: at the time of the decision 40% of context bullets sat past 250 characters against 8% to 15% on the other surfaces, and 105 context paragraphs sat past 700. In docs and skills the same numbers stay the audit's advisory warning. Gating every block already past a number was the rejected alternative, since the corpus carried hundreds and an edit is what grows one. No resolvable merge base reports unmeasured and never a pass.
