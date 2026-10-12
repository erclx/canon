---
description: Route tooling stack manifest and reference edits to the stack reference standard
paths:
  - 'tooling/*/reference.md'
  - 'tooling/*/manifest.toml'
---

# Tooling stack standards

## The manifest and reference pair

- Edit `manifest.toml` and the stack's `reference.md` in the same change. Nothing compares them.
- Restate every `[gitignore]` group verbatim in `reference.md`. A group edited in the manifest alone leaves the reference listing the old set.
- Quote both key and value in `[scripts]`. Unquoted keys are skipped without an error.
- Write each `[gitignore]` group as a single-line array. A multi-line array parses as empty.
- Leave `[dependencies.dev]` empty when `runtime` is not `bun`, and document the manual install step in `reference.md`.

## Authority

- Follow `internal/standards/tooling-reference.md` for stack reference content, structure, the extends chain, and what the manifest owes the reference. It is the single source.
- Read it before editing a stack reference or its manifest. Do not work the shape from memory.
