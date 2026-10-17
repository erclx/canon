---
title: Document health
description: The three axes the document health check reports, why staleness ships on a reading, and where the skill sits against the target check and its other neighbors
---

# Document health

`claude/skills/document-health/SKILL.md` reports which of a project's documents have rotted, one section per document, across length, placement, and staleness. It reports and never repairs.

`target-check` is its structural pair. It answers whether a document exists and holds the right sections, and this skill answers whether the ones that exist still earn their place.

## Decisions

### The three axes

Two axes answer from a verb and one answers from nothing.

- Length, from `canon markdown audit --json`, reading `heavyBullets`, `heavyParagraphs`, `longestRun`, and `cadence` against the `checkpoints` block the same record carries
- Placement, from `canon context audit --json` for the structural half and `canon context classify sweep --json` for per-section verdicts
- Staleness, which no verb reads

`claude/skills/document-health/references/axes.md` holds what each measures, its checkpoint, and where a finding routes. The body holds the order, the guards, and the report shape.

### Why the evidence class travels with every finding

The three axes answer to different evidence, and the plan behind this skill named the flattening as a risk before the skill existed. A report listing them together without marking them hands a reader a judgment wearing the authority of a measurement.

- A length finding is a number against a stated checkpoint
- A placement `move` verdict carries its own confidence
- A staleness finding is a reading with nothing behind it

The marking runs per row rather than once in a preamble, because a preamble is read once and a table is scanned. The classes are `measured`, `classified`, and `read`, ordered by what a reader can check. A measurement can be re-run, a classification can be re-run and disagreed with, and a reading can only be re-taken.

### Why staleness ships on the weakest evidence

Staleness is the axis the operator named and the one with no verb behind it. A document goes stale by the tree moving under it, so no property of the file answers the question. Modification time answers something else, since a file untouched beside untouched code is current and one edited yesterday against a refactor this morning is stale.

- Cutting the axis was the alternative, and it leaves the skill answering the two questions nobody complained about
- It ships marked instead, which keeps the finding and its evidence class together

The reference narrows it to four claim shapes testable without leaving the project, being a path, a named command or flag, a count over a tree, and a cross-reference to another document. A claim resting on none of the four is reported unread rather than passing, the rule the measured axes already take when a verb refuses.

### Why an unread axis is a third state

Both measured verbs resolve their folders by surface root rather than by a path written into them, so a project whose layout differs resolves nothing. On a bare tree with a `.claude/` folder and a `README.md`, `canon context audit` refuses with `reason: "no-folders"` and names the folders it looked for.

That refusal is the honest answer. The risk was a run reading it as an empty finding set and reporting a healthy corpus for documents nothing looked at.

- The classifier sweep degrades differently. With the model layer off it answers from its regex layer alone, which narrows the read without refusing it.
- The report says which layer answered rather than treating the run as unread

Both are the rule `target-check` states as "unread is not current", taken one level down from a domain to an axis. `canon/context/claude-plugin/target-check.md` carries the original.

### Why the requirements record gets an identity read

A fold allowed to write `canon/REQUIREMENTS.md` on any ship drifts it one reasonable edit at a time, with nothing reading it whole. `context-fold` never writes it, which leaves this skill as the one surface reading it.

When the scope reaches the record, the staleness axis tests identity claims beside the four path-shaped ones. These are a goal nobody pursues, a non-goal since shipped, and a constraint the tree contradicts.

### The review point

The review point comes from `canon records stale canonical`, which reads an optional `reviewed: YYYY-MM-DD` frontmatter field on the record and counts the release tags merged into HEAD after it.

- The point is a date rather than a commit because this repository squash-merges, so a review commit written on a feature branch never reaches `main`
- The verb sits under `canon records stale` rather than a new `canon context review`, since it extends a verb whose job is already what is due for review
- The cost is one tracked kind in a group otherwise about gitignored records
- The record is tracked, so the verb reads the current worktree rather than the main one

Nothing triggers the review but a request. Intake 137 item 7 proposed a `target-check` pointer, and the operator withdrew every trigger, hook, gate stage, and CI step with it. The skill prints one reminder line per record and hands a finished review's rewrite to the operator, whose last edit sets the stamp. This skill writes neither.

### Where it sits against the neighbors

The rewrite of a claim a finding has named belongs to the operator, and this skill reports and stops. Two neighbors cover adjacent ground.

- `target-check` asks the structural question across six domains and names document health as out of scope by design. This is the surface that scope was left for.
- `canon audits run` runs the toolkit's own checks as one gating set over its own corpus. It gates a push, and this skill reports to a reader in a project that may hold none of those gates.
- `canon audits run` carries the classifier sweep too, pinned to the regex layer so its tally reads the same on every clone. This skill is the one surface using the model layer.

## Gotchas

### Open gaps

Two checks are missing, and both are known rather than hidden.

- Nothing checks that the axis list in the body, the reference, and this entry stay the same three, so an axis added to one drifts silently
- `canon/context/claude-plugin/target-check.md` records the same gap against its own six domains
- The staleness axis has no sandbox assertion that can fail on a wrong reading, since the reading is the thing under test
- The scenario seeds a document carrying a path that resolves to nothing, which tests that the axis fires rather than that its judgment is sound
