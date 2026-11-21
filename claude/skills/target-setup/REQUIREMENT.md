---
name: target-setup
description: Why getting a project onto the toolkit is one skill with phases rather than a family a session has to pick among
---

# Setup requirement

## Gap

Without this skill, a session facing a project without the toolkit resolves the stack by hand and runs per-domain install commands in an order nothing states. `canon init` holds the install logic, so the gap is the reading of which stack matches, which extras it needs, and what the commands will do.

One skill per phase fails on discrimination, since descriptions covering one job make the model pick on wording. Detection stated per route also drifts. A phase argument names the depth instead of choosing between two bodies. At the default depth alone, a scaffold reads as done before anyone has started the app.

## Must

- Read the toolkit catalogs before resolving, and hardcode no stack or rule name
- Preview the resolved arguments and the exact commands before the first write, marking a fallback resolution as a fallback while it can still be declined
- Reach each phase alone and run it without a TTY, so a caller wanting one layer skips the chain and each prompt a phase would open has an argument answering it
- Surface a detected technology with no matching rule rather than resolving to a guess, and name a destination for each state the chain declines
- State in a fresh scaffold's report whether the app was started, so a run that never started it does not read as verified

## Must not

- Guard against clobbering an existing project's configs, which `canon sync` covers
- Author a rule or a stack in the target project on the fly, or generate a config the tooling stack ships as a golden file
- Install Claude Code plugins, which provision a machine rather than a project
- Fail an unattended scaffold on a server start

## Out of scope

- An existing project's per-domain drift, which `target-check` owns
- Reaching the project's history, which `git-commit` owns
- Provisioning Claude Code plugins on a machine, which the `claude plugin` CLI owns
