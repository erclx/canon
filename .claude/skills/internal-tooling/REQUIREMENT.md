---
name: internal-tooling
description: Scope boundary for stacks, golden configs, seeds, and manifests, and the manifest failures that stay silent
---

# Internal tooling requirement

## Gap

Without this skill, a session writes a manifest key the parser skips without reporting it, duplicates a parent layer's config into a child where the copy drifts, changes a `base` config and leaves the repository root running the old one, and calls the change verified from a read of the diff.

The manifest failures are silent by construction. A sync into a target with no `package.json` completes, the target receives less than the manifest names, and the only symptom arrives later in a project nobody is watching. Reading the file back confirms the text is there, which is why what the reader skips has to be known before the edit rather than checked after it.

## Must

- Run the stack's end-to-end verify before calling a config, seed, or manifest change done, since scaffolding fresh is what separates a plausible config from a working one
- Ship only what differs from the parent layer, because a config duplicated for no reason drifts against the file it was copied from
- Port a `base` config change to the repository root as a delta, preserving the local overrides there, since the toolkit runs on its own base tooling

## Must not

- Declare dev dependencies in a manifest whose runtime is not `bun`. Injection runs a `bun add`, so document the manual install step in that stack's reference instead.
- Route Claude work through the tooling CLI. That folder is storage rather than a stack, and its exclusion is read from one place that any change has to update.
- Seed agent-facing content under a stack's `docs/`, which is reserved for prose written for a human reader

## Guards

- Commit golden config changes without the pre-commit hook. Lint-staged runs against the template files themselves rather than project source, so it rewrites the thing being shipped.

## Out of scope

- Governance rules and stacks, which are a separate catalog reaching a target through a separate install: `internal-governance`
- The conventions a stack's `reference.md` follows, which the internal tooling-reference standard states
- The content of the seeded Claude planning docs, which `internal-claude` owns. This skill owns how a seed layers, merges, and survives sync.
