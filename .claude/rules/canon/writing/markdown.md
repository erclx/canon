---
description: Route markdown edits to the markdown-craft skill for format and structure, the write-human skill for voice, and the audit after the edit
paths:
  - '**/*.md'
---

# Markdown standards

## Format

- Never write an em dash or a semicolon. `canon markdown audit` reads the full ban list from the package.
- Load the `canon:markdown-craft` skill before a substantial markdown edit for headings, paragraph and list structure, code spans, the date form, punctuation, emphasis, file references, American spelling, and frontmatter wording. Report it rather than proceeding silently when the skill does not resolve.
- Run `canon markdown audit <path>` after the edit, and rewrite the sentence carrying a hit rather than swapping the token for a near-synonym.

## Voice

- Load the `canon:write-human` skill for voice, rhythm, sentence construction, and information density. Load it before drafting a passage, not after revising one.
- Report it rather than proceeding silently when the skill does not resolve.
- Do not work these rules from memory.

## Figures

- Load the `canon:draft-figure` skill before drafting or revising a Mermaid fence or a figure, and report it rather than proceeding silently when it does not resolve.
