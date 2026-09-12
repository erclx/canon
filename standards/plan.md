---
title: Plan reference
description: Filename and slug, required sections, the suggested-and-answer contract, and the lifecycle from the live folder to the archive
---

# Plan reference

Applies to a feature plan at `.canon/plans/feature-<slug>.md`. One file holds one concern, written before implementation starts and read by whatever executes it, so it has to carry the scope without the conversation that produced it.

The folder is gitignored, and backed wherever a records remote is configured: `canon records push` and `canon records pull` protect it against the machine being lost there, refuse with `no-remote` where it is not, and protect nothing against a plan deleted before anyone has pushed. That is why the archive step below is a move rather than a cleanup.

## Scope

Governs a feature plan under `.canon/plans/feature-<slug>.md`: the filename, the required sections, what each holds, the suggested-and-answer contract, and the lifecycle from the live folder to the archive.

Does not govern:

- One question measured in depth before anyone can plan against it: `groundwork.md`
- A dump of many findings filed by domain, each carrying its own verdict: `intake.md`
- The task file a plan is linked from, and the origin line pointing back at it: `tasks.md`
- The transform from a branch name to a slug: `slug.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`
- When a plan is written at all, and whether a short one goes to a file or to the conversation, which belong to the surface driving it

## What a working plan looks like

A plan works when a session holding none of the conversation that produced it can execute from the file alone:

- What is being built, and which files does it change?
- Which decisions are already settled, and which are still open?
- For each open decision, what happens when nobody answers it?
- What is likely to go wrong, and where does the work collide with something already in flight?

A plan failing these is non-conforming even when it satisfies every shape rule below.

## Filename and slug

- Name the file `feature-<slug>.md`, with `<slug>` two to four kebab-case words naming the concern.
- Write one concern per file. A request spanning two independent concerns takes two plans rather than one bundling both, since a bundled plan cannot be executed by two sessions or abandoned by half.
- Derive the slug from the concern rather than from a branch, because the plan is written before the branch exists.
- Give the branch that executes the plan the same slug. A later surface finds the plan from the branch name and finds nothing when the two spellings differ.

A plan carries no frontmatter. Its filename is the whole of its identity, so a folder of plans is read by name rather than by a generated catalog.

## Sections

The document opens with `# Feature: <short title>` and one paragraph stating what is being built and why now. The sections below follow in this order.

| Section               | Holds                                                                     | Required      |
| --------------------- | ------------------------------------------------------------------------- | ------------- |
| `## Summary`          | three to five one-line bullets: the goal, the deliverables, the trade-off | Always        |
| `**Constraints:**`    | durable rules the work must respect                                       | When supplied |
| `**Files to touch:**` | each file with a one-line reason                                          | Always        |
| `**Risks:**`          | conflicts, coupling, and the tricky spots                                 | Always        |
| `**Questions:**`      | numbered open decisions, each with a suggestion and an answer slot        | Always        |

- Write each marker as the table gives it. `Summary` opens the prose a reader scans, so it takes an H2, and the four that follow are labels over lists rather than sections of prose.
- A section written in the other spelling is still that section. `## Risks` and `**Risks:**` name one thing, and a plan carrying either has stated its risks, so neither reads as an omission. Write the table's form in a new plan and leave an existing plan's spelling alone.
- Both spellings break a depth run, so `canon markdown audit` reads either as the seam it is and reports a plan for a section that genuinely runs long rather than for its whole body. The markdown standard states the rule.
- Write `None identified.` under a required section with nothing to report rather than dropping the marker. A dropped section and an unconsidered one read identically.
- Aim `## Summary` at a person scanning the plan, not at the session executing it. The other sections carry what execution needs.
- Give every `**Files to touch:**` entry a backticked path and something said about it. A bare path states scope and not intent, and the reason is what an executing session checks its edit against. Lead with the path or lead with a label carrying the path, whichever reads better for the entry.
- Separate the two halves with a colon, and keep every path the entry declares ahead of it. What sits before the colon is the entry's subject and reads as a target, so both sides of a rename belong there and a file merely cited by the reason does not. A reason is free to name another path, and one entry that did was read as declaring a file its branch never wrote.
- Read the list as what the branch sets out to write rather than as a bound on it. The ship chain writes past it on nearly every branch, since the sync skills refresh whichever context entry and public doc the change reaches, and no planner can name those before the change exists. `canon tasks plan-reach <plan>` reads the branch back against this list and every other live plan, ahead of the pull request.
- State every count and every claim about the tree as measured during the pass that wrote the plan. A figure carried in from a summary or an earlier session is the most common way a plan ships the wrong scope.
- Prefer a short plan over a padded one. A section filled to look thorough costs the reader the same attention as one that matters.

### Constraints

A constraint naming a surface to leave alone forbids two different acts, and it says which. A constraint carrying only the surface leaves the executing session to guess.

- Forbid conforming that surface to whatever shape the change introduces. This is what a scope constraint means, and it keeps the branch from growing a second concern.
- Never forbid retargeting a pointer the change breaks. A rename, a split, or a deletion that leaves a citation behind ships a dangling reference, so repairing it is required work rather than scope creep.
- Decide both acts for every surface the constraint names. Carving the distinction out for one file and leaving its siblings under the bare wording ships one correct call beside one broken reference.

A constraint measured against work in flight expires when that work merges, and a plan is read some time after it is written. Stamp the block with what it was measured against so a reader can test whether it still holds.

- Give the stamp its own leading bullet, written as Measured against `<commit>` on <YYYY-MM-DD>. One stamp covers the whole block however many tracks the constraints below it name, since a plan is written against the tree once.
- Stamp the commit and not the track names. The constraint already names each track by its work and its file set, so a second list of names is a second place to keep in step. A date alone does not separate two plans written the same afternoon on either side of three merges, which is why the commit is the part a reader tests against.
- Re-test a stamped constraint before honoring it with `git fetch origin main --quiet && git log <commit>..origin/main --oneline -- <the paths the constraint names>`. Any commit it reports means the track landed and the constraint is dead. Fetch inside the same command, since a remote-tracking ref left behind reports fewer merges than have landed and reads a dead constraint as live, which is the failure the stamp exists to remove.
- Scope the log to the paths rather than reading every subject. A squashed merge carries a pull request number while the constraint names its track by work and file set, so an unscoped log leaves the reader matching subjects.
- Read an unstamped constraint as unverified rather than as live. There is no commit to anchor the log against, so confirming one costs the open pull request list against the named paths, which is the work a stamp removes. Every plan written before this rule carries an unstamped block, which is why the default sits here rather than in a sweep over the live folder.

A dead constraint fails silently in the expensive direction. A session honoring one ships the dangling citation the change created and reports success, where a session crossing a live constraint collides visibly and is caught.

### Risks

- Name the collision rather than the category. A risk a reader cannot act on is padding.
- Where the work establishes a resource with more than one consumer, list the consumers and mark each one read or write. A policy stated over that resource has to hold for the writers and not only for the consumer that prompted it.

## The suggested-and-answer contract

Every question carries a `- Suggested:` line and an empty `- Answer:` slot below it.

```markdown
1. <question>
   - Suggested: <pick>, <reason or tradeoff>
   - Answer:
```

An execution that deviates rewrites the suggestion into the form below, leaving the slot as it found it.

```markdown
1. <question>
   - Suggested: overridden at execution to <pick>, <the measurement that moved it>
   - Answer:
```

- A blank `- Answer:` means accept the suggestion at execution time. That default is what makes the plan decision-ready in one pass, with no separate round to collect answers.
- Never ship a question without a suggestion. A bare question defers the judgment the plan exists to supply, and it arrives at the executing session as a stop.
- State the pick in one line with its reason or its main tradeoff. List an alternative only where it changes the pick.
- Write `- Suggested: needs your call, <why>` where the answer turns on preference rather than on a technical default. Fabricating a default there hides an open question behind an accepted answer.
- Never fill an `- Answer:` slot on behalf of the person who owns it. Recording the pick as the suggestion is what the suggestion line is for.
- Rewrite the `- Suggested:` line to the pick execution made when it deviates from an unanswered question, and leave the slot blank. The prohibition above reaches the answer line alone, so the suggestion line is where a deviation goes.
- Open the rewritten text with `overridden at execution to <pick>,` and follow it with the measurement that moved the pick. The phrase is fixed, because a suggestion carrying a number is the ordinary shape of an authored one and says nothing about who wrote it.
- Take a deviation from an answered question back to whoever answered it rather than rewriting either line. A filled slot is a decision already made, and a suggestion rewritten under one leaves the plan holding two picks with no default resolving them.
- Answer in place when a question is settled in conversation, so the file and the decision do not disagree.

The fixed phrase is what a later reader tells an override by, and the measurement alone is not, since an authored suggestion routinely carries a number of its own and a reader meeting one learns nothing about who put it there. The plan is archived at ship, so the same deviation takes one line in the open task's `## Findings` naming what shipped. That is one fact in two registers, the plan holding why the pick moved and the task holding what the tree now has, rather than two records to keep in step.

This contract inverts the one an intake folder keeps, where an empty slot means unread and acceptance is typed out. A plan is written and read in one sitting with every question already surfaced, so silence is a usable default here and is not one there. Both files state the inversion, since a contract read on only one side of a boundary is the one that gets applied to the wrong document.

## Lifecycle

- Write the plan before implementation starts, and treat it as the scope of the run that executes it.
- Keep every plan at one root. A plan copied into each parallel working tree forks, and the copies answer the same question differently.
- Amend the plan in place when a decision changes mid-flight. Do not append a second passage narrating the change, which leaves a reader to work out which of two answers is current. An execution-time deviation from a suggestion is one such amendment, and the contract above fixes which line takes it.
- Move the plan to `.canon/plans/archive/` when the work it describes ships or is declined. Never delete it, because the plan is where the rejected alternative is written down and nothing else records it. The archive nests inside `.canon/plans/` rather than sitting beside it as `.claude/plans-archive/`, so an older layout is a flat sibling by that name and a current one is not.
- Write the plan in the same session that opens the task it serves. The session executing it later inherits reasoning it would otherwise re-derive.

## Anti-patterns

- **The plan written before the measuring.** A subject that has to be measured before anyone can plan against it belongs in a measurement track, and every plan that skipped that step had to be superseded.
- **The bundled plan.** Two concerns under one slug cannot be split later without rewriting both halves.
- **The question with no suggestion.** It reads as thoroughness and lands as a blocked run.
- **The answer filled in by the author.** A slot holding the writer's own pick destroys the only signal that anyone else agreed.
- **The deviation recorded off the plan.** The reasoning lands in a pull request description no later reader of the plan opens, and the archived plan reads as though its suggestion held.
- **The count carried in.** A figure quoted from an earlier session survives the change that invalidated it, and the scope built on it is quietly wrong.
- **The plan deleted on ship.** The considered-and-dropped reasoning goes with it, and the next session re-proposes what this one rejected.

## Template

```markdown
# Feature: <short title>

<One paragraph on what is being built and why now.>

## Summary

- <one-line bullet covering the goal>
- <one-line bullet covering the main deliverables>
- <one-line bullet covering the key decision or trade-off>

**Constraints:**

- Measured against `<commit>` on <YYYY-MM-DD>
- <the work in flight, its file set, and which of the two acts the constraint forbids>
- <durable rule the work must respect>

**Files to touch:**

- `<path/to/file>`: <reason>

**Risks:**

- <conflict, coupling, or tricky spot>

**Questions:**

1. <question>
   - Suggested: <pick>, <reason or tradeoff>
   - Answer:
```
