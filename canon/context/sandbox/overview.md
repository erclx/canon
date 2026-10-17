---
title: Overview
description: What the sandbox domain owns, the scenario categories, provisioning defaults, and the standing limits a run cannot reach
---

# Overview

## Overview

Owns the scenarios that provision isolated project states for testing scripts, configs, and skills. Each scenario defines a known starting state plus instructions for what to run and what to expect.

The scripts live under `sandbox/` rather than `scripts/`, since the authoring contract is its own domain, which is also why it sits apart from `canon/context/scripts/index.md`.

## Layout

- `sandbox/` owns the scenario scripts, one folder per category
- `sandbox/<category>/` owns one `.ts` file per command, each holding one or more named scenarios
- `sandbox/fixtures/` owns file content staged into the sandbox and each arm's `expect.toml`
- `src/sandbox/` owns the provisioning order, the scenario contract and loader in `scenario.ts`, the expectation checker, the coverage report, and the skill census
- `$XDG_STATE_HOME/canon/sandbox-<run-id>` owns the provisioned project state, outside the repository and unique to the run

Run `canon sandbox` with no args for the live catalog, since categories and scenarios enumerate dynamically.

`fixtures/` sits beside the categories but holds no scenarios, and `listCategories` in `src/sandbox/scenario.ts` filters it out. Any other subdirectory added there reads as a category, so a helper the harness needs on disk goes to `src/sandbox/`.

## Decisions

### A root folder named for its role

The scenario tree sits at `sandbox/` rather than under `scripts/`, the folder for a project's chores. The harness carries its own authoring contract, census, and expectation scoring, and it held seven eighths of the shell under `scripts/`, so the chores folder was mostly one domain that was not a chore.

Staying under `scripts/` would tie the folder to the language. The scenarios are meant to be rebuilt in TypeScript in this same folder, which a role name survives.

- The provisioning order lives in `src/sandbox/provision.ts`
- The headless runner lives in `src/sandbox/headless/` with its dispatch bound, and `canon sandbox run` is the only spelling that drives it
- Four gates walk `scripts/` by name, being `check:shell`, the `shfmt` roots in `format` and `check:format`, and `scripts/core/check-color-source.sh`
- The harness holds no shell file, so `sandbox` is no root of the first three. The color check still walks both roots and fails when either is missing.

### Scenario defaults and the reset contract

Sandboxes are minimal by default, with no seeds, no gov rules, and auto-commit on. A scenario declares only the flags it needs, so the fixture states exactly what it depends on.

- `claude/` scenarios default to `SANDBOX_INJECT_SEEDS="true"` so each models a real post-`canon init` project
- Two exceptions exist: `target-setup.ts` tests `canon init` itself, and `auto-ship.ts` wipes the anchor after injection
- The reset contract belongs to the scenario, not the framework. A scenario touching a real remote closes its own PRs and force-pushes a fresh main, because only the scenario knows what it created.

### What a sandbox is provisioned with

Gov rules and seeds provision through the real installer, `canon gov install` for the first and `canon claude init` for the second. A hand-built copy drifts from the installer and from the stamp it writes, and a sandbox carrying what a target carries is what makes a rule change observable.

- No skill reference provisions into the sandbox tree, since every reference ships inside its owner skill. A skill reading one exercises the sibling path a real target resolves.
- Copying `tooling/claude/seeds/` as it sat left every seeded arm holding records at retired paths and missing the folders `planSeeds` re-roots
- The install also merges `.canon/` into the sandbox `.gitignore`, so a record a scenario stages stays untracked as in a target
- Hooks ship inside the seed tree, so a hook change reaches any scenario declaring `SANDBOX_INJECT_SEEDS`

### Naming and staging a scenario

A scenario file is named for the skill it drives, not for the domain the skill sits in. `sandbox/claude/context-fold.ts` drives `/canon:context-fold`, and a diverging name would leave the `<category>/<rest>` mapping finding nothing and the audit reporting the skill unpaired. A renamed skill takes its scenario file with it.

- A scenario whose expectation reads a slug checks out its branch explicitly, since `git init` inherits `init.defaultBranch` and an arm resting on the initial name passes or fails by local config
- Git history initializes fresh each run, and a `refs/sandbox/baseline` ref marks the post-setup state so `canon sandbox reset` restores without provisioning again

### Two headless harnesses rather than one

The retired eval runner extracted its fixture to a `mktemp -d` carrying no seed, the opposite of the sandbox's need to look like a real installed project. Merging the two would cost one of them its defining property.

Location and inheritance are separable, which lets both sit outside the repository. The eval fixture carries no seed, and the sandbox still carries its seed and gov rules.

## Gotchas

### Scenario traps

Five traps catch a first-time author.

- Skip `create` scenarios. They require user input with no default and loop on empty input.
- A scenario adding narrative to a seeded file appends rather than overwrites, since overwriting clobbers the seed (`create/` versus `append/` in a fixture tree, `>` versus `>>` inline)
- A scenario name matching no option aborts with an `Unknown scenario` error
- `dev:review` provisions red on every run, since its arm commits the fixture itself while auto-commit finds nothing and exits 1. Equivalence reads it as red-on-base, so a port inherits the red.
- On Windows, back-to-back headless runs can briefly fail to wipe the sandbox tree with a busy-lock. Re-run, or `canon sandbox clean` first.

### Scope, PATH, and fixtures

Four constraints shape what an arm can reach.

- Skills whose body forbids probing project surfaces, such as `canon-feedback`, stay out of scope
- `infra:feedback` asserts `canon feedback` refusing an incomplete report, since a valid report opens a real issue rather than writing into the snapshot tree
- A driven session calls the `canon` on PATH, the published release. A catalog the branch extends is absent until a release ships it. `canon/context/sandbox/headless.md` carries the repair.
- Anchor scenarios take their starting tree from a fixture, so provisioning does not depend on the previous arm. The force-pushes remain, so an assertion reading `origin/main` is order-sensitive.
- After provisioning, the terminal cwd may need a refresh, which a wrapper in `.zshrc` or `.bashrc` supplies

```bash
canon() {
  command canon "$@"
  cd .
}
```

### Standing limits

Six things a run cannot reach. Each is a property of the harness rather than a gap to close per task, so a claim depending on one is hand-verified and says so.

| Limit                                                                     | Why                                                                                                                                                 |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace install behavior                                              | `canon sandbox run` points `--plugin-dir` at a worktree instead of installing the plugin                                                            |
| A mid-session rule change                                                 | rules are discovered at session start and the harness spawns a fresh session per run, so it binds the session doing the editing rather than the run |
| Host-conditional behavior such as linked-worktree locks                   | a standalone sandbox repo cannot trigger it                                                                                                         |
| The sibling reference route of a changed skill                            | in an interactive sandbox both routes can land on one file                                                                                          |
| A write outside the sandbox tree and the four watched scratch directories | `canon/context/sandbox/isolation.md` bounds the watch                                                                                               |
| Git state                                                                 | `snapshotTree` excludes `.git` and no declaration key reaches a commit or branch                                                                    |

A nested background dispatch is not on this list. A shim bounds it and `sessions` records it, and `canon/context/sandbox/isolation.md` states the three cases that bound still misses.

### The sibling reference route

A shipped body cites `${CLAUDE_SKILL_DIR}/../<skill>/references/<file>.md`, and `${CLAUDE_SKILL_DIR}` expands to wherever the harness found the skill.

| Route          | Base                                          | Cited reference lands on                                                                               |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--plugin-dir` | the owner skill under `<root>/claude/skills/` | a tree the sandbox does not carry, so an assertion that the sandbox holds no copy separates the routes |
| injection      | `<sandbox>/.claude/skills/<name>/`            | a path inside the fixture that no assertion can tell from a project copy                               |

`canon sandbox run` sets `SANDBOX_SKIP_SKILL_INJECT`, so `injectChangedSkills` in `src/sandbox/provision.ts` copies nothing for a headless run, and every skill there resolves through `--plugin-dir`. The gap stays for an interactive sandbox, which injects exactly the skills the branch changed.

### Git state

The gap costs `git-stage` and `git-split` most, since rewriting commits and branches is the largest blast radius in the catalog and a `reply` assertion over either covers what the skill said rather than what it did. Closing it takes a new assertion kind rather than another declaration, so both skills stay `should-be-asserted` until one exists.
