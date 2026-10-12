---
name: internal-docs
description: Consumer docs and internal context entries. Use when editing files in `docs/` or `canon/context/`, including routing a document by its reader and the generated indexes. Do not load this skill to read `markdown.md`. Read it directly.
---

# Docs

## Prose rules

Read `claude/skills/markdown-craft/references/markdown.md` and load the `write-human` skill before writing or editing any prose in `docs/` or `canon/context/`. The first is the canonical reference for formatting and the banned characters. The second carries voice, word choice, rhythm, and sentence construction, which no check settles.

## Routing a document by its reader

- Put consumer-facing reference in `docs/`, read by someone operating the toolkit without the source open. The CLI contract sits in `docs/agents/`.
- Put internal narrative, decisions with their rejected alternative, and gotchas in `canon/context/<domain>/`, read by someone maintaining the toolkit.
- Decide the reader before writing. A misplaced document reads correctly where it sits, and the cost arrives when a target reads prose written for this repository or a session searches the tier that does not hold the answer.

## Generated indexes

- Do not hand-edit an `index.md` under `docs/` or `canon/context/`. `canon indexes regen` rewrites the catalog body, and it runs as part of `bun run check`.
- Change a row by changing the `title` or `description` frontmatter of the file it lists. A new folder takes a seed `index.md` carrying `title` and `subtitle`, and the regen fills the rest.

## Owners

- `canon:docs-sync` rewrites stale `README.md` and `docs/` sections from a branch's changes.
- `canon:context-fold` folds a session's decisions into `canon/context/` and carries the entry shape in `claude/skills/context-fold/references/context.md`.

## Reference

- `claude/skills/markdown-craft/references/markdown.md`: heading, list, code, punctuation, file-reference, banned-character, and frontmatter wording rules
- The `write-human` skill: voice, rhythm, sentence construction, and information density
- `claude/skills/context-fold/references/context.md`: the shape of a context entry
- `canon/context/context-model/overview.md`: the tier test that sorts a fact between surfaces
