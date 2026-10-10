---
name: auto-ship
description: What the post-plan pipeline is for, the gaps it closes, and why every stop leaves the work recoverable
---

# Auto ship requirement

## Gap

Without this skill, the run from an approved plan to an open pull request is a conversation. A session implements, then asks what comes next, and the answer varies by session. A run that halts leaves no stated resume point, so the user reconstructs how far it got from the working tree.

## Must

- Take the approved plan for the branch as the scope, and implement only what it describes
- Load `build-in-slices` before implementing, so the build reaches history as tested slices rather than one uncommitted pass
- Give every step a stop condition, and leave the code on the branch and the receipts on disk at each one
- Check the branch's committed history for a test-order violation between verify and ship, and report any finding without gating on it, matching the verb's own contract
- Delegate the ship sequence to `git-ship` rather than restating it, and name only what this chain adds to it
- Open the pull request as a draft before the continuous integration watch begins, since a pull request marked after it is mergeable for the length of the run
- Continue past a produced UI checklist rather than stopping on it, and report its unchecked boxes in the closing block, since the draft mark already holds the merge
- Prove the draft target's head is the current branch and its state is open before marking it, and stop with nothing marked on a mismatch, since the number is retyped between steps and a draft mark on a release pull request holds that release
- Name the recovery for the stop it took, since the value of stopping is that the user knows where to resume

## Must not

- Expand past the plan, refactor a neighbor, or touch a file outside it without reason
- Loop on a failed verify. One fix attempt against the reported errors, then stop.
- Fix a failing check. The stop is deliberate, since a green pull request reached by auto-fix hides what broke.
- Restate the ship sequence. Two copies of one order drift with nothing comparing them, which is what the merge into `git-ship` closed.
- Skip that skill's own verify for repeating this chain's. The gate exists for the resumed run, and a chain that suppresses it leaves the resumed run reaching nothing.
- Run the memory Apply phase. Promoting an entry changes how the agent operates and ships as its own change.
- Stop the chain or rewrite a commit over a test-order finding. The verb reports and never gates, and a commit already in history is a different act from the work this run is building.

## Guards

- Detached HEAD: stop, no slug resolves
- No approved plan at the branch-derived plan path: stop, name the branch the slug came from, and say the invocation carried no argument, so a plan or a task path may be passed
- Uncommitted changes unrelated to the plan: stop

## Out of scope

- Writing the plan, which `plan-feature` owns. This chain starts from one already approved.
- The behavior of each step, owned by the skill invoked. This skill owns the order and the stop conditions.
- The ship sequence and the resume path after a stop, both of which `git-ship` owns. That skill is the tail of this chain, invoked at Step 6 rather than copied into it, so the overlap is one body reached two ways rather than two bodies stating one order.
