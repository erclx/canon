---
name: internal-tooling
description: Scope boundary for stacks, golden configs, seeds, and manifests, and the manifest failures that stay silent
---

# Internal tooling requirement

## Gap

Without this skill, a session writes a manifest key the parser skips without a word, duplicates a parent layer's config into a child where it drifts, changes a `base` config and leaves the repository root on the old one, and calls the change verified from a read of the diff.

Manifest failures are silent by construction. A target receives less than the manifest names and the symptom surfaces later in a project nobody watches. Reading the file back shows the text is there, so what the parser skips has to be known before the edit.

## Must

- A config, seed, or manifest change is done only once the stack's end-to-end verify passes
- A child layer ships only what differs from its parent
- A `base` config change reaches the repository root as a delta that keeps the local overrides
- A golden config change is committed without the pre-commit hook, which would rewrite the template being shipped

## Must not

- Declare dev dependencies in a manifest whose runtime is not `bun`
- Route Claude work through the tooling CLI
- Seed agent-facing content under a stack's `docs/`

## Out of scope

- Governance rules and stacks, which `internal-governance` owns
- The content of the seeded Claude planning docs, which `internal-claude` owns
