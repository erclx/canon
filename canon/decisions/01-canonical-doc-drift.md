---
title: Canonical docs drift by accretion, and get a decision log to absorb it
description: Why canon/decisions/ exists, what else a canonical-doc drift measurement concluded, and what was considered and dropped
---

# Canonical docs drift by accretion, and get a decision log to absorb it

## Context

Canonical docs drift by accretion rather than by error. Every change that moves a fact appends a paragraph about the move instead of rewriting the fact, and pick rounds, superseded figures, and rejected alternatives pile up in a document meant to state the system as it stands.

A measurement across two projects found the pattern real rather than anecdotal: an always-loaded architecture file carrying tens of thousands of words, most of its context entries past their own length checkpoint, and the existing tooling unable to see most of it, since a citation audit gates references and never weight, and a docs-sync pass never checks what it writes. History had no tracked home, so writers kept it in the docs it was meant to leave.

## Decision

Give decision history a tracked home that nothing loads eagerly: a `canon/decisions/` folder, one record per decision, named `<nn>-<slug>.md` and cited by the canonical doc that used to carry the history inline. A canonical doc's own retirement rule, added separately, decides when to write a record and rewrite its own body in place rather than appending to it. This record is the first proof that the folder holds something readable on its own.

The wider measurement concluded more than the log. It also called for edits to the five canonical-doc standards so each one states what stays in the doc versus what moves here, a classifier verb that flags a drifting edit before it ships, an audit extension that reports architecture weight and wireframe-state coverage, and a `docs-fold` change that rewrites a superseded statement instead of appending to it. Those four are their own decisions once built, each anchored by its own measurement at the commit it ships on. This record covers only the log, which is what unblocks the rest: every retirement rule the other four depend on points here.

## Alternatives

- **An intake folder for the drift measurement instead of a focused track.** Rejected: nearly every finding was already decided and measured, so an intake pass would have re-asked questions the measurement had already answered.
- **Gating drift by an automated push check rather than a written standard.** Rejected: most of what makes a canonical doc drift is a judgment call about what to keep, and a judgment finding that fails a push gets routed around rather than fixed. Only checkable facts, such as the length checkpoint already enforced elsewhere, belong on a gate.
- **Citing the gitignored records folder from a tracked decision record.** Rejected: a clone without the records folder resolves nothing there, and a decision record is meant to stand alone.
- **Fanning decision history out into each canonical doc's own folder rather than one shared log.** Rejected without a full measurement: a shared, ordinal-sorted log gives a reader one place to look for when a decision landed, where a per-doc split would need an index of its own to reconstruct that order.

## Measurements

An always-loaded architecture file ran to 14,151 words, and 43 of 59 context entries sat past the standard's own 150-line checkpoint. Two projects' own doc-commit history showed the same accretion pattern: one added roughly 22 words for every one it removed across its canonical docs, and this repository's own last 150 doc commits added roughly 12 for every one removed. Measured at `1f98c883` on 2026-09-14, with the comparison project's figures read at that project's own `55a5929` the same day.
