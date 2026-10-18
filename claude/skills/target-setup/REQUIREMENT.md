---
name: target-setup
description: Why getting a project onto the toolkit is one skill with phases rather than a family a session has to pick among
---

# Setup requirement

## Gap

Without this skill, a session facing a project without the toolkit resolves the stack by hand and runs per-domain install commands in an order nothing states. `canon init` holds the install logic, so the gap is the reading of which stack matches, which extras it needs, and what the commands will do.

One skill per phase fails on discrimination, since descriptions covering one job make the model pick on wording. Detection stated per route also drifts. A phase argument names the depth instead of choosing between two bodies.

## Must

- Read the toolkit catalogs before resolving, and hardcode no stack or rule name
- Preview the resolved arguments and the exact commands before the first write, marking a fallback resolution as a fallback while it can still be declined
- Run every phase without a TTY, with an argument for each prompt a phase would otherwise open
- Reach each phase alone, so a caller wanting one layer does not run the chain to get it
- Surface a detected technology with no matching rule rather than resolving to a guess, and name a destination for each state the chain declines

## Must not

- Guard against clobbering an existing project's configs, which `canon sync` covers
- Author a rule or a stack in the target project on the fly, or generate a config the tooling stack ships as a golden file
- Install Claude Code plugins, which provision a machine rather than a project
- Fail an unattended scaffold on a server start

## Out of scope

- An existing project's per-domain drift, which `target-check` owns
- Reaching the project's history, which `git-commit` owns
- Provisioning Claude Code plugins on a machine, which the `claude plugin` CLI owns
