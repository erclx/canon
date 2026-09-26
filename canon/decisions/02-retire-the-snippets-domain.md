---
title: Retire the snippets domain
description: Why the toolkit deleted its prompt snippets, the canon snippets verb, and the authoring skill, what a target is told, and the alternatives turned down
---

# Retire the snippets domain

## Context

Snippets were small reusable prompts kept as plain markdown under `snippets/` and `internal/snippets/`, fired in a Claude Code session through an `@` reference off the plugin's `claude/snippets` symlink, or pasted into a chat UI. The domain carried a catalog verb, `canon snippets list`, an authoring verb, `canon snippets create`, a plugin skill that wrote one, an internal domain skill, a standard, a count in the catalog sweep, and a figure on the landing-page hero.

The operator decided on 2026-09-26 to retire the domain outright. They did not use snippets, and every job a snippet did was done better by one of the other three surfaces: a rule when the behavior should fire on a path, a skill when it is a procedure someone invokes, and a standard when it governs an artifact's shape. An always-loaded rule had already absorbed the two most-cited snippets, `align` and `decision-help`, and `600-at-references`, the rule that told a session to run a referenced snippet, had retired a release earlier.

## Decision

Delete the content, the verb, and every surface that authored, listed, installed, or counted a snippet, and move nothing into another surface. The fourteen files each had a reason to go rather than a home to move to: most were covered by an existing skill such as `restate-plainly`, `memory-capture`, `context-fold`, or `plan-groundwork`, and the rest were chat prompts with no reader in the toolkit.

The release carries a breaking-change marker, since removing `canon snippets` is breaking by semver and the marker puts the retirement in the release notes a target reads.

A target is told rather than migrated. A project that installed snippets under an older toolkit may hold a `.claude/snippets/` folder, and the reverse walk in `canon sync --check` reports it as `dropped` once `snippets/` is gone from the toolkit's tree, with no new detection code. `docs/target/target-migrations.md` names the folder and warns against deleting a root `snippets/` the project wrote itself.

## Alternatives

- **Keep the domain as it was.** Rejected: a domain nobody fires still costs a verb, a skill, a standard, a count, and a symlink to keep correct, and every one of them drifted without a reader to notice.
- **Fold each snippet into the skill it overlapped.** Rejected: the overlap was the reason to drop them, since the skill already did the job, and appending a snippet's text to a skill body grows a body for a reader who never asked for it.
- **Move each snippet into whichever of rule, skill, or standard fits it.** Rejected for this change: a move is a per-file judgment the operator owns, and dropping first leaves any later move free to start from the file in history rather than from a copy that kept drifting.

## Measurements

Fourteen snippet files and one preset manifest were deleted, eleven under `snippets/` and three under `internal/snippets/`, along with one plugin skill, one internal skill, one standard, and one CLI verb. The catalog sweep drops from six catalogs to five. Measured against `8f80a704` on 2026-09-26.
