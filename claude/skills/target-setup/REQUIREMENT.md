---
name: target-setup
description: Why getting a project onto the toolkit is one skill with phases rather than a family a session has to pick among
---

# Setup requirement

## Gap

Without this skill, a session facing a project that does not carry the toolkit
resolves the stack by hand, picks per-domain install commands from the CLI
surface, and runs them in an order nothing states. The install logic lives in
`canon init`, so what is missing is not the writing but the reading: which stack
matches this project, which extras it needs beyond the stack, and what the
commands will do before they run.

The naive shape is one skill per phase, and it failed on discrimination rather
than on content. Six descriptions covering one job made the model pick among
them on wording, and the two that split on how heavy their checks are gave a
session no way to tell from the catalog which one a scaffold wanted. A phase
argument answers the same question by naming the depth rather than by choosing
between two bodies that differ in a table.

Merging also closes a class of drift the family carried. Detection was stated
twice, once for the full chain and once for the governance-only route, and the
two copies could disagree with nothing comparing them.

## Must

- Read the toolkit catalogs before resolving, and hardcode no stack or rule name
- Preview the resolved arguments and the exact commands before the first write
- Mark a fallback resolution as a fallback in the preview, where it can still be declined
- Run every phase without a TTY, and carry an argument for each prompt a phase would otherwise open
- Reach each phase alone, so a caller wanting one layer does not run the chain to get it
- Name a destination for each state the chain declines rather than ending on the refusal

## Must not

- Guard against clobbering an existing project's configs, which routes to `canon-operator` instead
- Author a rule or a stack in the target project on the fly
- Generate a config the tooling stack ships as a golden file
- Install Claude Code plugins, which provision a machine rather than a project
- Fail an unattended scaffold on a server start, which is flaky enough to be a depth the operator asks for
- Survive as a skill nothing invokes but a person typing its name. `canon-operator` hands first-time scaffold here and the target-projects page names it as the scaffold step, so a later read finding no caller but the author has found a body that should have stayed a verb

## Guards

- No `package.json` at the project root stops the verify phase, since there are no declared scripts to read
- A missing dependency folder installs first rather than letting every script fail on the same cause
- A detected technology with no matching rule surfaces rather than resolving to a guess

## Out of scope

- An existing project's per-domain drift, which `canon-operator` diagnoses and `target-check` reports
- Reaching a remote or the project's history, which `repo-metadata` and `git-commit` own
- Provisioning Claude Code plugins on a machine, which the `claude plugin` CLI does directly
