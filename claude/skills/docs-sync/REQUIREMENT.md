---
name: docs-sync
description: Scope boundary for consumer-facing prose against the agent-facing docs the ship chain syncs beside it
---

# Docs sync requirement

## Gap

Without this skill, a rename or a dropped flag ships with the README still describing the old surface. Nothing fails, because no test reads prose, so the doc stays wrong until a person hits it.

Three failures belong to the sync itself rather than to the drift. A session that syncs by rewriting whole files churns sections the change never reached, which costs the reviewer the ability to tell the sync from the feature. A doc edited earlier in the same session reads as current while a later change leaves one of its sections stale, so file-level classification passes where section-level would not. And a hardcoded doc list never checks the file someone added after the list was written.

The trigger is a failure of its own. "Sync the docs" names either corpus to the person saying it, so a description claiming the bare phrase takes the request meant for the planning surface its sibling owns, and the run rewrites a README nobody asked about while the `.claude/` docs it was called for stay stale.

The quiet one is the baseline. A diff resolved against a bare local ref equals HEAD on `main` and on a branch before its first commit, so every committed change drops out of the set. The skill then reports nothing to sync, which reads as a clean result rather than as an admission that it could not see the work.

## Must

- Name the corpus in every trigger phrase, so a request naming neither reaches one skill of the pair rather than either
- Resolve one merge base, prefer the remote ref over the local one, and reuse it everywhere the skill reads the diff
- Say so in the output when the baseline degrades, rather than reporting a clean pass off a set it could not build
- Discover the doc set by glob at run time
- Classify and rewrite at section level, so a partly stale file is partly rewritten
- Write immediately after the preview, since the tool permission dialog is the confirmation gate

## Must not

- Touch a section the change does not reach
- Rewrite a doc to match the diff when the doc records an intent the diff departed from. That is a finding rather than a sync.

## Guards

- No committed change and no working-tree change stops the skill before it reads any doc

## Out of scope

- `.claude/` planning docs, tasks, plans, and context entries: `context-fold`, which runs immediately before this skill in the ship chain and resolves the same baseline. The split is by audience, so a file's location decides which skill owns it rather than its subject.
- `CLAUDE.md` and the installed seed docs: `seed-sync`, which reconciles them per section against the toolkit source
- Changelog entries, which release tooling generates from commit messages
- Whether the prose conforms to its standards. `standards-audit` reports violations and fixes none, and this skill writes prose it does not audit.
