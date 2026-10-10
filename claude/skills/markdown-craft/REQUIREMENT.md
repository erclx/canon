---
name: markdown-craft
description: Why the markdown format rules travel in a skill, and where the boundary sits against the voice skill and the audit command
---

# Markdown craft requirement

## Gap

Without this skill, the markdown format rules sat in a standard that a session opened only when a rule told it to. The banned characters and the structure rules are facts a scan settles, yet a session wrote the whole document from memory and learned the result only from the audit's exit.

The rules also had three carriers, a standard, a generated rule pointing at it, and a second hand-written rule routing voice. Each stated one routing and each drifted from the others.

## Must

- Hold the format and structure reference in `references/markdown.md`, the one copy, read by sibling path from every skill that writes markdown
- Send the session to `canon markdown audit` after an edit, since the audit reads the bans from the package and a restated list would drift
- Route voice to `write-human` and a Mermaid fence to `draft-figure` rather than restating either

## Must not

- Restate the banned characters in the body
- Carry voice, rhythm, or word guidance, which `write-human` owns
