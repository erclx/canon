---
title: Document health axes
description: What each axis measures, the verb behind it, the evidence class it carries, and where a finding routes
---

# Document health axes

One section per axis. Each states what it measures, the verb that answers it, the evidence class the answer carries, and the surface a finding routes to.

The skill body holds the order, the guards, and the report shape. This holds the detail a run dereferences once it has a finding to place.

## Length

**Measures:** whether a document, or a passage inside it, has grown past what a reader takes in one pass.

**Verb:** `canon markdown audit --json`.

**Evidence class:** `measured`.

The record carries the checkpoints it read against under `checkpoints` and the per-file weights under `entries`. Read both from the record rather than from a number stated here, since the CLI moves a checkpoint on its own cadence and a copy of one goes stale in place.

Four weights answer this axis, each naming a different shape of overgrowth:

- `heavyBullets`: a top-level bullet past the character checkpoint, which is a paragraph wearing a dash
- `heavyParagraphs`: a paragraph past the sentence or character checkpoint
- `longestRun`, against `longestRunLine`: unbroken rendered lines between headings, which is the depth checkpoint
- `cadence`, carrying `measured`, `flat`, and `repeating`: sentence-length spread and repeated openers

Weight is a judgment a reader settles rather than a defect, which the verb states for itself and which this axis carries forward. A finding here is an argument for a split or a trim rather than a rule broken.

**Routes to:** a split of the document, or a move of the overgrown passage to the surface that owns it. Where the project states what a given document may hold, that statement decides whether the passage belongs in it at all, and the finding routes there rather than to a trim.

**Caveat:** the cadence numbers are drawn from prose a person reads straight through. Terse reference prose sits below that range correctly, so a flat paragraph in a table-heavy or bullet-heavy file is not a finding.

## Placement

**Measures:** whether a document's content sits in the file that owns it, and whether the catalogs pointing at it still resolve.

**Verbs:** `canon context audit --json` for the structural half, `canon context classify sweep --json` for the per-section verdicts.

**Evidence class:** `measured` for the audit's findings, `classified` for the sweep's verdicts.

The audit answers required sections, entry length, citation resolution, reference form, catalog tables, provenance, and index drift. A citation resolving to nothing is a fact and gates. Entry length, reference form, table shape, and provenance are judgments under every flag.

The sweep classifies each section as keep, replace or rewrite, history, or move. A `move` verdict is the placement finding proper, naming content sitting in the wrong document. Each verdict carries its own confidence, which is why the class is `classified` rather than `measured`, and a low-confidence `move` is a prompt to look rather than an instruction to cut.

**Routes to:** the document the verdict names as the owner. Where the move crosses a tier rather than a file, the project's own content-ownership rules decide the destination.

**Caveat:** both verbs resolve their folders by surface root rather than by a path written into them, so a project whose layout differs from the one they look for resolves nothing. The audit says so, refusing with `reason: "no-folders"` and naming the folders it looked for. Report that refusal as an unread axis. The sweep degrades differently: with the model layer off it answers from its regex layer alone, which is a narrower read rather than a refusal, so say which layer answered.

## Staleness

**Measures:** whether a document still describes the tree it was written about.

**Verb:** none.

**Evidence class:** `read`.

This is the axis the operator names first and the one nothing measures. A document goes stale by the tree moving under it rather than by anything changing in the document, so no property of the file answers it and a timestamp answers a different question. A file untouched for a year beside code untouched for a year is current, and one edited yesterday against a refactor from this morning is stale.

Read each document against the surfaces it names. Four claim shapes are testable without leaving the project:

- A file or folder path the document states, against whether it resolves
- A command or verb the document names, against whether it exists and carries the flags shown
- A count the document states over a tree, against the tree
- A cross-reference to another document, against what that document now says

A claim resting on none of the four is unverifiable from here. Report it as unread rather than as passing, which is the same rule the measured axes take when a verb refuses.

**Routes to:** the skill that rewrites a stale claim against an answer, rather than a direct edit from here. A document health run reports and never repairs.

**Caveat:** a reading is the weakest evidence in the report and the most consequential finding in it, which is the tension this axis ships with. Marking the class is what keeps the two facts together in the reader's hands.

## Why the three stay apart

The axes are not equally actionable and a report flattening them implies they are. A length finding is a number against a checkpoint, a placement finding is a verdict carrying a confidence, and a staleness finding is a judgment with nothing behind it. Each is worth reporting and each is worth a different response, so the class travels beside the state on every row rather than being stated once in a preamble a reader skims.

Shipping staleness on weaker evidence than the other two is the trade taken deliberately. Cutting it would leave the report answering the two questions that were never the operator's complaint.
