---
name: markdown-craft
description: Carries the format and structure rules for markdown, being headings, the density limits, paragraph and list shape, code spans, the date form, punctuation, emphasis, file references, American spelling, and frontmatter wording, and runs the audit after an edit. Use before a substantial markdown edit, when writing a README, a doc, a skill body, or any `.md` file, or when asked "what are the markdown rules" or "which characters are banned". Do NOT use for voice, rhythm, or word choice, which is `write-human`, or for a Mermaid fence or figure, which is `draw-figure`.
metadata:
  family: answer
---

# Markdown craft

Read the references below before a substantial markdown edit. Every rule in them is a fact a scan can settle, so do not work the banned characters from memory.

- `${CLAUDE_SKILL_DIR}/references/markdown.md`: headings, density, code spans, punctuation, and every other format rule
- `${CLAUDE_SKILL_DIR}/references/tables.md`: the four table limits and their fixes, read before writing a table or fixing a table finding

Run `canon markdown audit <path>` after the edit, and fix every ban and density finding it reports before moving on. Rewrite the sentence carrying a ban hit rather than swapping the token for a near-synonym, and fix a density finding by its shape rather than trimming characters.

A table finding reports without failing the run. Fix it the way `tables.md` gives for its limit.

## Routes

- Voice, rhythm, sentence construction, and information density: load `write-human`.
- A Mermaid fence or a figure: load `draw-figure`, since the audit skips every line inside a fence.
