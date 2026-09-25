---
title: Worktree entry
description: The core.bare repair carried at two points, the dependency check's literal presence test, the branch worktree entry hands the ship chain, which document the chain resolved, and how a run starting on main names its worktree
---

# Worktree entry

## Repairing `core.bare`

`session-worktree` repairs `core.bare` at two points rather than one. Claude Code's entry tool writes the flag into the parent repository's shared config and its exit tool never restores it, which leaves every later command in the main worktree failing for want of a work tree while the files sit untouched on disk. The linked worktree keeps working, so the session that caused the damage is the one least likely to see it.

Repairing only after entry would still admit a repository broken by an earlier session, so the skill reads the flag in Step 1 beside the main-root resolution and repairs before entering, then repeats the repair in Step 5. Both writes are guarded on the flag actually being set, since the entry tool does not set it every time and an unconditional repair would rewrite the config on runs where nothing broke.

`scripts/core/repair-bare-flag.sh` carries the same repair as a second line of defense, sourced from `scripts/lib/worktree.sh` and run by `canon gate run` ahead of every stage because the flag breaks the git reads that scope the run. Nothing forces worktree entry through the skill, and one occurrence hit an operator whose session never entered a worktree at all. A git hook cannot serve here, because the corrupted command aborts before any hook runs.

Both call sites confirm the repository's common dir is named `.git` before writing, which separates the defect from a genuinely bare repository that keeps its objects at the root and would be broken by the repair. The skill states the upstream issue inline rather than pointing at `wiki/claude/claude-worktrees.md`, since a shipped skill runs where no `wiki/` path resolves and `check-skill-paths.sh` fails the build on one.

## The dependency check is a literal test

`session-worktree` Step 6 carries the test itself: Node and python each read against a literal `[ -f ... ]` / `[ -d ... ]` pair, and the closing "no manifest" line takes its own direct test, run ahead of both rather than reached by falling through them unmatched. `<install>` resolves off a fixed four-row lockfile table, `bun.lock` or `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, then `package-lock.json`, checked in that order and falling back to `bun install` when none match.

It is a literal shell test rather than a `canon` verb, since directory presence is not a judgment call and the body ships to a target that may hold no `canon` binary on PATH at all.

## The branch entry hands the ship chain

`session-worktree` renames the entered branch to `<type>/<name>` rather than to the bare `<name>`. Two consumers pull in opposite directions on that string. Slug derivation wants the plan's own slug, since `auto-ship` keys its worktree, review receipt, and pull request on the branch, and `git-pr` guards on `<type>/<description>` and refuses anything without a type.

A bare name satisfies the first and fails the second mid-chain, with the work already done and uncommitted. `standards/slug.md` drops a leading type segment before it replaces slashes, so one branch answers both and no consumer has to learn a second spelling.

Entering from a branch that is already conventional stops on the collision. The name derives back onto the branch the session came from, git refuses a second branch under it, and the type default cannot invent a distinct one.

Both collision tests sit in Step 2, ahead of the entry call, because the typed name turns a rare stop into a common one and a stop after entry leaves a worktree built with the session inside it. Neither read needs a worktree. The directory test earns its place beside the branch test rather than duplicating it: two branches differing only in type are distinct refs that collapse onto one slug, so `feat/foo` and `fix/foo` reach one `.claude/worktrees/foo/` and only the directory read sees it. That is the collision `standards/slug.md` records as the cost of dropping the type.

The branch test reads both ref spaces through `git for-each-ref`, matching `checkClaim` in `src/sessions/claim.ts`, so a name this skill clears and a branch a dispatcher cleared answer the same question. `git show-ref --verify` sees no remote-tracking ref, so a branch pushed from elsewhere would pass that narrower test and collide at its first push.

## A run starting on `main`

`auto-ship` Step 0 enters the worktree ahead of Step 1, so it holds the raw invocation argument rather than a resolved plan. When that argument is a plan path or a bare slug, it runs `canon tasks plan-branch` on it and hands the returned `<type>/<slug>` to `session-worktree` as its tier 0 argument. `orchestrator-dispatch.md` runs the same verb on the same plan to pick the branch its collision check clears, so the checked branch and the taken branch are one string. A plan named outside `feature-<slug>.md`, such as a phased row backing several branches from one file, still needs its own file per branch, since naming the plan is not the same as letting one plan answer for more than one.

The caller-supplied tier exists because every other `session-worktree` tier answers from state the caller cannot set. A worker launched onto `main` misses the branch tier, a board carrying more than one plan puts the single-plan tier out of reach, and the multiple-plan tier then instructs it to ask a person who is not there. Naming the branch in the launch prompt closes none of that, since no tier reads the prompt. A type spelled by the caller also wins over the one the verb returns.

A caller supplying a task path, or nothing at all, has no plan to hand the verb, since resolving either is Step 1's work. Step 0 invokes `session-worktree` bare in both cases, which leaves a dispatched worker reaching the chain through a task path deriving its name from a tier rather than from the plan the dispatcher checked.

`git-followup` sits at the other end of the same entry. Its guard reads an open pull request rather than a tracking ref, since a worktree branch can carry an open pull request without one, and the push leg sets the ref with `git push -u origin HEAD` when none resolves. Refusing a branch with no pull request stays, since that is the split from `git-ship` rather than an accident of where the branch came from.

## Which document Step 1 resolved

A path resolving to a file says nothing about which document it names, and a task file resolves exactly as a plan does since both are markdown sitting at a path that exists. A path under `.canon/tasks/` reaches a tier of its own, which reads the task's first `Plan:` line and takes what it names, so a caller holding the board's own pointer does not meet a refusal.

Everything else meets the shape test, which checks the resolved file for the `**Files to touch:**` marker `standards/plan.md` requires structurally, or the `## Files to touch` heading form the same standard admits, since a task never carries either. That test runs after all three tiers rather than guarding the supplied one alone, because a branch slug matching an unrelated plan is the same wrong-file risk under the derived tier and a task's own pointer can name a non-plan under the first.

The task tier refuses three ways and each names a different repair, since one message covering all three sends the caller to the wrong file. A path under `.canon/tasks/` resolving to nothing is a typo, a task carrying no `Plan:` line is a row nobody has planned yet, and a pointer resolving to nothing is a stale citation the board should have caught. A bare slug stays a plan's under every tier, because a task slug and a plan slug collide on any similar name and a caller naming a task holds its path already.

The archive refusal tests the resolved path rather than the task's outcomes, since a stale board gets its ticks wrong while `standards/tasks.md` fixes where a shipped pointer lands: it points a shipped task's `Plan:` line into the plans archive, and an archived plan carries `**Files to touch:**` unchanged, so the tier would otherwise re-implement merged work. It covers the two older archive spellings an unmigrated project still holds beside `.canon/plans/archive/`.

What the pointer resolves against decides whether that refusal reaches anything. An archived task sits a folder deeper and the standard points its line at `../../plans/archive/feature-<slug>.md`, so a base fixed at `.canon/tasks/` lands on a repository-root `plans/archive/` that never exists, and the run would answer a correct citation with the stale-citation message. Resolving against the directory holding the task file instead of a fixed base closes that, and taking a bare path beside a link target reaches the older tasks writing the target as a plain project-root path.
