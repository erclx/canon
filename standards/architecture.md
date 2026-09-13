---
title: Architecture reference
description: Shape and content rules for canon/ARCHITECTURE.md
---

# Architecture reference

Applies to `canon/ARCHITECTURE.md`. Describes the system shape and the decisions behind it, not a tutorial, setup guide, or implementation walkthrough. Pair it with `CLAUDE.md`: principles live there, patterns and decisions live here. Update when a decision is made or a risk is resolved.

## Scope

Governs the system-shape document at `canon/ARCHITECTURE.md`: the overview, the decision entries, and the open risks.

Does not govern:

- Per-domain structure and narrative: `context.md`
- Setup commands and install instructions: `readme.md`
- Product scope, goals, and non-goals: `requirements.md`

## What goes in

- A high-level overview of how the system is structured and why
- Key technical decisions as named H3 entries: what was chosen and why over the alternatives, including stack and library choices
- Risks and open questions still unresolved

## What does not go in

- How individual functions work line by line. The code carries its own behavior.
- Full type definitions. They live in code. Reference the shape conceptually if needed.
- A measurement paragraph specific to one domain's own mechanism. Route it to that domain's `canon/context/<domain>.md` entry instead. The choice and its rejected alternative stay here whatever their reach, since reach is what makes a decision cross-domain, not how many domains its supporting measurement happens to touch.

## Sections

Use `## Overview`, `## Key technical decisions` with one named H3 per decision, and `## Risks / open questions`. Name each decision and give the reasoning, especially for non-obvious choices. Skip entries where the rationale is self-evident.

## Verification anchors

A decision's reasoning stays correct while the numbers it cites move. The anchor records what a measured claim was read against, so a reader can tell a number that was checked and held from one nobody has looked at since.

- Close a decision entry whose reasoning cites a measured number with a trailing sentence naming the short commit SHA and the ISO date that number was read: `Measured at <short-sha> on <YYYY-MM-DD>.`
- Anchor on the number alone. A decision citing none takes no anchor whatever its reasoning rests on, because a marker over a claim nobody can re-measure is one no reader can falsify.
- Anchor a decision when writing it or when amending its reasoning. Leave an entry written before the rule unanchored rather than dating it by blame, which is archaeology for a marker nothing reads back.
- Read an absent anchor as unchecked rather than as current. On an entry citing no number there is nothing to check. On one citing a number the number is due a read.
- Do not edit a claim in the pass that first anchors it. The anchor states what the claim was measured against, so changing both at once leaves nothing to check the anchor against.
- Refresh the anchor whenever the number is re-read, whether or not it moved. A confirmed number and an unread one are the same text without the date.

## Length

Every session pays for this file before any work starts, so a heavy read is a real cost. Judge weight by reading the file rather than by counting it: a file that reads heavy is carrying too many decisions, not decisions written too long.

- Bring a heavy file back by merging two decisions or retiring one, never by compressing a decision's prose.
- Yield to the paragraph weight checkpoint in `markdown.md`. A paragraph past the checkpoint is a defect no length guideline licenses.

## Template

The anchor sentence closes a decision whose reasoning cites a measured number and is absent from one that cites none.

```markdown
# Architecture

## Overview

## Key technical decisions

### Decision name

Reasoning and tradeoffs, carrying the measured number the choice rested on. Measured at <short-sha> on <YYYY-MM-DD>.

## Risks / open questions
```
