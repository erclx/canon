---
title: Worktree entry
description: The core.bare repair, the dependency check's presence test, the branch entry hands the ship chain, and how a run on main names its worktree
---

# Worktree entry

## Overview

This entry covers `session-worktree` and the chain it feeds. It holds the `core.bare` repair, the dependency check, the branch entry hands the ship chain, and how a run on `main` names its worktree.

## Layout

### What the check reads

`session-worktree` Step 6 carries the dependency check itself. Node and python each read against a literal `[ -f ... ]` or `[ -d ... ]` pair, and the closing "no manifest" line takes its own direct test, run ahead of both rather than reached by falling through them unmatched.

`<install>` resolves off a fixed four-row lockfile table in `references/install-command.md`. The order is `bun.lock` or `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, then `package-lock.json`, falling back to `bun install` when none match.

### Why the dependency check is not a verb

The dependency check is a literal shell test rather than a `canon` verb, since directory presence is not a judgment call and the body ships to a target that may hold no `canon` binary on PATH at all.

### The shape test

A file resolving under any tier can still be the wrong document, so the shape test checks the resolved file for the `**Files to touch:**` marker that `claude/skills/plan-feature/references/plan.md` requires, or the `## Files to touch` heading form the same standard admits. A task never carries either.

The test runs after all three tiers rather than guarding the supplied one alone.

- A branch slug matching an unrelated plan is the same wrong-file risk under the derived tier
- A task's own pointer can name a non-plan under the first

### The caller-supplied tier

`auto-ship` Step 0 enters the worktree ahead of Step 1, so it holds the raw invocation argument rather than a resolved plan. When that argument is a plan path or a bare slug, it runs `canon tasks plan-branch` on it and hands the returned `<type>/<slug>` to `session-worktree` as its tier 0 argument.

- `orchestrator-dispatch.md` runs the same verb on the same plan to pick the branch its collision check clears, so the checked branch and the taken branch are one string
- A plan named outside `feature-<slug>.md`, such as a phased row backing several branches from one file, still needs its own file per branch, since one plan cannot answer for more than one
- A type spelled by the caller wins over the one the verb returns

### What the pointer resolves against

A task's `Plan:` pointer resolves against a base, and the base decides whether the archive refusal reaches anything. An archived task sits a folder deeper and the standard points its line at `../../plans/archive/feature-<slug>.md`.

A base fixed at `.canon/tasks/` lands on a repository-root `plans/archive/` that never exists, so the run answers a correct citation with the stale-citation message.

- Resolving against the directory holding the task file closes that
- Taking a bare path beside a link target reaches the older tasks writing the target as a plain project-root path

## Decisions

### Two repair points in the skill

`session-worktree` repairs `core.bare` at two points rather than one. Claude Code's entry tool writes the flag into the parent repository's shared config and its exit tool never restores it.

Every later command in the main worktree then fails for want of a work tree while the files sit untouched. The linked worktree keeps working, so the session that caused the damage is least likely to see it.

- Repairing only after entry would still admit a repository broken by an earlier session, so Step 1 reads the flag beside the main-root resolution and repairs before entering
- Step 5 repeats the repair
- Both writes are guarded on the flag being set, since an unconditional repair would rewrite the config on runs where nothing broke

### The second line of defense

`repairBareFlag` in `src/worktrees/bare-flag.ts` carries the same repair, because nothing forces worktree entry through the skill and one occurrence hit an operator whose session never entered a worktree.

- `canon gate run` calls it in-process ahead of every stage, since the flag breaks the git reads that scope the run
- The `Bash` hook reaches it through the hidden `canon worktrees repair-bare-flag` verb
- A git hook cannot serve here, because the corrupted command aborts before any hook runs

Both call sites confirm the repository's common dir is named `.git` before writing. That separates the defect from a genuinely bare repository that keeps its objects at the root and would be broken by the repair.

The skill states the upstream issue inline rather than pointing at `wiki/claude/worktrees.md`, since a shipped skill runs where no `wiki/` path resolves and the Skill paths stage fails the build on one.

### A typed name serves both consumers

`session-worktree` renames the entered branch to `<type>/<name>` rather than the bare `<name>`, because two consumers pull in opposite directions on that string.

- Slug derivation wants the plan's own slug, since `auto-ship` keys its worktree, review receipt, and pull request on the branch
- `git-pr` guards on `<type>/<description>` and refuses anything without a type

A bare name satisfies the first and fails the second mid-chain, with the work already done and uncommitted. `claude/skills/git-branch/references/slug.md` drops a leading type segment before it replaces slashes, so one branch answers both and no consumer learns a second spelling.

### Collisions stop before entry

Entering from a branch that is already conventional stops on the collision. The name derives back onto the branch the session came from, git refuses a second branch under it, and the type default cannot invent a distinct one.

Both collision tests sit in Step 2, ahead of the entry call, because the typed name turns a rare stop into a common one and a stop after entry leaves a worktree built with the session inside it. Neither read needs a worktree.

### Why two tests

The directory test earns its place beside the branch test. Two branches differing only in type are distinct refs that collapse onto one slug, so `feat/foo` and `fix/foo` reach one `.claude/worktrees/foo/` and only the directory read sees it. `claude/skills/git-branch/references/slug.md` records that collision as the cost of dropping the type.

The branch test reads both ref spaces through `git for-each-ref`, matching `checkClaim` in `src/sessions/claim.ts`, so a name this skill clears and a branch a dispatcher cleared answer the same question.

- `git show-ref --verify` sees no remote-tracking ref, so a branch pushed from elsewhere would pass that narrower test and collide at its first push

### Why the tier exists

Every other `session-worktree` tier answers from state the caller cannot set. Naming the branch in the launch prompt closes none of that, since no tier reads the prompt.

- A worker launched onto `main` misses the branch tier
- A board carrying more than one plan puts the single-plan tier out of reach
- The multiple-plan tier then tells the worker to ask a person who is not there

### A task path or nothing

A caller supplying a task path, or nothing at all, has no plan to hand the verb, since resolving either is Step 1's work. Step 0 invokes `session-worktree` bare in both cases. A dispatched worker reaching the chain through a task path therefore derives its name from a tier rather than from the plan the dispatcher checked.

### The other end of the entry

`git-followup` sits at the other end of the same entry. Its guard reads an open pull request rather than a tracking ref, since a worktree branch can carry an open pull request without one. The push leg sets the ref with `git push -u origin HEAD` when none resolves.

Refusing a branch with no pull request stays, since that is the split from `git-ship` rather than an accident of where the branch came from.

### A path is not a document kind

A path resolving to a file says nothing about which document it names, and a task file resolves exactly as a plan does. A path under `.canon/tasks/` reaches a tier of its own, which reads the task's first `Plan:` line and takes what it names, so a caller holding the board's own pointer does not meet a refusal.

### Three refusals, three repairs

The task tier refuses three ways, and each message names a different repair since one message covering all three sends the caller to the wrong file.

- A path under `.canon/tasks/` resolving to nothing is a typo
- A task carrying no `Plan:` line is a row nobody has planned yet
- A pointer resolving to nothing is a stale citation the board should have caught

A bare slug stays a plan's under every tier, because a task slug and a plan slug collide on any similar name and a caller naming a task already holds its path.

### The archive refusal

The archive refusal tests the resolved path rather than the task's outcomes, since a stale board gets its ticks wrong. `claude/skills/task-board/references/tasks.md` fixes where a shipped pointer lands, which is the plans archive.

An archived plan carries `**Files to touch:**` unchanged, so without the refusal the tier would re-implement merged work. It covers the two older archive spellings an unmigrated project still holds beside `.canon/plans/archive/`.

## Gotchas

### How the repair is tested

The rule was a bash function in a shared library until it was ported, kept there so a test could source it. A hook could not import it from TypeScript, so a script and a library sat between the gate and one predicate. The test builds six repository shapes, and the `basename` guard is what it pins.

- Deleting the guard line leaves the other cases passing and fails only the genuinely-bare one, the case where an unguarded repair does damage
- Every git call goes through `gitEnv()` with `extendEnv: false`, and the test strips every inherited `GIT_*` variable before building fixtures
- Git hooks export `GIT_DIR`, so without the scrub the suite passes standalone and fails under `pre-push`, since `git -C real-bare.git` resolves against the toolkit's own repository

Any future test that shells out to git needs the same scrub, and the failure is invisible to a normal `bun run test`. See `wiki/claude/worktrees.md` for the upstream issue.
