---
name: markdown-craft
description: Carries the format and structure rules for markdown, being headings, paragraph and list shape, code spans, the date form, punctuation, emphasis, file references, American spelling, and frontmatter wording, and runs the audit after an edit. Use before a substantial markdown edit, when writing a README, a doc, a skill body, or any `.md` file, or when asked "what are the markdown rules" or "which characters are banned". Do NOT use for voice, rhythm, or word choice, which is `write-human`, or for a Mermaid fence or figure, which is `draft-figure`.
metadata:
  family: answer
---

# Markdown craft

Read `${CLAUDE_SKILL_DIR}/references/markdown.md` before a substantial markdown edit. Every rule in it is a fact a scan can settle, so do not work the banned characters from memory.

Run `canon markdown audit <path>` after the edit. Rewrite the sentence carrying a hit rather than swapping the token for a near-synonym.

## Routes

- Voice, rhythm, sentence construction, and information density: load `write-human`.
- A Mermaid fence or a figure: load `draft-figure`, since the audit skips every line inside a fence.
