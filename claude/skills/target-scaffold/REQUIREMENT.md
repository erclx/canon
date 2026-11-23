---
name: target-scaffold
description: Why an empty folder gets its own skill rather than a branch inside target-setup
---

# Scaffold requirement

## Gap

A developer in an empty folder has no skill to run. `target-setup` detects a stack from files that are not there yet, so it falls back to `base` and installs tooling onto nothing. The tested starters sit in the stack manifests. A session left to improvise picks a scaffolder from memory, answers its prompts wrong, or writes into the wrong folder.

A full stack project started on a starter's `src/` later adds a Worker or a CLI beside it, leaving one folder named for a kind among folders named for a role, and moving the app afterward touches every import and config naming it.

A scaffold run from a planning session in another repository ends with that session holding everything the new project's first session needs. Every handoff skill matches a note within one repository, so nothing carries the plan, the setup state, or the next step across.

## Must

- Offer only the stacks the catalog reports as carrying a starter, read at runtime, and start the project through the CLI verb alone, so the starter that runs is the one `canon tooling verify` tests
- Write nothing into a folder that already holds files, and route that folder to `target-setup`
- Leave the project name and the site or full stack call to the person, refusing a name a package manager would reject rather than renaming it, and start a full stack project under a role-named root
- Hand the started project to `target-setup` with nothing resolved ahead of its own detection
- Leave the new project's first session what a planning session knew, in a gitignored note the printed opening prompt names, whenever the scaffold ran from one

## Must not

- Run a scaffolder command directly, which drifts from the manifest the verb reads
- Pick a stack for a caller who named none
- Depend on the author typing its name, since `target-setup` routes an empty folder here
- Write the kickoff note into a tracked file or a task on the new project's board, since it may cite a private path and a row needs an origin the new board cannot supply
- Restate the plan's decisions in the note, which then drifts from the plan it points at

## Out of scope

- Installing tooling, governance, and indexes on the started project, which `target-setup` owns
- Shipping a starter template of its own, since the toolkit ships no application code
