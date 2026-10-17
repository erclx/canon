---
title: Surfaces
description: The teach and glossary split, workspace ordinal naming, the Mermaid aspect rule, and when a reference earns a drafting skill
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

`claude/skills/teach-workspace/references/teach.md` fixes the layout, ordinal naming, frontmatter, and mission and learning-record formats of a learning workspace. The pedagogy that decides what to teach next sits in `teach-workspace/references/`. Two alternatives lost.

- An attribute standard beside `markdown.md` failed the second-reader test, since a standard nothing else cites has no owner to correct it
- Folding the pedagogy into `teach.md` broke the one-document-type rule in `claude/skills/create-skill/references/skill-reference.md`, since a reference governs one document type or one attribute

### Workspace ordinals

A workspace is named `<nn>-<topic>` rather than by a bare slug, so a listing sorts by when each opened. Measured at `d5f519ee` on 2026-08-26.

- The groundwork and intake folders share one ordinal sequence across both kinds
- The ordinal comes from the first commit naming a folder where one exists, and from filesystem timestamps otherwise
- Slug resolution matches a bare topic against its ordinal-prefixed folder

### Glossary

`claude/skills/teach-workspace/references/glossary.md` governs a glossary wherever it sits, so the format is a standard of its own rather than a section of `teach.md`. A workspace glossary is promotable, and a promotion lands the file at a path no glob covers, so the shape has to travel with it.

- `teach.md` keeps the requirement that the file exists and yields the entry shape, which declares the boundary from both sides
- The standard lives in `teach-workspace`, the one surface driving every promotion, and a reader names the skill because a promoted file has no fixed address

The format comes from the more specified of the two external candidates the teaching surface was built against.

- A term is added only once the material has used it
- One word is picked per concept, with the rejected synonyms listed as aliases to avoid
- The glossary's own terms appear inside other definitions

`internal/vocabulary.md` departs on the first rule and states it in its own intro, since a bank drawn from every session has no first appearance to name. The exception sits on that page, because a reference citing a real file goes stale when the file moves.

### Mermaid aspect rule

The taller-than-wide rule in `claude/skills/draft-figure/references/mermaid.md` is decided by the widest rank's label text and column count. Fix a wide render by trimming node labels to three or four words and stacking independent siblings with a `~~~` invisible link, not by removing nodes.

A `~~~` link inside a subgraph, or folding two nodes into one label, can swing a diagram from wider-than-tall to taller-than-wide with every node and edge otherwise unchanged.

- Read the ratio from bytes 16 to 24 of the PNG header after rendering through `bunx -y @mermaid-js/mermaid-cli`
- A fan-in the standard bans is a separate problem
- A vertical timeline with the trigger on each edge label clears both at once

### Readers of a reference

A second reader cites a reference by sibling path. `claude/skills/git-issue/references/issue.md` sits in `git-issue` because that skill is its only reader. The reader count still decides whether a second skill cites a reference or carries its own, and the count decays, so re-count before every move.

A reference with zero readers is the other case. `claude/skills/draft-doc/references/wiki.md` was cited by nothing, so every page conformed from the author's memory rather than from a read.

- Giving it a reader, now the wiki kind of `draft-doc`, closed that
- Moving it into a skill nobody invokes would have buried a rule nothing enforces
- Drafting that reader forced the first check against the tree, and all fourteen pages passed, including the sourcing rule a session working from recall breaks silently

### Write frequency decides a drafting skill

The wiki got a drafting skill and requirements did not because of write frequency. A standard governing a surface nobody writes to does not need one.

| Range                  | Wiki commits | `canon/REQUIREMENTS.md` commits |
| ---------------------- | ------------ | ------------------------------- |
| All 1725 at `f635d673` | 90           | 1                               |
| Last 200 at `87dff2e5` | 3            | 4                               |

The all-time figure decides, since a skill is built for the traffic a surface attracts across its life. The short range inverts because the wiki was written heavily and early. Re-run the count against the long range.
