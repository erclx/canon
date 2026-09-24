---
title: Overview
description: What the sandbox domain owns, the scenario categories, provisioning defaults, and the standing limits a run cannot reach
---

# Overview

## Overview

Owns the scenarios that provision isolated project states for testing scripts, configs, and skills. Each scenario defines a known starting state plus instructions for what to run and what to expect. The scripts live under `scripts/sandbox/`, but the authoring contract is its own domain, which is why it sits apart from `canon/context/scripts/index.md`.

## Layout

- `scripts/sandbox/` owns the scenario scripts, one folder per category
- `scripts/sandbox/<category>/` owns one file per command, each holding one or more named scenarios
- `scripts/sandbox/fixtures/` owns file content staged into the sandbox and each arm's `expect.toml`
- `src/sandbox/` owns the expectation checker, the coverage report, and the skill census
- `$XDG_STATE_HOME/canon/sandbox-<run-id>` owns the provisioned project state, outside the repository and unique to the run that provisioned it

Run `canon sandbox` with no args for the live catalog. Categories and scenarios enumerate dynamically, so nothing here changes when one is added. `fixtures/` sits beside the categories but holds no scenarios, and every picker filters it out by the literal string `fixtures` in `scripts/manage-sandbox.sh`, `src/commands/sandbox.ts`, and `src/sandbox/coverage.ts`. Any other subdirectory added there reads as a category in all three, so a helper the harness needs on disk goes to `scripts/lib/`, where `sandbox-dispatch.sh` sits.

## Decisions

### Scenario defaults and the reset contract

- Sandboxes are minimal by default: no seeds, no gov rules, and auto-commit on. A scenario declares only the flags it needs, so the fixture states exactly what it depends on.
- `claude/` scenarios default to `SANDBOX_INJECT_SEEDS="true"` so each models a real post-`canon init` project. Two documented exceptions: `target-setup.sh` tests `canon init` itself, and `auto-ship.sh` wipes the anchor after injection.
- The reset contract belongs to the scenario, not the framework. A scenario that touches a real remote closes its own PRs and force-pushes a fresh main, because only the scenario knows what it created.

### What a sandbox is provisioned with

- Gov rules provision through the real installer rather than a hand-built copy. A copy reimplementing an installer's selection rules drifts from what the installer does and from the stamp it writes, and a sandbox carrying what a target carries is what makes a rule change observable to a run.
- No standards folder provisions at all, since nothing installs the corpus into a project. A skill reading a standard exercises the resolve a real target takes.
- Seeds stay a raw copy. `canon claude init` does more than drop files, and the scenarios depending on the current shape outnumber the drift the copy risks. Hooks ship inside the seed tree, so a hook change reaches any scenario declaring `SANDBOX_INJECT_SEEDS`.

### Naming and staging a scenario

- A scenario file is named for the skill it drives, not for the domain the skill sits in. `scripts/sandbox/claude/memory-review.sh` drives `/canon:memory-review`, and a name that diverged would leave the `<category>/<rest>.sh` mapping finding nothing and the audit reporting the skill unpaired. A renamed skill takes its scenario file with it.
- A scenario whose expectation reads a slug checks out its branch explicitly. `git init` inherits the machine's `init.defaultBranch`, so an arm resting on the initial branch name passes or fails by local git config.
- Git history initializes fresh each run, and a `refs/sandbox/baseline` ref marks the post-setup state so `canon sandbox reset` restores without provisioning again.

### Two headless harnesses rather than one

`scripts/eval/run.sh` extracts its fixture to a `mktemp -d` carrying no seed, which is the opposite of the sandbox's need to look like a real installed project. Merging the two would cost one of them its defining property. Location and inheritance are separable, which is what lets both sit outside the repository: the eval fixture carries no seed, and the sandbox still carries its seed and its gov rules.

## Gotchas

- Skip `create` scenarios. They require user input with no default and loop on empty input.
- A scenario that adds narrative to a seeded file appends rather than overwrites. Overwriting clobbers the seed and breaks any test depending on seed-driven behavior. In a fixture tree that is the `create/` versus `append/` split, and written inline it is `>` versus `>>`.
- Passing a scenario name that matches no option aborts with an `Unknown scenario` error.
- On Windows, back-to-back headless runs can briefly fail to wipe the sandbox tree with a busy-lock. Re-run, or `canon sandbox clean` first.
- Skills whose body forbids probing project surfaces, such as `canon-feedback`, have no fixture to anchor and stay out of scope. The command such a skill drives can still earn an arm under `infra/`, where `infra:feedback` asserts `canon feedback` refusing a report missing a required field. The refusal is the half a sandbox sees, since a report that passes validation writes into the toolkit's own `.canon/feedback/` rather than into the tree the snapshot covers.
- A driven session calls the `canon` on PATH, which is the published release rather than the checkout under test. A catalog the branch extends, such as a new governance rule, is absent from that session's `canon gov list`, so a `target-setup` arm cannot `--add` it until a release ships it. `canon/context/sandbox/headless.md` carries the repair.
- Anchor scenarios take their starting tree from a fixture, so provisioning does not depend on what the previous arm published to the remote. The force-pushes remain, so an assertion that reads `origin/main` rather than the working tree is still order-sensitive.
- After provisioning, the terminal cwd may need a refresh. Add a wrapper to `.zshrc` or `.bashrc`:

```bash
canon() {
  command canon "$@"
  cd .
}
```

## Standing limits

Six things a run cannot reach. Each is a property of the harness rather than a gap to close per task, so a claim depending on one is hand-verified and says so.

- Marketplace install behavior. `run.sh` points `--plugin-dir` at a worktree instead of installing the plugin, so anything depending on a real install stays outside the harness.
- A mid-session rule change. Rules are discovered at session start and the harness spawns a fresh session per run, so this binds the session doing the editing rather than the run.
- Host-conditional behavior such as linked-worktree locks or remote-state failures. A standalone sandbox repo cannot reproduce the trigger.
- The standards fallback of a skill the branch changed. Both resolution routes can land on one file, and no assertion tells them apart.
- A write landing outside both the sandbox tree and the four watched scratch directories. `canon/context/sandbox/isolation.md` states what the watch reaches.
- Git state. `snapshot_tree` excludes `.git`, and the declaration keys read paths, file content, the write list, the reply, and the turn count, so no key reaches a commit, a branch, or a rewritten history.

A nested background dispatch is not on this list. A shim bounds it and `sessions` records it, and `canon/context/sandbox/isolation.md` states the three cases that bound still misses.

### The standards fallback

A shipped body cites `${CLAUDE_SKILL_DIR}/../../standards/<file>.md`, and `${CLAUDE_SKILL_DIR}` expands to wherever the harness found the skill. Resolved through `--plugin-dir`, that lands on `<root>/standards/`, a tree the sandbox does not carry, so an arm asserting the sandbox holds no standard still separates the two. Resolved through injection, the base is `<sandbox>/.claude/skills/<name>/`, so the citation lands on `<sandbox>/.claude/standards/`, a path inside the fixture that no assertion can tell from a project copy.

`inject_changed_skills` injects exactly the skills the branch changed, so the skills most in need of the check are the ones injection disqualifies, and checking a fallback means leaving that skill's body alone on the branch. Closing the gap means changing what injection copies or what `--plugin-dir` points at, and both trade one unreachable case for another.

### Git state

The gap costs `git-stage` and `git-split` most, since rewriting commits and branches is the largest blast radius in the catalog and a `reply` assertion over either covers what the skill said rather than what it did. Closing it takes a new assertion kind rather than another declaration, so both skills stay `should-be-asserted` until one exists.
