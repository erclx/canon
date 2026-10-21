---
name: markdown-craft
description: Why the markdown format rules travel in a skill, and where the boundary sits against the voice skill and the audit command
---

# Markdown craft requirement

## Gap

Without this skill, the markdown format rules sit in a standard that a session opens only when a rule tells it to. The banned characters and the structure rules are facts a scan settles, yet a session writes the whole document from memory and learns the result only from the audit's exit.

The rules also have three carriers, a standard, a generated rule pointing at it, and a hand-written rule routing voice. Each states one routing and each drifts from the others.

## Must

- Hold the format and structure reference in `references/markdown.md`, the one copy, read by sibling path from every skill that writes markdown
- Hold the table limits in `references/tables.md`, the one copy, since `markdown.md` sits at the document ceiling and points at it
- Send the session to `canon markdown audit` after an edit, since the audit reads the bans from the package and a restated list would drift
- Route voice to `write-human` and a Mermaid fence to `draw-figure` rather than restating either

## Must not

- Restate the banned characters in the body
- Carry voice, rhythm, or word guidance

## Out of scope

- Voice, rhythm, and word choice, which `write-human` owns
- A Mermaid fence or a figure, which `draw-figure` owns
- The banned-character scan itself, which `canon markdown audit` owns
