---
title: Document health
description: The three axes the document health check reports, why staleness ships on a reading, and where the skill sits against standards-audit and the target check
---

# Document health

`claude/skills/document-health/SKILL.md` reports which of a project's documents have rotted, one section per document, across length, placement, and staleness. It reports and never repairs. `target-check` is its structural pair, answering whether a document exists and holds the right sections, and this answers whether the ones that exist still earn their place.

## The three axes

Two answer from a verb and one answers from nothing.

- Length, from `canon markdown audit --json`, reading `heavyBullets`, `heavyParagraphs`, `longestRun`, and `cadence` against the `checkpoints` block the same record carries
- Placement, from `canon context audit --json` for the structural half and `canon context classify sweep --json` for the per-section verdicts
- Staleness, which no verb reads

`claude/skills/document-health/references/axes.md` holds what each one measures, the checkpoint it reads against, and where a finding routes. The body holds the order, the guards, and the report shape.

## Why the evidence class travels with every finding

The three axes answer to different evidence, and the plan behind this skill named the flattening as a risk before the skill existed. A length finding is a number against a stated checkpoint, a placement `move` verdict carries its own confidence, and a staleness finding is a reading with nothing behind it. A report listing the three together without marking them hands a reader a judgment wearing the authority of a measurement.

The marking runs per row rather than once in a preamble. A preamble is read once and a table is scanned, so the class has to sit where the eye lands on the finding.

The classes are `measured`, `classified`, and `read`. They are ordered by what a reader can check: a measurement can be re-run, a classification can be re-run and disagreed with, and a reading can only be re-taken.

## Why staleness ships on the weakest evidence

Staleness is the axis the operator named and the one with no verb behind it. A document goes stale by the tree moving under it rather than by anything changing in the document, so no property of the file answers the question. Modification time is the obvious proxy and it answers something else: a file untouched beside code untouched is current, and one edited yesterday against a refactor from this morning is stale.

Cutting the axis was the alternative, and it leaves the skill answering the two questions nobody complained about. It ships marked instead, which keeps the finding and its evidence class in the reader's hands together.

The reference narrows it to four claim shapes testable without leaving the project: a path, a named command or flag, a count over a tree, and a cross-reference to another document. A claim resting on none of the four is reported unread rather than passing, which is the rule the measured axes already take when a verb refuses.

## Why an unread axis is a third state

Both measured verbs resolve their folders by surface root rather than by a path written into them, so a project whose layout differs resolves nothing. Measured on a bare tree carrying a `.claude/` folder and a `README.md`, `canon context audit` refuses with `reason: "no-folders"` and names the folders it looked for. That refusal is the honest answer, and the skill's risk was that a run would read it as an empty finding set and report a healthy corpus for documents nothing looked at.

The classifier sweep degrades differently. With the model layer off it answers from its regex layer alone, which narrows the read without refusing it, so the report says which layer answered rather than treating the run as unread.

Both are the same rule `target-check` states as "unread is not current", taken one level down from a domain to an axis. `canon/context/claude-plugin/target-check.md` carries the original.

## Where it sits against the neighbors

- `standards-audit` is diff-scoped and standard-declared. It maps a changed file to the authoring standards that declare jurisdiction over its path and reports which stated rule it breaks, with a line. This skill is corpus-scoped and reads rot in documents nobody changed, which is the case a diff-scoped audit never reaches. The two sit beside each other, and the plan's first question was whether one absorbed the other. What the build showed is that the standards mapping is a fourth thing rather than one of the three axes, which is the evidence the question asked for.
- `target-check` asks the structural question across six domains and names document health as out of scope by design. This is the surface that scope was left for.
- `markdown-propose` rewrites a claim once a finding has named it. This reports and stops.
- `canon audits run` runs the toolkit's own checks as one gating set over its own corpus. It gates a push, and this reports to a reader in a project that may hold none of those gates.

## Open

- The skill and `standards-audit` are still two entries a session picks between on description alone. The boundary is stated in both requirements and nothing checks that the two descriptions stay disjoint as either is edited.
- Nothing checks that the axis list in the body, the reference, and this entry stay the same three. An axis added to one and not the others drifts silently, which is the gap `target-check.md` records against its own six domains.
- The staleness axis has no sandbox assertion that can fail on a wrong reading, since the reading is the thing under test. The scenario seeds a document carrying a path that resolves to nothing, which tests that the axis fires rather than that its judgment is sound.
