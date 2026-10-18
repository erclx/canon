---
description: Route tooling stack manifest and reference edits to the stack reference standard
paths:
  - 'tooling/*/reference.md'
  - 'tooling/*/manifest.toml'
---

# Tooling stack standards

## The manifest and reference pair

- Edit `manifest.toml` and the stack's `reference.md` in the same change. Nothing compares them.
- Leave `[gitignore]` groups out of `reference.md`, since `canon tooling reference` prints them from the manifest, per the standard under Authority.
- Write a `[gitignore]` group as an array on one line or wrapped across lines, since the manifest reader takes either whole. Leave the wrapping to the formatter.
- Leave `[dependencies.dev]` empty when `runtime` is not `bun`, and document the manual install step in `reference.md`.

## Authority

- Follow `.claude/skills/internal-tooling/references/tooling-reference.md` for stack reference content, structure, the extends chain, and what the manifest owes the reference. It is the single source.
- Read it before editing a stack reference or its manifest. Do not work the shape from memory.
