---
name: internal-standards
description: Scope boundary for authoring conventions and consumer docs, and the routing test that keeps them apart
---

# Internal standards requirement

## Gap

Without this skill, a session writes a standard that signposts a sibling instead of standing alone, lands internal narrative in `docs/` where consumer-facing reference belongs, adds a standard no catalog row reaches, and hand-edits a generated index that the next check overwrites.

The routing failure is the one with no local symptom. A misplaced document reads correctly where it sits, and the cost arrives later, when a target project installs prose written for this repository or a session searches the tier that does not hold the answer.

## Must

- Route a document by its reader before writing it, keeping `docs/` for consumer-facing reference and sending internal narrative to `canon/context/`
- Give a standard a scope statement naming what it does not govern, so jurisdiction is readable without opening every sibling
- Add the catalog row in the same change that creates the standard

## Must not

- Signpost one standard from another. Skills load standards together, so a bare pointer adds noise. A functional reference that changes behavior stays allowed.
- Hand-edit a generated index

## Guards

- `standards/index.md` is generated and fails when a standard is missing required frontmatter. Fix the frontmatter rather than the index.

## Out of scope

- Word choice, punctuation, and formatting, which `standards/markdown.md` states directly, and voice and rhythm, which the `write-human` skill carries. Read those rather than loading this skill to reach them.
- Creating a standard inside a target project, which the shipped `create-standard` skill does
- The content of a Claude context entry that a plugin or skill change dates, which `internal-claude` updates. This skill owns the entry's shape through `standards/context.md`.
