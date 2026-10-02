---
name: git-ship
description: What the ship chain is for, the gaps it closes, and why it does not implement or review
---

# Git ship requirement

## Gap

Without this skill, the post-feature sequence runs from memory. Doc sync gets skipped, so the pull request ships with planning docs describing the previous scope, or it runs after staging has already closed and its output never reaches a commit. Chaining by hand is also where a session narrates between steps, which turns one flow into a conversation and invites a decision at every boundary.

The sequence also reaches the remote on work nothing re-checked. This skill is the resume point `auto-ship` names at three of its stop points, including the one a failed verify takes, so the fix the user makes by hand after that stop is pushed with no suite run against it. Every branch shipped so far passed that verify on its first attempt, which is why the path has produced no instance rather than being closed.

## Must

- Run the project's verify commands before the sequence starts, and stop on a failure rather than fixing it
- Say so and continue when the project names no verify command, since silence there reads as a suite that passed
- Invoke each step through the Skill tool in the stated order and continue without waiting
- Stage after the sync skills write, so what they produced reaches a commit
- Reach the pull request on a branch whose work is already committed and whose sync steps wrote nothing, since `git-stage` stops on an empty index and a session building in slices leaves one
- Emit no text between steps. The sequence is the unit and prose inside it reopens settled decisions.
- Name the one point a wrapping caller may act at, so a chain built on this one is not left to pick a gap of its own
- Name the condition under which the closing block is not emitted, since a caller that closes on its own block leaves two instructions about the last line and nothing deciding between them
- Watch continuous integration to a terminal state in the background, so the session stays reachable while CI runs, and stop on a failure naming the check
- Read the evidence thread with `canon pr evidence <number> --check --json` once CI passes, run what it reports owed, and report done only on `settled`, since a chain that never reads the thread ships a regenerated image with no comment and no preview and leaves the controller to repair it
- Stop memory work at the Propose phase

## Must not

- Auto-trigger. Shipping is a decision the user takes, and the tool permission dialog on the push and the pull request is the gate that holds it now that the frontmatter no longer disables model invocation.
- Fix a failing check. The stop is the point, since a green pull request reached by auto-fix hides what broke.
- Run the memory Apply phase. Promoting an entry changes how the agent operates and ships as its own change.
- Attempt a fix for a failing verify. The user is already making one, which is what brought the run back here.
- Implement or review. This chain starts from work already believed done.
- Report the chain done before the CI watch exits. A turn ending on the watch line leaves a pull request still waiting on CI, and a `✅ Shipped` there claims a result nothing has read.

## Guards

- A failing verify stops the run before the sync skills write, so the tree is left as the user left it
- A binary lacking `--check` reports the thread unread, never settled, since reading the absence as a pass repeats the failure the read exists to close
- Re-read the thread once after running what was owed and stop on anything but `settled`, so a refused preview cannot loop the chain
- A failing check stops the sequence. A stop report and the line announcing the background watch are the two places text is allowed between steps.

## Out of scope

- Implementation and review, which `auto-ship` chains ahead of this same sequence. That skill is the full pipeline and this one is the resume point after a stop, which is why the two overlap by design. Verification is the one of the three that belongs on both, since a resume point that trusts the caller's verify trusts a run that stopped.
- The behavior of each step, owned by the skill invoked. This skill owns the order and nothing else.
