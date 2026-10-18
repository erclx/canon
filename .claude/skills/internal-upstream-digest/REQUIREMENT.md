---
name: internal-upstream-digest
description: Why a hand-run triage of Claude Code releases needs its own skill, and the line between it, the verbs it drives, and the intake skill that files its output
---

# Internal upstream digest requirement

## Gap

Without this skill, a session asked what changed upstream reads the release notes whole and spends its context on fixes for surfaces canon never ships on. It judges lines from the notes alone, keeps items it never checked against a file, and misses a built-in that overlaps a canon mechanism it never listed.

It files a finding as a fix and edits a file in the same session, advances the range before the findings land so a dead run skips releases, and calls the bare `canon`, which fails on a verb not yet published.

## Must

- The fetch and catalog verbs run first, so noise is dropped and the mechanism list is generated
- Each kept claim is verified against the repository and quotes `file:line` or a line of text
- Findings sort into the five classes and land as one intake pass, with the release range in its overview
- The cursor advances through the verb only after the pass lands
- The digest says it is a first pass

## Must not

- Edit a file outside the intake folder
- Run headless or in a cloud session
- Restate the verb contract or the reasoning, which `canon upstream --help` and the internal skills entry own

## Out of scope

- Filing the intake folder's shape, which `plan-intake` owns
- Editing a wiki page a finding names, which `write-doc` owns
