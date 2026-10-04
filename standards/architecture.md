---
title: Architecture reference
description: Shape and content rules for canon/ARCHITECTURE.md
paths:
  - 'canon/ARCHITECTURE.md'
rule:
  - "Add a decision here only when it fills one of the standard's slots, and write any other decision into the context entry for the domain it constrains. At the record's stated cap, merge or retire an entry before adding one."
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
- The history of how a decision was reached or revised: rounds of candidates, a figure followed by its correction, a branch or change that moved a number. Cut it. Git and the change that introduced it keep the trail.

## Sections

Use `## Overview`, `## Key technical decisions` with one named H3 per decision, and `## Risks / open questions`. Name each decision and give the reasoning, especially for non-obvious choices. Skip entries where the rationale is self-evident.

## Keeping it current

- Rewrite a decision a later one changed rather than appending the change beside it. A reader should find the design that stands in one place, with the alternative that lost stated once.
- Hold only what is open under `## Risks / open questions`. An entry leaves the section in the change that settles it, becoming a decision here when it fills a slot and moving to the domain context entry it constrains when it does not.
- Carry an optional `reviewed: YYYY-MM-DD` frontmatter field naming the day someone last read the record whole for drift. Whoever finishes that review sets it as the review's last edit, and `canon records stale canonical` reads it to count the releases shipped since. A record with no field reads as never reviewed.

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

## Revisit condition

A decision says why it won and rarely says when that reason stops holding, so an entry can go stale while every word in it stays true. The revisit sentence names the finding that would show the harm the decision prevents has gone or moved.

- Close each decision with one sentence of the form `Revisit when <finding>.` Name something a reader could notice, such as a platform release, a measured count crossing a line, or a dependency dropping a behavior.
- Draft it from the harm the decision prevents, never from the mechanism it uses. A mechanism can keep working long after the reason for choosing it is gone, so re-checking it confirms the wrong fact.
- Place the sentence after the reasoning and before any verification anchor, so the anchor stays the entry's last sentence.
- Give a heading holding several principles one sentence, for the premise they share, rather than one per principle.
- Adopt the requirement by stating the clause `Every decision closes with a revisit sentence.` in the record itself. The clause is the record's own, like the caps, so a checker reads it from the file and gates only a record that states it. A record stating none is reported and never gated.
- A checker reads presence alone. A vacuous sentence passes it, so the sentence is only as useful as the finding it names.

## Caps

Every session pays for this file before any work starts, so a heavy read is a real cost. Weight comes from two places, too many decisions and decisions written too long, so the record caps both, and caps the open risks beside them.

- State each cap in the record itself. A checker reads only these spellings, so a clause worded another way is reported and never gated:
  - `This record holds at most <n> decisions.`
  - `at most <n> words a decision`, counting a decision's prose below its heading, fenced lines left out
  - `at most <n> risk bullets`, counting every list item under `## Risks / open questions`, nested ones included
- The three can share one sentence, such as `This record holds at most 12 decisions, at most 150 words a decision, and at most 6 risk bullets.` Each cap is the record's own, so a record stating none is measured and never gated. The template and the seed a new project installs state all three, and a project loosens one by editing the number in its own record.
- Set the decision cap near one decision per slot plus a small margin, the word cap near what one trade takes to state, about 150, and the risk cap at what a reader holds in mind at once, about 6.
- At the decision cap, merge two decisions or retire one before adding another, and name which in the change that does it. Never pack two decisions under one heading, which the count cannot see.
- At the word cap, cut a decision to the choice, the alternative that lost, the reason, and the revisit sentence. What it sheds is a mechanism or a measurement, which goes to the domain context entry it constrains, never under a second heading.
- At the risk cap, drop what is no longer open before adding a risk.
- Retire a decision by moving it to the domain context entry it constrains, not by deleting its reasoning.
- The whole file's word count stays a report, read alongside the judgment, and never gates.
- Yield to the paragraph weight checkpoint in `markdown.md`. A paragraph past the checkpoint is a defect no length guideline licenses.

## Template

The revisit sentence closes the reasoning of every decision. The anchor sentence follows it on a decision whose reasoning cites a measured number and is absent from one that cites none. Each heading below names a slot, so a record starts with one decision per slot and renames each heading to the choice it records.

```markdown
# Architecture

## Overview

This record holds at most 12 decisions, at most 150 words a decision, and at most 6 risk bullets. Every decision closes with a revisit sentence.

## Key technical decisions

### Stack and runtime

What was chosen, the alternative that lost, and why. Revisit when <finding>. Measured at <short-sha> on <YYYY-MM-DD>.

### Delivery

### Enforced boundaries

### Layout

### Build principles

## Risks / open questions
```
