---
title: Document health axes
description: What each axis measures, the verb behind it, the evidence class it carries, and where a finding routes
---

# Document health axes

One section per axis. Each states what it measures, the verb that answers it, the evidence class the answer carries, and the surface a finding routes to.

The skill body holds the order, the guards, and the report shape. This holds the detail a run dereferences once it has a finding to place.

## Length

| Field          | Value                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------ |
| Measures       | Whether a document, or a passage inside it, has grown past what a reader takes in one pass |
| Verbs          | `canon markdown audit --json`, and `canon gov audit --json` for a rule                     |
| Evidence class | `measured`                                                                                 |

The record carries the checkpoints it read against under `checkpoints` and the per-file weights under `entries`. Read both from the record rather than from a number stated here, since the CLI moves a checkpoint on its own cadence and a copy goes stale in place.

- `heavyBullets`: a bullet past the character checkpoint, a nested one measured on its own, which is a paragraph wearing a dash
- `heavyParagraphs`: a paragraph past the sentence or character checkpoint
- `longestRun`, against `longestRunLine`: unbroken rendered lines between headings, which is the depth checkpoint
- `cadence`, carrying `measured`, `flat`, and `repeating`: sentence-length spread and repeated openers
- `rules[].findings`: a rule past one of its own six shape limits or carrying an emphasis word, since the density weights above never read a rule file

### Reading a length finding

Weight is a judgment a reader settles rather than a defect, as the verb states for itself. A finding here argues for a split or a trim rather than naming a broken rule.

- **Routes to:** a split of the document, or a move of the overgrown passage to the surface that owns it
- **A project statement of what a document may hold** decides whether the passage belongs, and the finding routes there rather than to a trim
- **Caveat:** the cadence numbers are drawn from prose read straight through. Terse reference prose sits below that range correctly, so a flat paragraph in a table or bullet-heavy file is no finding.

## Placement

| Field          | Value                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Measures       | Whether a document's content sits in the file that owns it, and whether the catalogs pointing at it resolve              |
| Verbs          | `canon context audit --json` for the structural half, `canon context classify sweep --json` for the per-section verdicts |
| Evidence class | `measured` for the audit's findings, `classified` for the sweep's verdicts                                               |

The audit answers required sections, entry length, citation resolution, reference form, catalog tables, provenance, and index drift. Required sections reach context entries.

- A citation resolving to nothing is a fact and gates
- Entry length, reference form, table shape, and provenance are judgments under every flag

### The sweep's verdicts

The sweep classifies each section as keep, replace or rewrite, history, or move. A `move` verdict is the placement finding proper, naming content sitting in the wrong document.

- Each verdict carries its own confidence, which is why the class is `classified` rather than `measured`
- A low-confidence `move` is a prompt to look rather than an instruction to cut
- **Routes to:** the document the verdict names as the owner. Where the move crosses a tier rather than a file, the project's own content-ownership rules decide the destination.

### The structure line

The audit record's `length` array lists each entry past the line checkpoint, and `coverage.findings` lists the `doubled` and `unnamed` ones. The structure line reads both, so it carries the `measured` class for the finding and `read` for the proposal built on it.

- **Overgrown entry:** read its `causes` in `length` first, since `history: yes` points at cutting provenance and one domain at a trim, so neither earns a split
- **Split:** group the Layout headings by domain, one new entry per group beyond the first, naming each entry's headings and one reason
- **Domain boundaries:** no verb measures one, so state the grouping as a judgment.
- **Doubled coverage:** two entries describe one source area. Propose the one that owns it, from which entry already holds the area's traps, and the other points at it.
- **Unnamed coverage:** no entry names the area. Propose an owner among the existing entries before a new one, since a new entry is the larger change.

A proposal names headings and a reason, so an operator judges a concrete split. A split nobody can act on names none of those.

### When a verb resolves nothing

Both verbs resolve their folders by surface root rather than by a path written into them, so a project laid out differently resolves nothing. The two degrade differently.

- The audit refuses with `reason: "no-folders"`, naming the folders it looked for. Report that refusal as an unread axis.
- The sweep with the model layer off answers from its regex layer alone, a narrower read rather than a refusal, so say which layer answered

## The design record

| Field          | Value                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Measures       | Whether the design record holds to its prose budget and names only properties its stylesheet has |
| Verb           | `canon design audit --json`                                                                      |
| Evidence class | `measured`                                                                                       |

The record is exempt from the length and placement verbs above, so this is the only measured read it gets.

- `prose`: each place the record passes the budget, with the count and the cap it was read against. Take the caps from the finding rather than from a number written here.
- `tokens.missing`: a custom property a table names that the stylesheet the lead names does not declare
- `tokens.status: "unchecked"`: the lead names no stylesheet, or the one it names does not resolve. Report the axis as unread with the `reason`, since nothing was compared.
- `tokens.status: "not-applicable"`: a values record, which carries `Value` where an intent record carries `Property`. Report it as not applicable with the `reason`.
- `record: null`: the project holds no design record, so there is nothing to report

`tokens.themes` is present only where the record declares `themes:`, with one cell per theme carrying its `selector`, `matched`, and `missing`. A cell with `matched: false` means no block opens that selector, and one with `missing` names the color properties that theme leaves out. Report either under its selector.

**Routes to:** `design-record`, which owns the record's shape. `document-repair` rewrites a context folder and does not know the budget.

## Staleness

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| Measures       | Whether a document still describes the tree it was written about |
| Verb           | None                                                             |
| Evidence class | `read`                                                           |

This is the axis the operator names first and the one nothing measures. A document goes stale by the tree moving under it, so no property of the file answers it and a timestamp answers a different question.

A file untouched for a year beside code untouched for a year is current, and one edited yesterday against a refactor from this morning is stale. Read each document against the surfaces it names, testing four claim shapes without leaving the project.

- A file or folder path the document states, against whether it resolves
- A command or verb the document names, against whether it exists and carries the flags shown
- A count the document states over a tree, against the tree
- A cross-reference to another document, against what that document now says

A claim resting on none of the four is unverifiable from here. Report it as unread rather than as passing, the same rule the measured axes take when a verb refuses.

### Identity drift in the requirements record

This record states what the project is and why, so it goes stale by the project changing direction as well as by the tree moving. Test these claim shapes beside the four above, each a `read`.

- A goal nobody pursues, read against the task board and the recent history
- A non-goal the project has since shipped
- A constraint the tree contradicts

### The review point

The review point beside them is `measured`, for the requirements record and the design record alike. `canon records stale canonical --json` returns the `reviewed` date from each record's frontmatter and `releasesSince`, the release tags merged into HEAD after that day.

- A null `releasesSince` means the doc was never reviewed
- `tagged: false` means no release tag exists to count, so a zero there measured nothing
- The count is a reminder of how far the project has moved since someone last read the record whole, never a threshold

### Routing a staleness finding

A document health run reports and never repairs, so a stale claim routes to the skill that rewrites it against an answer rather than to a direct edit from here.

A reading is the weakest evidence in the report and the most consequential finding in it, which is the tension this axis ships with. Marking the class keeps the two facts together in the reader's hands.

## Why the three stay apart

The axes are not equally actionable, and a report flattening them implies they are. Each is worth reporting and each is worth a different response, so the class travels beside the state on every row rather than once in a preamble a reader skims.

- A length finding is a number against a checkpoint
- A placement finding is a verdict carrying a confidence
- A staleness finding is a judgment with nothing behind it

Shipping staleness on weaker evidence than the other two is the trade taken deliberately. Cutting it would leave the report answering the two questions that were never the operator's complaint.
