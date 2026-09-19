---
title: Architecture reference
description: Shape and content rules for canon/ARCHITECTURE.md
---

# Architecture reference

Applies to `canon/ARCHITECTURE.md`. Describes the system shape and the decisions behind it, not a tutorial, setup guide, or implementation walkthrough. Pair it with `CLAUDE.md`: session behavior lives there, and the system's shape lives here. Update when a decision is made or a risk is resolved.

## Scope

Governs the system-shape document at `canon/ARCHITECTURE.md`: the overview, the decision entries, and the open risks.

Does not govern:

- Per-domain structure and narrative: `context.md`
- Setup commands and install instructions: `readme.md`
- Product scope, goals, and non-goals: `requirements.md`

## What goes in

- A high-level overview of how the system is structured and why
- Key technical decisions as named H3 entries, each filling one of the five slots below: what was chosen and why over the alternatives
- Risks and open questions still unresolved

A decision belongs here only when it fills a slot:

- Stack and runtime: the language, the runtime, and the major libraries the system is built on
- Delivery: how the system's content or code reaches the place it runs
- Enforced boundaries: a boundary the system checks mechanically, and what enforces it
- Layout: how the project's top-level roots and context tiers divide what they hold
- Build principles: a rule for how a behavior is built that changes work in more than one domain, stated in one sentence

The slots come from a scale test. Ask whether the decision would still be in this file if the project were ten times its size. At that size an always-loaded file holding one entry per decision fits no context window, and what survives is the shape: the stack, the delivery, the boundaries, the layout, and the principles. A decision that fits no slot is a domain decision, and its home is that domain's `canon/context/<domain>.md` entry under `## Decisions`, however many domains its reasoning touches. Reach is not the test, since nearly every decision reaches a second domain.

## What does not go in

- How individual functions work line by line. The code carries its own behavior.
- Full type definitions. They live in code. Reference the shape conceptually if needed.
- A decision that fills no slot. It lives in the domain context entry it constrains, and this file carries at most one line pointing at it.
- A measurement paragraph specific to one domain's own mechanism, even behind a slot decision. Route it to that domain's context entry and keep the choice, the alternative that lost, and one reason here.
- The instances of a build principle. The principle takes one sentence here, and each instance lives in the domain entry where it applies.
- The history of how a decision was reached or revised: rounds of candidates, a figure followed by its correction, a branch or change that moved a number. That trail goes to the decision log or the change that introduced it.

## Sections

Use `## Overview`, `## Key technical decisions` with one named H3 per decision, and `## Risks / open questions`. Name each decision and give the reasoning, especially for non-obvious choices. Skip entries where the rationale is self-evident.

## Keeping it current

- Rewrite a decision a later one changed rather than appending the change beside it. A reader should find the design that stands in one place, with the alternative that lost stated once.
- Hold only what is open under `## Risks / open questions`. An entry leaves the section in the change that settles it, becoming a decision here when it fills a slot and moving to the domain context entry it constrains when it does not.

## Verification anchors

A decision's reasoning stays correct while the numbers it cites move. The anchor records what a measured claim was read against, so a reader can tell a number that was checked and held from one nobody has looked at since.

- Close a decision entry whose reasoning cites a measured number with a trailing sentence naming the short commit SHA and the ISO date that number was read: `Measured at <short-sha> on <YYYY-MM-DD>.`
- Name a commit, never a pull request number or a branch. A branch is gone after merge, and a pull request number resolves only on the forge.
- Carry one anchor per figure. When a number is re-measured, rewrite the number and its anchor in place, and leave the old value to the change that moved it.
- Point at a generated file that already records a figure and its commit, rather than copying the figure and anchoring the copy.
- Anchor on the number alone. A decision citing none takes no anchor whatever its reasoning rests on, because a marker over a claim nobody can re-measure is one no reader can falsify.
- Anchor a decision when writing it or when amending its reasoning. Leave an entry written before the rule unanchored rather than dating it by blame, which is archaeology for a marker nothing reads back.
- Read an absent anchor as unchecked rather than as current. On an entry citing no number there is nothing to check. On one citing a number the number is due a read.
- Do not edit a claim in the pass that first anchors it. The anchor states what the claim was measured against, so changing both at once leaves nothing to check the anchor against.
- Refresh the anchor whenever the number is re-read, whether or not it moved. A confirmed number and an unread one are the same text without the date.

## Entry cap

Every session pays for this file before any work starts, so a heavy read is a real cost. A file that reads heavy is carrying too many decisions, not decisions written too long, so the bound is a count of decisions rather than of words.

- State the cap in the record itself as a clause of the form `This record holds at most <n> decisions.` The cap is the record's own, so a checker reads it from the file, and a record stating none is measured and never gated.
- Set the cap near one decision per slot plus a small margin.
- At the cap, merge two decisions or retire one before adding another, and name which in the change that does it. Never compress a decision's prose to fit, and never pack two decisions under one heading, which the count cannot see.
- Retire a decision by moving it to the domain context entry it constrains, not by deleting its reasoning.
- A word count, for the file and for each decision, is read alongside the judgment when one is available, and it never gates.
- Yield to the paragraph weight checkpoint in `markdown.md`. A paragraph past the checkpoint is a defect no length guideline licenses.

## Template

The anchor sentence closes a decision whose reasoning cites a measured number and is absent from one that cites none. Each heading below names a slot, so a record starts with one decision per slot and renames each heading to the choice it records.

```markdown
# Architecture

## Overview

This record holds at most 12 decisions.

## Key technical decisions

### Stack and runtime

What was chosen, the alternative that lost, and why. Measured at <short-sha> on <YYYY-MM-DD>.

### Delivery

### Enforced boundaries

### Layout

### Build principles

## Risks / open questions
```
