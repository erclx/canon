---
name: docs-sync
description: Scope boundary for consumer-facing prose against the agent-facing docs the ship chain syncs beside it
---

# Docs sync requirement

## Gap

A rename or a dropped flag ships with the README still describing the old surface, and no test reads prose. Rewriting whole files churns sections the change never reached. A doc edited earlier in the session passes file-level classification while a later change leaves a section stale.

"Sync the docs" names either corpus, so a bare description takes a request meant for its sibling. A diff resolved against a bare local ref equals HEAD on `main`, so the skill reports nothing to sync and reads as clean. A hardcoded doc list misses a file added later.

### Where a new surface lands

A sync with no step that creates a page lands every feature on the nearest existing one, until a few pages cover a whole product and one section runs dozens of bullets. Left to judgment, two sessions place one new name on two pages.

## Must

- Name the corpus in every trigger phrase
- Resolve one merge base, prefer the remote ref, reuse it wherever the diff is read, and say so when the baseline degrades rather than reporting a clean pass
- Discover the doc set by glob at run time, and classify and rewrite at section level
- Mark a section stale only when the diff changes what a caller sees, and write right after the preview
- Place each new surface before rewriting, creating a page or heading only when a closed list's trigger fires, finding the nearest page by a search, and naming each created or moved path

## Must not

- Touch a section the change does not reach
- Rewrite a doc to match the diff when the doc records an intent the diff departed from
- Read docs when there is no committed or working-tree change
- Split a page or an H2 the run is not writing into

## Out of scope

- The context entries, which `context-fold` owns, and the task board, which `task-complete` owns
- The requirements record, which `document-health` owns
- `CLAUDE.md` and the installed seed docs, which an operator reconciles by hand
- Changelog entries, which release tooling generates
- Whether the prose conforms to its standards, which `canon markdown audit` reports
