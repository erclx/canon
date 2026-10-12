---
title: Surfaces
description: The teach and glossary split, the workspace ordinal naming, the Mermaid aspect rule, and when a reference earns a drafting skill
---

# Surfaces

## Overview

The teach, glossary, Mermaid, and wiki references each carry one decision about where a rule lives or how far it reaches. The last section records when a reference earns a drafting skill of its own.

## Layout

- `claude/skills/teach-workspace/references/` owns the teach and glossary references
- `claude/skills/draft-figure/references/` owns the Mermaid reference
- `claude/skills/draft-doc/references/` owns the wiki reference

## Decisions

### Teach

`claude/skills/teach-workspace/references/teach.md` fixes the layout, the ordinal naming, the frontmatter, and the mission and learning-record formats of a learning workspace, while the pedagogy that decides what to teach next sits in `teach-workspace/references/`.

- An attribute standard beside `markdown.md` lost on the second-reader test, since a standard nothing else cites has no owner to correct it.
- Folding the pedagogy into `teach.md` lost to the one-document-type rule `claude/skills/create-skill/references/skill-reference.md` states, since a reference governs one document type or one attribute rather than both.

### Workspace ordinals

A workspace is named `<nn>-<topic>` rather than by a bare slug, so a listing sorts by when each opened. The groundwork and intake folders share one ordinal sequence across both kinds, derived from the first commit naming a folder where one exists and from filesystem timestamps otherwise, and slug resolution matches a bare topic against its ordinal-prefixed folder. Measured at `d5f519ee` on 2026-08-26.

### Glossary

`claude/skills/teach-workspace/references/glossary.md` governs a glossary wherever it sits, which is why the format is a standard of its own rather than a section of `teach.md`. A workspace glossary is promotable, and a promotion lands the file at a path no glob covers, so the shape has to travel with the file. `teach.md` keeps the requirement that the file exists and yields the entry shape, which declares the boundary from both sides.

It lives in `teach-workspace`, the one surface driving every promotion. A reader names the skill rather than a path, because a promoted file has no fixed address.

The format comes from the external source the teaching surface was built against, the more specified of the two candidates: it adds a term only once the material has used it, picks one word per concept and lists the rejected synonyms as aliases to avoid, and requires the glossary's own terms inside other definitions. `internal/vocabulary.md` departs on one rule and states the departure in its own intro, since a bank drawn from every session has no first appearance to name. Recording the exception on the page rather than in the reference follows `claude/skills/create-skill/references/skill-reference.md`, since a reference citing a real file goes stale when that file moves.

### Mermaid aspect rule

The taller-than-wide rule in `claude/skills/draft-figure/references/mermaid.md` is decided by the widest rank's label text and column count, so a wide render is fixed by trimming node labels to three or four words and stacking independent siblings with a `~~~` invisible link, not by removing nodes. A `~~~` link inside a subgraph or folding two nodes into one label can swing a diagram from wider-than-tall to taller-than-wide with every node and edge otherwise unchanged.

Read the ratio mechanically out of bytes 16 to 24 of a PNG header after rendering through `bunx -y @mermaid-js/mermaid-cli`. A fan-in the standard bans is a separate problem, and a vertical timeline with the trigger on each edge label clears both at once.

### Readers of a reference

Every reference lives in the skill that writes its artifact, and a second reader cites it by sibling path. `claude/skills/git-issue/references/issue.md` sits in `git-issue` because that skill is the only thing that reads it.

A reader count still decides whether a second skill should cite a reference or carry its own, and the count decays: one that predates a later citation misjudges a file a second reader still needs, so re-count before every move.

A reference with zero readers is the other case. `claude/skills/draft-doc/references/wiki.md` was cited by nothing, so every page conformed from the author's memory rather than from a read. Giving it a reader, now the wiki kind of `draft-doc`, is what closes that, where moving it into a skill nobody invokes would bury a rule nothing enforces inside the only thing that reads it. Drafting that reader forced the first check against the tree, and all fourteen pages passed, including the sourcing rule a session working from recall breaks silently.

Write frequency is why the wiki got a drafting skill and requirements did not. Across all 1725 commits at `f635d673`, the wiki folder appears in 90 against 1 for `canon/REQUIREMENTS.md`. Over the last 200 commits at `87dff2e5` the order inverts, wiki 3 and requirements 4, because the wiki was written heavily and early. The all-time figure decides, since a skill is built for the traffic a surface attracts across its life, and a later reader re-running the count on a short range should know the choice was made against the long one.

A standard governing a surface nobody writes to does not need a drafting skill.
