---
name: target-scaffold
description: Why an empty folder gets its own skill rather than a branch inside target-setup
---

# Scaffold requirement

## Gap

A developer in an empty folder has no skill to run. `target-setup` detects a stack from files that are not there yet, so it falls back to `base` and installs tooling onto nothing.

The tested non-interactive starters sit in the stack manifests. A session left to improvise picks a scaffolder from memory, answers its prompts wrong, or writes into the wrong folder.

## Must

- Offer only the stacks the catalog reports as carrying a starter, read at runtime rather than hardcoded
- Start the project through the CLI verb alone, so the starter that runs is the one `canon tooling verify` tests
- Write nothing into a folder that already holds files, and route that folder to `target-setup`
- Leave the project name to the person, refusing rather than renaming when a package manager would reject it
- Hand the started project to `target-setup` with nothing resolved ahead of its own detection

## Must not

- Run a scaffolder command directly, which drifts from the manifest the verb reads
- Pick a stack for a caller who named none
- Depend on the author typing its name, since `target-setup` routes an empty folder here

## Out of scope

- Installing tooling, governance, and indexes on the started project, which `target-setup` owns
- Shipping a starter template of its own, since the toolkit ships no application code
