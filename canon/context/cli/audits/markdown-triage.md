---
title: Markdown triage
description: The three shapes a triage records rather than rewrites, what each remedy costs in punctuation, cohesion, and lost clauses, and the floor a triage leaves
---

# Markdown triage

## What a triage exempts and why

Three shapes reach a checkpoint where no rewrite improves the prose, so a triage records them rather than editing.

A catalog entry is a description under a link, written as several short sentences carrying one fact each. The sentence cap counts the linked claims a reader holds at once, and a catalog holds peers taken one at a time, so splitting produces two thin paragraphs describing one tool. The depth checkpoint already exempts a table for the same reason, which is that the remedy does not exist for that shape.

A roll-call enumeration is the same shape inside a paragraph, where each sentence names one item and disposes of it. Converting to a bullet list is the fix where the surrounding file already carries lists, and the exemption holds where the file is a record nothing should restructure.

A skill's `## Gap` section is the one place that list conversion is wrong even though the file carries lists. `standards/skill-requirement.md` fixes `## Gap` as prose and `## Must` as the list beneath it, so bulleting the gaps makes the two sections structurally identical and drops the distinction the template exists to draw. A paragraph split at the seam is what those take instead.

A frozen record under `scripts/eval/` is evidence rather than prose, and its own banner sets the scope. `result-context.md` and `result-wireframes.md` refuse every edit. `result-seed.md` refuses edits to its quoted and machine-derived blocks while stating that the operator-written judgment sections do follow prose standards, which puts those sections inside a sweep rather than outside it. Read the banner per file rather than taking the folder as one class, since a plan naming the folder exempts prose the banner governs.

Nothing under `src/markdown/` reads an exemption marker, per `canon/context/cli/audits/markdown-bans.md`, so each of these still reports on every run. Prose is the only surface a triage can record one on, which is why the grounds sit here rather than beside the findings they cover.

A skill body reaches the bullet checkpoint for a reason the three above do not cover, and it still needs no fourth exemption. The stated remedy moves a heavy bullet's overflow into prose, and prose beneath a step is read after the step rather than with it, so a session can act on the instruction without the condition that qualified it. What fits instead is to nest the overflow where it enumerates cases the bullet asks a session to pick between, and to move it into prose only where it is the reasoning behind an instruction rather than part of one. Applying those two moves clears every heavy bullet across `claude/` with no exemption claimed, so the grounds stay at three.

A context entry takes a third move neither of those describes, and it needs no exemption either. Its heavy bullets are usually a narrative stack under a heading that already exists, which `markdown.md` separately asks to be collapsed into one narrative, so converting the section to prose clears every finding in it and rewrites no wording.

Both moves carry a punctuation consequence the audit cannot see. Moving a bullet's reasoning into prose leaves the bullet single-sentence with its terminal period still in place, and nesting does the same to every single-sentence child it creates, against the rule in `markdown.md` about ending a single-sentence or fragment bullet with a period. This command measures bans and the three weight checkpoints and reads no bullet punctuation, so the new violations clear `bun run check` and reach a target. Re-read every bullet a triage empties or splits rather than trusting a clean report, since a triage pass has produced this exact miss.

Splitting a paragraph carries a cohesion consequence of the same kind. A pronoun whose antecedent sat earlier in the same paragraph can end up opening the new one, where the nearest preceding noun is a different subject, so the sentence reads against the wrong referent while the report goes clean. Re-read the opening sentence of every paragraph a split creates, rather than only the bullets it empties.

A conversion can also delete a clause outright, which is a content loss rather than a punctuation or a cohesion defect. A triage pass has dropped words from a risk entry in `canon/ARCHITECTURE.md` this way, leaving it stating what two skills conclude about an absent key without stating what they do to reach that answer, while still recommending the behavior as a pattern other skills could take. The ban scan, all three weight checkpoints, the depth measure, and the citation gate each passed on the shortened text, because every one of them measures shape rather than content.

A word-stream diff is what catches that. Normalizing both revisions by stripping list markers and leading whitespace, splitting on whitespace, and diffing the two streams reduces a 49-file reflow to the handful of places where words entered or left, which is what surfaced the one unintended change against roughly 60 deliberate terminal-period rewrites.

A re-read does not substitute for it. The worker self-reviewed and the review pass read the diff, and the loss survived both, because a reflowed paragraph reads as correct prose whether or not it still says everything the bullets said. What earns a place beside these consequences is a case observed on a shipped branch rather than one a later pass can imagine.

The three checkpoints are not independent under their own remedies either. Splitting a heavy paragraph adds a blank line inside whatever run it sits in, and the depth measure counts blank lines, so clearing a paragraph finding lengthens the run reported for that section. A file can therefore come off two checkpoints and report worse on the third, which is worth stating wherever a depth reading is deferred to a later pass, since the number that pass starts from is not the one the deferring pass recorded.

## The floor a triage leaves

The generated mirror reaches zero the same way the tree does. A finding under `.claude/rules/` is fixed at its authoring root and cleared by `bun run check`, so the two never need counting apart once a slice has run, and one number over the whole corpus is what a later run reproduces.

Depth has no triage behind it, and a depth reading taken before a paragraph pass is not the one after it, since clearing a paragraph finding adds a blank line inside the run it sat in. Triaging depth means measuring first rather than reading a figure a paragraph pass moved.
