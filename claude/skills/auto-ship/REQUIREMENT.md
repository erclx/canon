---
name: auto-ship
description: What the post-plan pipeline is for, the gaps it closes, and why every stop leaves the work recoverable
---

# Auto ship requirement

## Gap

Without this skill, the run from an approved plan to an open pull request is a conversation. A session implements, then asks what comes next, and the answer varies by session. A run that halts leaves no stated resume point, so the user reconstructs how far it got from the working tree.

A pull request opened ready stays mergeable through its CI run, and a draft mark typed against the wrong number holds someone else's release. Parallel batches sharing edge files conflict on each merge. A worker improvising the review wait polls issue comments and stalls with both reviewers idle.

## Must

- The approved plan is the scope, built in tested slices through `build-in-slices`, and every step stops with the code on the branch and the recovery for that stop named
- The ship sequence is delegated to `git-ship`, and the pull request is marked a draft before the CI watch, after proving its head is this branch and its state is open
- A test-order finding between verify and ship is reported without gating, and a produced UI checklist is reported in the closing block without stopping
- A fan-in member stops after verify with a push and a done message, and an integrator opens its build by merging the member branches
- On a launch naming a controller, both review families are awaited through `canon pr review-state --wait`, and a timeout hands the record to the controller

## Must not

- Expand past the plan, refactor a neighbor, or touch a file outside it without reason
- Loop on a failed verify or auto-fix a failing check, since a green pull request reached that way hides what broke
- Restate the ship sequence, or skip `git-ship`'s own verify for repeating this chain's
- Stop the chain or rewrite a commit over a test-order finding
- Run on a detached HEAD, a missing plan, or uncommitted changes unrelated to the plan

## Out of scope

- Writing the plan, which `plan-feature` owns
- The behavior of each step, which the skill that step invokes owns
- The ship sequence and the resume path after its stops, which `git-ship` owns
