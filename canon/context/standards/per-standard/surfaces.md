---
title: Surfaces
description: The teach and glossary split, the workspace ordinal naming, the Mermaid aspect rule, the wireframe transcription carve-out and copy rule, and when a standard moves into its one reader's skill
---

# Surfaces

## Teach

`claude/skills/teach-workspace/references/teach.md` fixes the layout, the ordinal naming, the frontmatter, and the mission and learning-record formats of a learning workspace, while the pedagogy that decides what to teach next sits in `teach-workspace/references/`.

- An attribute standard beside `markdown.md` lost on the second-reader test, since a standard nothing else cites has no owner to correct it.
- Folding the pedagogy into `teach.md` lost to `governance/rules/standards/standard.md`, since a standard governs one document type or one attribute rather than both.
- `teach.md` names the skill's reference in prose rather than as a path a check could resolve, since `canon gov citations` never opens `standards/`. Measured at `285723bc` on 2026-09-06.

## Workspace ordinals

A workspace is named `<nn>-<topic>` rather than by a bare slug, so a listing sorts by when each opened. The groundwork and intake folders share one ordinal sequence across both kinds, derived from the first commit naming a folder where one exists and from filesystem timestamps otherwise, and slug resolution matches a bare topic against its ordinal-prefixed folder. Measured at `d5f519ee` on 2026-08-26.

## Glossary

`claude/skills/teach-workspace/references/glossary.md` governs a glossary wherever it sits, which is why the format is a standard of its own rather than a section of `teach.md`. A workspace glossary is promotable, and a promotion lands the file at a path no glob covers, so the shape has to travel with the file. `teach.md` keeps the requirement that the file exists and yields the entry shape, which declares the boundary from both sides.

It sits at the flat root and resolves to `teach-workspace`, the one surface driving every promotion. The reader names the skill rather than a path, because a promoted file has no fixed address.

The format comes from the external source the teaching surface was built against, the more specified of the two candidates: it adds a term only once the material has used it, picks one word per concept and lists the rejected synonyms as aliases to avoid, and requires the glossary's own terms inside other definitions. `internal/vocabulary.md` departs on one rule and states the departure in its own intro, since a bank drawn from every session has no first appearance to name. Recording the exception on the page rather than in the standard follows `standards/standard.md`, since a standard citing a real file goes stale when that file moves.

## Mermaid aspect rule

The taller-than-wide rule in `claude/skills/draft-figure/references/mermaid.md` is decided by the widest rank's label text and column count, so a wide render is fixed by trimming node labels to three or four words and stacking independent siblings with a `~~~` invisible link, not by removing nodes. A `~~~` link inside a subgraph or folding two nodes into one label can swing a diagram from wider-than-tall to taller-than-wide with every node and edge otherwise unchanged.

Read the ratio mechanically out of bytes 16 to 24 of a PNG header after rendering through `bunx -y @mermaid-js/mermaid-cli`. A fan-in the standard bans is a separate problem, and a vertical timeline with the trigger on each edge label clears both at once.

## Wireframe transcription

The wireframe standard sends class or token names and pixel-exact spacing out of a wireframe, and its `## Regions` prefers a role label over a class name. A wireframe regenerated from an already-built surface needs the opposite: the `canon/wireframes/teach/` files carry `.mast`, `.track`, `--chrome`, and a 3.5rem bar height.

`## Transcription wireframes` states the mode rather than repealing the rule. It permits a source citation, class or token names, and exact geometry only where the wireframe is regenerated from a built surface's own render code, and it requires the file to open by naming that source. A wireframe drafted ahead of any build keeps the original rule, since there is no source yet to check it against.

Moving the class names and pixel values into a `canon/context/` entry lost. Nothing else documents the teach variables, so the move would have created a second source for facts the render code already carries.

The carve-out asks for the source citation alone. A separate sentence stating that the block transcribes rather than approximates lost, since a class name and a line number traced to a real file already carry that signal.

## Wireframe copy

`## Copy` keeps short structural text verbatim, being labels, headings, empty-state strings, and nav or footer copy, and routes long-form or article-body content to a citation of its source file. `canon/wireframes/teach/lesson.md` showed the cost of the wider rule: its figure baked in the lede sentence and the `.assumes` panel text, duplicated from the live HTML source rather than the structural chrome the figure exists to show.

Citing every kind of on-screen text lost. A label is authored in the wireframe itself rather than pulled from a live document, so it has no source file to cite. Short structural text stays verbatim because it has nowhere else to live, and long-form content moves to a citation because duplicating it is what lets a wireframe drift.

## One-reader standards

A standard with one reader lives in that reader's skill. `claude/skills/git-issue/references/issue.md` sits there because `git-issue` is the only thing that reads it. It carries no frontmatter, because a reference answers to its skill rather than to the standards template, so `canon standards issue` does not resolve it.

The count is the test, and it decays: a count that predates a later citation moves a file a second reader still needs, so re-count before every move.

A standard with zero readers is the other case. `claude/skills/draft-doc/references/wiki.md` was cited by nothing, so every page conformed from the author's memory rather than from a read. Giving it a reader, now the wiki kind of `draft-doc`, is what closes that, where moving the standard into a skill would bury a rule nothing enforces inside the only thing that reads it. Drafting that reader forced the first check against the tree, and all fourteen pages passed, including the sourcing rule a session working from recall breaks silently.

Write frequency is why the wiki got a drafting skill and requirements did not. Across all 1725 commits at `f635d673`, the wiki folder appears in 90 against 1 for `canon/REQUIREMENTS.md`. Over the last 200 commits at `87dff2e5` the order inverts, wiki 3 and requirements 4, because the wiki was written heavily and early. The all-time figure decides, since a skill is built for the traffic a surface attracts across its life, and a later reader re-running the count on a short range should know the choice was made against the long one.

A standard governing a surface nobody writes to does not need a drafting skill.
