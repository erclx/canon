---
title: Plan reference
description: Filename and slug, the required sections, and the suggested-and-answer contract for a feature plan
---

# Plan reference

Applies to a feature plan at `.canon/plans/feature-<slug>.md`. One file holds one concern, written before implementation starts and read by whatever executes it, so it has to carry the scope without the conversation that produced it.

The folder is gitignored, and backed by `canon records push` wherever a records remote is configured. Nothing backs a plan deleted before a push, which is why the archive step is a move rather than a cleanup.

<!-- canon-length-exempt: the constraint forms and the answer contract share one reader, and a split into a second standard is queued as its own change -->

## Contents

- [Scope](#scope)
- [What a working plan looks like](#what-a-working-plan-looks-like)
- [Filename and slug](#filename-and-slug)
- [Sections](#sections)
- [The suggested-and-answer contract](#the-suggested-and-answer-contract)
- [Template](#template)

## Scope

Governs a feature plan under `.canon/plans/feature-<slug>.md`: the filename, the required sections, what each holds, and the suggested-and-answer contract.

Does not govern:

- **`plan-lifecycle.md`**: when a plan is written, how it is amended, and its move to the archive
- **`groundwork.md`**: one question measured in depth before anyone can plan against it
- **`intake.md`**: A dump of many findings filed by domain, each carrying its own verdict
- **`tasks.md`**: the task file a plan is linked from, and the origin line pointing back at it
- **`slug.md`**: the transform from a branch name to a slug
- **the `write-human` skill**: voice, rhythm, and sentence construction
- **`markdown.md`**: headings, punctuation, word choice, and file references
- **the surface driving it**: when a plan is written at all, and whether a short one goes to a file or to the conversation

## What a working plan looks like

A plan works when a session holding none of the conversation that produced it can execute from the file alone:

- What is being built, and which files does it change?
- Which decisions are already settled, and which are still open?
- For each open decision, what happens when nobody answers it?
- What is likely to go wrong, what does the work share with something already in flight, and what must it wait on?
- How is each outcome proven, and which input would break it?

A plan failing these is non-conforming even when it satisfies every shape rule below.

## Filename and slug

- Name the file `feature-<slug>.md`, with `<slug>` two to four kebab-case words naming the concern.
- Write one concern per file, since a plan bundling two cannot be executed by two sessions or abandoned by half
- Derive the slug from the concern rather than from a branch, because the plan is written before the branch exists.
- Give the executing branch the same slug, since a later surface finds the plan from the branch name and finds nothing when the spellings differ

A plan carries no frontmatter. Its filename is the whole of its identity, so a folder of plans is read by name rather than by a generated catalog.

### Staged batches

A staged batch is a concern of its own and takes its own file rather than a `**Batch N**` sub-heading inside one plan's `## Files to touch`. One plan filename derives one branch, so batches sharing a file have nothing to open a pull request against once the first merges.

- State a batch's dependency on the ones before it in its own `## Constraints`
- A batch stacking on another and sharing most of its files folds into that batch as contiguous commits on one branch, rather than taking a file
- It takes a file anyway when its constraints carry ``Judged apart from `feature-<parent>`: <reason>`` with a reason after the colon
- `canon records validate plans` reports `stack-foldable` for a stacked batch that has neither

## Sections

The document opens with `# Feature: <short title>` and one paragraph stating what is being built and why now. The sections below follow in this order.

| Section                | Holds                                                                       | Required                                          |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| `## Summary`           | three to five one-line bullets: the goal, the deliverables, the trade-off   | Always                                            |
| `## Current behavior`  | each command run against the thing being changed and what it showed         | When the change touches something that runs       |
| `## Constraints`       | durable rules the work must respect                                         | When supplied                                     |
| `## Files to touch`    | each file with a one-line reason                                            | Always                                            |
| `## Design references` | the tracked design folders the change builds against, each with its surface | When Files to touch names a rendered-surface file |
| `## Verification`      | the test or command that proves each outcome                                | Always                                            |
| `## Risks`             | conflicts, coupling, and the tricky spots                                   | Always                                            |
| `## Review focus`      | the inputs or states that would break the change, for the reviewer          | Always                                            |
| `## Questions`         | numbered open decisions, each with a suggestion and an answer slot          | Always                                            |
| `## Sources`           | the outside sources a decision rests on, each with its quoted passage       | When a decision rests on an outside source        |

### Writing a section

Four rules govern how a section is written:

- Write each section as the H2 the table gives, so a reader scans the plan by its outline
- A section written as a bold label, the spelling before this one, is still that section to every parser. Leave an existing plan's spelling alone.
- Write `None identified.` under a required section with nothing to report rather than dropping the marker. A dropped section and an unconsidered one read identically.
- Aim `## Summary` at a person scanning the plan, not at the session executing it. The other sections carry what execution needs.

### Structure

Every hand-written record under `.canon/` holds to six criteria, being a plan, a groundwork file, an intake item, a task, a session map, and a compact note. None caps length, since a record follows the change it describes and is disposable once it ships.

| ID   | Criterion                                                                    |
| ---- | ---------------------------------------------------------------------------- |
| `S1` | An H2 per section, never a bold label standing alone as a section marker     |
| `S2` | A section past 5 plain bullets groups them under H3s                         |
| `S3` | An H3 opens with a lead sentence carrying what its bullets share             |
| `S4` | A bullet past 200 characters becomes a short paragraph or splits             |
| `S5` | No H4                                                                        |
| `S6` | A section a parser reads names every path in full, whatever H3 it sits under |

A run of labeled field bullets, each opening on a bold label, is exempt from `S2`, as `markdown.md` exempts it. An intake item's fields are also exempt from `S4`, and its numbered H3 from `S3`, since the item template fixes both.

- `canon records validate <kind> <record>` reports `S1` to `S5` under `structure`, and never in the exit, since every record written before the criteria misses `S1`
- `canon tasks plan-reach` reports an `S6` miss as an unclaimed bare filename
- A writing skill reads the report for the one record it wrote and fixes each entry before it stops
- An existing record takes the shape on its next rewrite, never in a sweep

### Files to touch entries

Give every `## Files to touch` entry a backticked path and something said about it. A bare path states scope and not intent, and the reason is what an executing session checks its edit against.

- Lead with the path or with a label carrying the path, whichever reads better for the entry
- Separate the two halves with a colon, and keep every path the entry declares ahead of it, since what sits before the colon reads as a target
- Both sides of a rename belong before the colon, and a file merely cited by the reason does not
- Read the list as what the branch sets out to write rather than a bound, since the doc syncs at ship write past it on nearly every branch
- `canon tasks plan-reach <plan>` reads the branch back against this list and every other live plan

Group the entries by area under H3s once they pass 5, each H3 opening on the reason its files share. Every entry still names its full path, since the parsers read the bullet and never the heading above it.

### Measured claims

State every count and every claim about the tree as measured during the pass that wrote the plan. A figure carried in from a summary or an earlier session is the most common way a plan ships the wrong scope.

Prefer a short plan over a padded one. A section filled to look thorough costs the reader the same attention as one that matters.

### Current behavior

A plan changing a verb, a route, or a rendered surface starts from what that thing does today, so the section records the run the planner made and not a reading of the source.

- Write one bullet per run, leading with the command or request in backticks and ending on what it showed
- Run only a read form, per the safe forms in `onboarding.md`, since a planner writes its plan and nothing else
- Record a run that could not happen as not run with the reason. Never leave it out silently.
- Leave the section out of a plan touching nothing that runs, such as prose or a config seed

### Constraints

Work in flight reaches a plan as a hold or as a shared path. A hold leaves a surface alone and says which of two acts it forbids, rather than leaving the executing session to guess. Neither act is forbidden over a shared path.

Write a hold only for a dependency, a contract the other track consumes, a relocation, or a sweep, which a rebase cannot settle mechanically. A bare shared file is none of these, and forbidding it sends a worker to concede a file the change needs.

- Forbid conforming that surface to whatever shape the change introduces, which keeps the branch to one concern.
- Never forbid retargeting a pointer the change breaks, since a rename, split, or deletion leaving a citation behind ships a dangling reference
- Decide both acts for every surface a hold names, not for one file among its siblings.
- Write a shared path as the track, the path, and the branch that rebases, being the one merging second. The executing session edits the file and keeps both sides on the rebase.

Open the section on the stamp line, then group the constraints under an H3 per kind once they pass 5, such as In flight, Contracts, Shared paths, and Durable.

### Stamping a constraint

A constraint measured against work in flight expires when that work merges, as a shared-path line does, so stamp the block with what it was measured against.

- Give the stamp its own leading line, written as Measured against `<commit>` on <YYYY-MM-DD>. One stamp covers the whole section.
- Stamp the commit rather than the track names or a date alone, since a date does not separate two plans written either side of a merge
- Read an unstamped constraint as unverified rather than as live, and confirm it against the open pull request list for the named paths.

Re-test a stamped constraint before honoring it, fetching and scoping the log in one command, since a stale ref reads a dead constraint as live and a squashed subject names no track. Any commit it reports means the track landed and the constraint is dead.

```bash
git fetch origin main --quiet && git log <commit>..origin/main --oneline -- <the paths the constraint names>
```

### Fan-in and ready constraints

A batch in a fan-in set declares its side in a constraint bullet, ``Fan-in member of `feature-<integrator>` `` on a member and ``Fans in `feature-<a>`, `feature-<b>` `` on the integrator. `batches.md` holds when to fan in, and `canon records validate plans` reports `fan-in-unmatched` for a set whose two sides disagree.

A constraint naming a `.canon/ready/` folder is a third shape beside the hold and the shared path. It makes that folder's files the verbatim source for the paths this plan's `## Files to touch` lists, per `ready.md`, so the executing session copies those paths rather than authoring them.

### Design references

A plan whose `## Files to touch` names a rendered-surface file (`.tsx`, `.jsx`, `.astro`, `.vue`, `.svelte`, `.html`, or `.css`) carries this section. It tells the building session which accepted design to open before it writes a line.

- Give each entry a folder path under `canon/design/` and the surface it governs, as one bullet
- Write `None identified.` when the project has no `canon/design/` folder or no folder governs the change, so the section reads as considered
- Cite a tracked folder only, since the building session opens its light and dark images and its frame HTML from the working tree
- `canon records validate plans` reports `section-missing` for a plan that names a rendered-surface file and omits the section

### Verification

Every outcome reaches the review with its proof named.

- Name, for each outcome, the test or the command that proves it, as one bullet leading with the outcome and ending on the command in backticks.
- Write a command a later session can run as given, from the project root. A description of what would be checked leaves the executing session to invent the check.
- Name the visual check where no test reaches, and say it is visual, so a reader can tell a proof from a look.

### Risks

Name the collision rather than the category, since a risk a reader cannot act on is padding. Give each risk its own H3 and a short paragraph, so the outline lists every collision by name.

- For a resource with more than one consumer, list the consumers and mark each read or write, so a policy over it holds for every writer
- For a changed contract another track consumes, such as an exported signature, a verb's flags or record, or a config key, name it and list each consumer
- The dispatcher reads that contract bullet for the hold, so a change left out reaches it as a clean shared file

### Review focus

This section is where the planner's understanding of the risk reaches the review pass.

- Name each input or state that would break the change if the implementation got it wrong, one bullet each, with what the change must do there.
- Write it for the reviewer rather than the builder
- Keep it apart from `## Risks`. A risk is something the work might collide with, and a focus item is something the finished diff must be shown to handle.

### Sources

A source earns an entry only once someone opened it.

- Give each entry a link, the decision it backs, and the passage relied on in double quotes.
- Mark a source that could not be fetched `unverified` and never quote it. A quote for a page nobody opened is the failure this section exists to prevent.
- Cite no source that was found and not opened, following the lead rule in `groundwork.md`.
- Leave the section out when no decision rests on an outside practice or behavior. `canon records validate plans` checks that an entry is well formed, not that every outside claim got one.

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

### Preference questions and answers

The suggestion line is the planner's, and the answer line belongs to whoever owns the call.

- Write `- Suggested: needs your call, <why>` where the answer turns on preference rather than on a technical default. Fabricating a default there hides an open question behind an accepted answer.
- Never fill an `- Answer:` slot on behalf of the person who owns it. Recording the pick as the suggestion is what the suggestion line is for.

### Overrides and settled questions

A deviation from an unanswered question rewrites the `- Suggested:` line to the pick execution made and leaves the slot blank, since the prohibition above reaches the answer line alone.

- Open the rewritten text with `overridden at execution to <pick>,` and follow it with the measurement that moved the pick
- The fixed phrase tells an override from an authored suggestion, which routinely carries a number too
- Take a deviation from an answered question back to whoever answered it rather than rewriting either line
- A filled slot is a decision already made, and a suggestion rewritten under one leaves two picks with no default resolving them
- Record a pick settled in conversation on the `- Suggested:` line, naming who settled it, and leave the slot blank. A deviation from it goes back to whoever settled it.

The plan is archived at ship, so the same deviation takes one line in the open task's `## Findings` naming what shipped. The plan holds why the pick moved and the task holds what the tree now has.

This contract inverts the one an intake folder keeps, where an empty slot means unread and acceptance is typed out. A plan is written and read in one sitting with every question already surfaced, so silence is a usable default here and is not one there.

## Template

Each H3 below shows where a section groups once it passes 5 bullets. A section of 5 or fewer drops its H3s and keeps its bullets flat, except `## Risks`, which takes an H3 per risk at any count.

```markdown
# Feature: <short title>

<One paragraph on what is being built and why now.>

## Summary

- <one-line bullet covering the goal>
- <one-line bullet covering the main deliverables>
- <one-line bullet covering the key decision or trade-off>

## Current behavior

- `<command or request>`: <what it showed, or not run and why>

## Constraints

Measured against `<commit>` on <YYYY-MM-DD>.

### In flight

This plan shares <what> with the work in flight.

- <a hold: the work in flight, its file set, and which of the two acts the constraint forbids>
- <a shared path: the work in flight, the path, and which branch rebases>

### Durable

The rules below protect <what>.

- <durable rule the work must respect>

## Files to touch

### <Area>

The files below share <the reason>.

- `<path/to/file>`: <reason>

## Design references

- `canon/design/<surface>/`: <the surface it governs>

## Verification

### <Outcome group>

The checks below prove <what> together.

- <outcome>: `<test or command that proves it>`

## Risks

### <The collision, named>

The collision is <what>, read or written by <each consumer>, and the work <does what about it>.

## Review focus

- <input or state that would break the change>: <what the change must do there>

## Questions

### <Topic>

The questions below decide <what>, numbered across the whole section.

1. <question>
   - Suggested: <pick>, <reason or tradeoff>
   - Answer:

## Sources

- [<title>](url), backing <decision>: "<passage relied on>"
```
