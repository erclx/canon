---
name: auto-ship
description: What the post-plan pipeline is for, the gaps it closes, and why every stop leaves the work recoverable
---

# Auto ship requirement

## Gap

Without this skill, the run from an approved plan to an open pull request is a conversation. A session implements, then asks what comes next, and the answer varies by session. A run that halts leaves no stated resume point, so the user reconstructs how far it got from the working tree.

Review is the step that varies most. It gets skipped on a diff that needed one, or spent on prose already gated by a hook. A file-extension test cannot separate the two, since a skill body and a documentation page are both markdown, so a branch changing what an agent does takes the skip a documentation branch earned.

## Must

- Take the approved plan for the branch as the scope, and implement only what it describes
- Give every step a stop condition, and leave the code on the branch and the receipts on disk at each one
- Classify the changed-file list by path as well as by extension, so informational prose skips a code review with no signal on it and executable prose still reaches one
- Check the branch's committed history for a test-order violation between verify and review, and report any finding without gating on it, matching the verb's own contract
- Split findings by origin, stopping on a critical or should-fix one the branch inherited and repairing one this run caused
- Own the review receipt's lifetime, since this chain writes it, cites it in its own closing block, and is the only body that can read whether the step keeping it is still using it
- Delegate the ship sequence to `git-ship` rather than restating it, and name only what this chain adds to it
- Open the pull request as a draft before the continuous integration watch begins, since a pull request marked after it is mergeable for the length of the run
- Prove the draft target's head is the current branch and its state is open before marking it, and stop with nothing marked on a mismatch, since the number is retyped between steps and a draft mark on a release pull request holds that release
- Name the recovery for the stop it took, since the value of stopping is that the user knows where to resume

## Must not

- Expand past the plan, refactor a neighbor, or touch a file outside it without reason
- Loop on a failed verify. One fix attempt against the reported errors, then stop.
- Fix an inherited review finding or a failing check. Both stops are deliberate, since a green pull request reached by auto-fix hides what broke.
- Loop on a self-introduced finding. One repair pass, then stop, which is the bound a failed verify already carries.
- Read the plan's file list as the boundary on a repair. It scopes what the run builds, and a finding this run caused is in reach wherever it landed.
- Restate the ship sequence. Two copies of one order drift with nothing comparing them, which is what the merge into `git-ship` closed.
- Skip that skill's own verify for repeating this chain's. The gate exists for the resumed run, and a chain that suppresses it leaves the resumed run reaching nothing.
- Run the memory Apply phase. Promoting an entry changes how the agent operates and ships as its own change.
- Read an empty changed-file list as prose-only. It satisfies that test vacuously and would route the branch past review instead of through it.
- Read a markdown extension as evidence the change only informs. A skill body, a governance rule, and a standard are behavior written in prose.
- Stop the chain or rewrite a commit over a test-order finding. The verb reports and never gates, and a commit already in history is a different act from the work this run is building.

## Guards

- Detached HEAD: stop, no slug resolves
- No approved plan at the branch-derived plan path: stop, name the branch the slug came from, and say the invocation carried no argument, so a plan or a task path may be passed
- Uncommitted changes unrelated to the plan: stop
- No diff baseline against main: stop
- Empty changed-file list: stop, and never advise removing the output from `.gitignore` to get past it

## Out of scope

- Writing the plan, which `plan-feature` owns. This chain starts from one already approved.
- The behavior of each step, owned by the skill invoked. This skill owns the order and the stop conditions.
- The ship sequence and the resume path after a stop, both of which `git-ship` owns. That skill is the tail of this chain, invoked at Step 8 rather than copied into it, so the overlap is one body reached two ways rather than two bodies stating one order.
