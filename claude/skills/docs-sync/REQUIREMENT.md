---
name: docs-sync
description: Scope boundary for consumer-facing prose against the agent-facing docs the ship chain syncs beside it
---

# Docs sync requirement

## Gap

A rename or a dropped flag ships with the README still describing the old surface, and no test reads prose. Rewriting whole files churns sections the change never reached. A doc edited earlier in the session passes file-level classification while a later change leaves a section stale.

"Sync the docs" names either corpus, so a bare description takes a request meant for its sibling. A diff resolved against a bare local ref equals HEAD on `main`, so the skill reports nothing to sync and reads as clean. A hardcoded doc list misses a file added later.

## Must

- Name the corpus in every trigger phrase
- Resolve one merge base, prefer the remote ref over the local, and reuse it wherever the diff is read
- Say so in the output when the baseline degrades, rather than reporting a clean pass
- Discover the doc set by glob at run time, and classify and rewrite at section level
- Mark a section stale only when the diff changes what a caller sees, and write right after the preview

## Must not

- Touch a section the change does not reach
- Rewrite a doc to match the diff when the doc records an intent the diff departed from
- Read docs when there is no committed or working-tree change

## Out of scope

- The context entries, which `context-fold` owns, and the task board, which `task-complete` owns
- The requirements record, which `document-health` owns
- `CLAUDE.md` and the installed seed docs, which an operator reconciles by hand
- Changelog entries, which release tooling generates
- Whether the prose conforms to its standards, which `canon markdown audit` reports
