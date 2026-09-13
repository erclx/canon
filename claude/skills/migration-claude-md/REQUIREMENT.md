---
name: migration-claude-md
description: Why a bloated CLAUDE.md is rebalanced by proposal rather than by edit, and what the seed baseline settles
---

# Migration claude md requirement

## Gap

Without this skill, a session asked to slim `CLAUDE.md` deletes sections it judges stale and writes the rest into files it creates in the same pass, so a classification the user disagrees with is no longer one command to undo. The file is always-load context, so a wrong move costs every later session rather than one.

Three more failures share a cause. The session has no baseline for what belongs in `CLAUDE.md`, so it reads toolkit-seeded always-load behavior as bloat and proposes moving it, and the next seed sync puts it back. A section carrying a rule and a narrative together gets sorted whole into one bucket, which loses half of it either way. And a target that already exists gets written over, since a proposal blind to the folder cannot tell a create from a collision.

The skill also writes into `canon/context/`, a folder `migration-context` moves files into. A proposal drafted before those moves land cannot see the entries they create, so a move that should have resolved to an append reads as a create.

## Must

- Classify every `##` section against the three tiers in a fixed order, so the same section lands the same way twice
- Treat a section matching the seed baseline as always-load by definition and propose no move for it
- Read the existing rules and context folders before resolving a target, so an existing entry resolves to an append and a taken rule slot resolves to a conflict
- Derive a rule's glob from the scope the section names rather than from the folder it describes
- Propose and stop, leaving every file write and the `CLAUDE.md` edit to the user
- Report the already-lean case as a pass rather than manufacturing moves to justify the run

## Must not

- Sort a section holding both a rule and a narrative into either bucket. Flag it for a manual split.
- Create a rule file, create a context entry, or edit `CLAUDE.md`
- Propose a move onto an existing rule path. Report it as a conflict and skip it.

## Guards

- No `CLAUDE.md` at the project root stops before any classification runs
- Fewer than three `##` sections reports the file already lean, since a rebalance needs something to rebalance

## Out of scope

- Relocating `docs/` files, which `migration-context` proposes into this same `canon/context/` folder. Run that skill first when both apply, so Step 3 reads a folder its moves have already populated.
- Scaffolding the rule files it proposes, which `create-rule` does with the numbering and frontmatter
- Regenerating `canon/context/index.md`, which `canon indexes regen` does once the user has applied the moves
