---
title: Surfaces
description: The architecture record's verification anchor, the teach and glossary split, the workspace ordinal naming, the Mermaid aspect rule, the wireframe transcription carve-out and copy rule, and when a standard moves into its one reader's skill
---

# Surfaces

## Architecture verification anchor

`standards/architecture.md` takes the verification marker the diagram standard carries, in a different form and on a narrower scope. A diagram entry is one file per kind and keys its marker in frontmatter. The architecture record is one file holding many decisions and carries no frontmatter, so a file-level key would date the newest edit and say nothing about the rest. The anchor is a trailing sentence on the decision entry instead.

The rule reaches only a decision citing a measured number. Counts go stale while the reasoning around them stays correct, and an entry whose reasoning stands on its own has nothing to check. A class covering a decision that cites no number while resting on a changeable state of the tree lost, since an unanchored entry in it reads as needing nothing while the writing rule asks for a marker. Keying on the number alone collapses the writing and reading rules onto one test.

Scope is forward. A decision already in the record when the rule shipped stays unanchored, because dating it by blame is archaeology for a marker nothing reads back. The standard turns the reading on whether the entry cites a number rather than on when it was written.

Nothing writes the anchor back. The diagram field has two writers, one setting `verified` and one appending `stale`, and the architecture record has neither. `canon/ARCHITECTURE.md` records that gap as an open risk.

A pass that amends a decision's reasoning without re-reading its numbers dates the measurement rather than the edit: a decision importing an existing observation carries that observation's own anchor rather than a fresh one stamped at the import.

## Teach

`standards/teach.md` fixes the layout, the ordinal naming, the frontmatter, and the mission and learning-record formats of a learning workspace, while the pedagogy that decides what to teach next sits in `teach-workspace/references/`.

- An attribute standard beside `markdown.md` lost on the second-reader test, since a standard nothing else cites has no owner to correct it.
- Folding the pedagogy into `teach.md` lost to `591-standard-authoring`, since a standard governs one document type or one attribute rather than both.
- `teach.md` names the skill's reference in prose rather than as a path a check could resolve, since `canon gov citations` never opens `standards/`. Measured at `285723bc` on 2026-09-06.

## Workspace ordinals

A workspace is named `<nn>-<topic>` rather than by a bare slug, so a listing sorts by when each opened. The groundwork and intake folders share one ordinal sequence across both kinds, derived from the first commit naming a folder where one exists and from filesystem timestamps otherwise, and slug resolution matches a bare topic against its ordinal-prefixed folder. Measured at `d5f519ee` on 2026-08-26.

## Glossary

`standards/glossary.md` governs a glossary wherever it sits, which is why the format is a standard of its own rather than a section of `teach.md`. A workspace glossary is promotable, and a promotion lands the file at a path no glob covers, so the shape has to travel with the file. `teach.md` keeps the requirement that the file exists and yields the entry shape, which declares the boundary from both sides.

It sits at the flat root and resolves to `teach-workspace`, the one surface driving every promotion. Both readers name the skill rather than a path: `teach.md` because a promoted file has no fixed address, and `561-teach.md` because it ships with the CLI while the reference ships with the plugin, so it carries the report-the-gap instruction `500-prose` uses across that split.

The format comes from the external source the teaching surface was built against, the more specified of the two candidates: it adds a term only once the material has used it, picks one word per concept and lists the rejected synonyms as aliases to avoid, and requires the glossary's own terms inside other definitions. `internal/vocabulary.md` departs on one rule and states the departure in its own intro, since a bank drawn from every session has no first appearance to name. Recording the exception on the page rather than in the standard follows `standards/standard.md`, since a standard citing a real file goes stale when that file moves.

## Mermaid aspect rule

The taller-than-wide rule in `standards/mermaid.md` is decided by the widest rank's label text and column count, so a wide render is fixed by trimming node labels to three or four words and stacking independent siblings with a `~~~` invisible link, not by removing nodes. A `~~~` link inside a subgraph or folding two nodes into one label can swing a diagram from wider-than-tall to taller-than-wide with every node and edge otherwise unchanged.

Read the ratio mechanically out of bytes 16 to 24 of a PNG header after rendering through `bunx -y @mermaid-js/mermaid-cli`. A fan-in the standard bans is a separate problem, and a vertical timeline with the trigger on each edge label clears both at once.

## Wireframe transcription

The wireframe standard sends class or token names and pixel-exact spacing out of a wireframe, and its `## Layout` prefers a role label over a class name. A wireframe regenerated from an already-built surface needs the opposite: `canon/wireframes/slides.md` names `src/slides/layouts.ts`'s `MX` and `BODY_Y` constants, and the `canon/wireframes/teach/` files carry `.mast`, `.track`, `--chrome`, and a 3.5rem bar height.

`## Transcription wireframes` states the mode rather than repealing the rule. It permits a source citation, class or token names, and exact geometry only where the wireframe is regenerated from a built surface's own render code, and it requires the file to open by naming that source. A wireframe drafted ahead of any build keeps the original rule, since there is no source yet to check it against.

Moving the class names and pixel values into a `canon/context/` entry lost. Nothing else documents those constants or the teach variables, so the move would have created a second source for facts the render code already carries.

The carve-out asks for the source citation alone. A separate sentence stating that the block transcribes rather than approximates lost, since a class name and a line number traced to a real file already carry that signal.

## Wireframe copy

`## Copy` keeps short structural text verbatim, being labels, headings, empty-state strings, and nav or footer copy, and routes long-form or article-body content to a citation of its source file. `canon/wireframes/teach/lesson.md` showed the cost of the wider rule: its figure baked in the lede sentence and the `.assumes` panel text, duplicated from the live HTML source rather than the structural chrome the figure exists to show.

Citing every kind of on-screen text lost. A label is authored in the wireframe itself rather than pulled from a live document, so it has no source file to cite. Short structural text stays verbatim because it has nowhere else to live, and long-form content moves to a citation because duplicating it is what lets a wireframe drift.

## One-reader standards

A standard with one reader lives in that reader's skill. `claude/skills/git-issue/references/issue.md` sits there because `git-issue` is the only thing that reads it. It carries no frontmatter, because a reference answers to its skill rather than to the standards template, so `canon standards issue` does not resolve it.

`standards/snippets.md` stays in the flat root on two readers: `create-snippet`, and the toolkit-internal `internal-snippets` skill, which sends a session to its cadence and audience tests before it admits a snippet. A skill reading a file to do its job is a reader, where a context entry pointing at it is not. `skill.md` also names it as the sibling standard for chat prompts. Measured at `c175ec5d`.

The count is the test, and it decays: a count that predates a later citation moves a file a second reader still needs, so re-count before every move.

A standard with zero readers is the other case. `standards/wiki.md` was cited by nothing, so every page conformed from the author's memory rather than from a read. Adding `draft-wiki` as its reader is what closes that, where moving the standard into a skill would bury a rule nothing enforces inside the only thing that reads it. Drafting the skill forced the first check against the tree, and all fourteen pages passed, including the sourcing rule a session working from recall breaks silently.

Write frequency is why the wiki got a drafting skill and the architecture record, requirements, and decisions did not. Across all 1725 commits at `f635d673`, the wiki folder appears in 90 against 8 for `canon/ARCHITECTURE.md` and 1 each for `canon/REQUIREMENTS.md` and `canon/decisions/`. Over the last 200 commits the order inverts, wiki 5 and architecture 8, because the wiki was written heavily and early. The all-time figure decides, since a skill is built for the traffic a surface attracts across its life, and a later reader re-running the count on a short range should know the choice was made against the long one.

A standard governing a surface nobody writes to does not need a drafting skill.
