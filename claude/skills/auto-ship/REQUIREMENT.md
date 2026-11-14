---
name: auto-ship
description: What the post-plan pipeline is for, the gaps it closes, and why every stop leaves the work recoverable
---

# Auto ship requirement

## Gap

Without this skill, the run from an approved plan to an open pull request is a conversation, and what comes next varies by session. A run that halts leaves no stated resume point, so the user reconstructs how far it got from the working tree. A small row costs two sessions reading the same files, since the chain stops without a plan file.

A pull request opened ready stays mergeable through its CI run, and a draft mark typed against the wrong number holds someone else's release. Parallel batches sharing edge files conflict on each merge. A worker improvising the review wait polls issue comments and stalls with both reviewers idle.

## Must

- The plan is the scope, written and linked before any tracked edit under `--plan-first`, built through `build-in-slices`, and every stop leaves the code on the branch and names its recovery
- `git-ship` runs the ship sequence, the pull request opens as a draft, and a fallback mark before the CI watch repairs a ready one after proving its head is this branch and its state is open
- A test-order finding between verify and ship is reported without gating, and a produced UI checklist is reported in the closing block without stopping
- A fan-in member stops after verify with a push and a done message, and an integrator opens its build by merging the member branches
- On a launch naming a controller, both review families are awaited through `canon pr review-state --wait`, and a timeout hands the record to the controller

## Must not

- Expand past the plan, refactor a neighbor, or touch a file outside it without reason
- Loop on a failed verify, retry or idle on a hung one, or auto-fix a failing check, since a green pull request reached that way hides what broke and a hang is the controller's to narrow
- Restate the ship sequence, or skip `git-ship`'s own verify for repeating this chain's
- Stop the chain or rewrite a commit over a test-order finding
- Run on a detached HEAD, unrelated uncommitted changes, a missing plan without `--plan-first`, or a plan-first plan past the Small test without `--any-size`

## Out of scope

- Writing the plan, which `plan-feature` owns
- The behavior of each step, which the skill that step invokes owns
- The ship sequence and the resume path after its stops, which `git-ship` owns
