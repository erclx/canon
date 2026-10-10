---
title: Surfaces
description: The architecture record's verification anchor, the teach and glossary split, the workspace ordinal naming, the Mermaid aspect rule, and when a standard moves into its one reader's skill
---

# Surfaces

## Architecture verification anchor

`standards/architecture.md` takes the verification marker the diagram standard carries, in a different form and on a narrower scope. A diagram entry is one file per kind and keys its marker in frontmatter. The architecture record is one file holding many decisions and carries no frontmatter, so a file-level key would date the newest edit and say nothing about the rest. The anchor is a trailing sentence on the decision entry instead.

The rule reaches only a decision citing a measured number. Counts go stale while the reasoning around them stays correct, and an entry whose reasoning stands on its own has nothing to check. A class covering a decision that cites no number while resting on a changeable state of the tree lost, since an unanchored entry in it reads as needing nothing while the writing rule asks for a marker. Keying on the number alone collapses the writing and reading rules onto one test.

Scope is forward. A decision already in the record when the rule shipped stays unanchored, because dating it by blame is archaeology for a marker nothing reads back. The standard turns the reading on whether the entry cites a number rather than on when it was written.

Nothing writes the anchor back. The diagram field has two writers, one setting `verified` and one appending `stale`, and the architecture record has neither. `canon/ARCHITECTURE.md` records that gap as an open risk.

The sweep that reports a stale anchor reaches only what a diff can point at, so an anchor on a decision no branch touches is checked only by a person re-reading it. Two classes of claim stay unflagged: one counting over a tree the branch never opened, and one citing nothing narrower than a single path segment. The second is deliberate, since a prefix match on `src/` fires on nearly every branch.

A pass that amends a decision's reasoning without re-reading its numbers dates the measurement rather than the edit: a decision importing an existing observation carries that observation's own anchor rather than a fresh one stamped at the import.

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

## One-reader standards

A standard with one reader lives in that reader's skill. `claude/skills/git-issue/references/issue.md` sits there because `git-issue` is the only thing that reads it. It carries no frontmatter, because a reference answers to its skill rather than to the standards template, so `canon standards issue` does not resolve it.

The count is the test, and it decays: a count that predates a later citation moves a file a second reader still needs, so re-count before every move.

A standard with zero readers is the other case. `claude/skills/draft-doc/references/wiki.md` was cited by nothing, so every page conformed from the author's memory rather than from a read. Giving it a reader, now the wiki kind of `draft-doc`, is what closes that, where moving the standard into a skill would bury a rule nothing enforces inside the only thing that reads it. Drafting that reader forced the first check against the tree, and all fourteen pages passed, including the sourcing rule a session working from recall breaks silently.

Write frequency is why the wiki got a drafting skill and the architecture record and requirements did not. Across all 1725 commits at `f635d673`, the wiki folder appears in 90 against 8 for `canon/ARCHITECTURE.md` and 1 for `canon/REQUIREMENTS.md`. Over the last 200 commits the order inverts, wiki 5 and architecture 8, because the wiki was written heavily and early. The all-time figure decides, since a skill is built for the traffic a surface attracts across its life, and a later reader re-running the count on a short range should know the choice was made against the long one.

A standard governing a surface nobody writes to does not need a drafting skill.
