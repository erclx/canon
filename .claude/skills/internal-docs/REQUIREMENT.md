---
name: internal-docs
description: Scope boundary for consumer docs and internal context entries, and the routing test that keeps them apart
---

# Internal docs requirement

## Gap

Without this skill, a session lands internal narrative in `docs/` where consumer reference belongs, or consumer reference in `canon/context/`, and hand-edits a generated index the next check overwrites.

The routing failure has no local symptom. A misplaced document reads correctly where it sits, and the cost arrives when a target reads prose written for this repository or a session searches the tier that does not hold the answer.

## Must

- A document is routed by its reader before it is written, with consumer reference in `docs/` and internal narrative in `canon/context/`
- A wrong entry in a generated index is fixed in the frontmatter of the file it lists

## Must not

- Hand-edit an `index.md` under `docs/` or `canon/context/`, which `canon indexes regen` writes

## Out of scope

- Word choice, punctuation, and formatting, which `markdown-craft` owns
- Voice and rhythm, which `write-human` owns
- The content of a Claude context entry a plugin or skill change dates, and a shape reference under `claude/skills/`, which `internal-claude` owns
- A wiki page under `wiki/`, which `write-doc` owns
