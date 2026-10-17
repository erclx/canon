---
title: Markdown triage
description: The three shapes a triage records rather than rewrites, what each remedy costs in punctuation, cohesion, and lost clauses, and the floor a triage leaves
---

# Markdown triage

## Decisions

### What a triage exempts and why

Three shapes reach a checkpoint where no rewrite improves the prose, so a triage records them rather than editing.

| Shape                 | Why no rewrite helps                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| Catalog entry         | Peers read one at a time, so a split makes thin paragraphs on one tool |
| Roll-call enumeration | Each sentence names one item and disposes of it                        |
| Frozen eval record    | Evidence rather than prose, scoped by its own banner                   |

### Catalog entries

A catalog entry is a description under a link, written as several short sentences carrying one fact each. The sentence cap counts the linked claims a reader holds at once, and a catalog holds peers taken one at a time. The depth checkpoint already exempts a table for the same reason.

### Roll-call enumerations

A roll-call is the catalog shape inside a paragraph. Converting to a bullet list is the fix where the file already carries lists, and the exemption holds where the file is a record nothing should restructure.

A skill's `## Gap` section is the exception where list conversion is wrong. `claude/skills/create-skill/references/skill-requirement.md` fixes `## Gap` as prose and `## Must` as the list beneath it, so bulleting the gaps makes the two sections identical. A paragraph split at the seam is what those take.

### Frozen eval records

A frozen record under `scripts/eval/` is evidence, and its own banner sets the scope. Read the banner per file rather than taking the folder as one class, since a plan naming the folder exempts prose the banner governs.

- `result-context.md` and `result-wireframes.md` refuse every edit
- `result-seed.md` refuses edits to its quoted and machine-derived blocks
- Its operator-written judgment sections follow prose standards, which puts them inside a sweep

### The grounds live in prose

Nothing under `src/markdown/` reads an exemption marker, per `canon/context/cli/audits/markdown-bans.md`, so each shape still reports on every run. Prose is the only surface a triage can record one on, which is why the grounds sit here and not beside the findings.

### Skill bodies need no fourth exemption

The stated remedy moves a heavy bullet's overflow into prose, and prose beneath a step is read after the step. A session can then act on the instruction without the condition that qualified it.

- Nest the overflow where it enumerates cases the bullet asks a session to pick between
- Move it into prose only where it is the reasoning behind an instruction rather than part of one
- Both moves clear every heavy bullet across `claude/` with no exemption, so the grounds stay at three

### Context entries take a third move

A context entry's heavy bullets are usually a narrative stack under an existing heading, which `markdown.md` separately asks to be collapsed into one narrative. Converting the section to prose clears every finding in it and rewrites no wording.

### Punctuation consequence

Moving a bullet's reasoning into prose leaves the bullet single-sentence with its terminal period in place, and nesting does the same to every single-sentence child it creates. That breaks the `markdown.md` rule about ending a single-sentence or fragment bullet with a period.

This command reads no bullet punctuation, so the new violations clear `bun run check` and reach a target. Re-read every bullet a triage empties or splits, since a triage pass has produced this exact miss.

### Cohesion consequence

A pronoun whose antecedent sat earlier in the same paragraph can end up opening the paragraph a split creates. The nearest preceding noun is then a different subject, and the sentence reads against the wrong referent while the report goes clean.

Re-read the opening sentence of every paragraph a split creates, not only the bullets it empties.

### A conversion can delete a clause

A triage pass once dropped words from a risk entry in `canon/ARCHITECTURE.md`, since retired. The entry kept recommending a behavior as a pattern while no longer saying what two skills do to reach their conclusion about an absent key.

The ban scan, all three weight checkpoints, the depth measure, and the citation gate each passed on the shortened text, since every one measures shape rather than content.

### A word-stream diff catches it

Strip list markers and leading whitespace from both revisions, split on whitespace, and diff the two streams. That reduces a 49-file reflow to the places where words entered or left, which surfaced the one unintended change against roughly 60 deliberate terminal-period rewrites.

A re-read does not substitute. The worker self-reviewed and the review pass read the diff, and the loss survived both, since a reflowed paragraph reads as correct prose whether or not it still says everything the bullets said.

### The checkpoints are not independent

Splitting a heavy paragraph adds a blank line inside whatever run it sits in, and the depth measure counts blank lines. Clearing a paragraph finding lengthens the run reported for that section, so a file can come off two checkpoints and report worse on the third.

State this wherever a depth reading is deferred, since the number the later pass starts from is not the one the deferring pass recorded.

### The floor a triage leaves

The generated mirror reaches zero the same way the tree does. A finding under `.claude/rules/` is fixed at its authoring root and cleared by `bun run check`, so one number over the whole corpus is what a later run reproduces.

Depth has no triage behind it. Triaging depth means measuring first, not reading a figure a paragraph pass moved.
