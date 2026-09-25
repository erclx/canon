---
name: review-craft
description: Carries what a code review looks for and how much evidence a finding needs, from design and scope through breakage outside the diff, developer experience, executable prose, stale docs, security classes, and rendered output checked against the screenshots a pull request carries. Use when reviewing a change, when a review procedure loads it for its axes, or when asked "what should a review look for", "what does a good review check", "how sure do I need to be before flagging this", or "did the review look at the screenshots". Do NOT use to run a review, post it, or grade its findings, which is `review-branch` for local work and `review-pr` for a pull request, and do NOT use for a deliberate full security audit, which is the built-in `security-review`.
---

# Review craft

A review with no stated axes reads the changed lines for bugs and stops there. What breaks in a consumer the diff never opened, a doc the change made false a section away from its hunk, or a screenshot showing the opposite of what a ticked box claims all go unread. This skill carries the judgment: what to look for, in what order, and how sure to be before calling it a finding.

The procedure that loaded this skill owns everything else: which files to read, the filter that decides what gets reported, the severity ladder, and where the report goes. Nothing here grades a finding or posts one.

## Open with the one fact the change's safety rests on

Name the single claim that, if false, makes this change unsafe to merge, then say how far the change proves it. Read the proof on this ladder, weakest first:

- **Asserted.** The description or a comment says so.
- **Pointed at.** It names the code or the test that would show it.
- **Walked through.** The reasoning traces the path and holds.
- **Tested.** A test in the diff fails if the claim is false.
- **Reproduced.** Someone ran it and recorded what happened.

A risky claim resting on assertion alone is where the review spends its reading. A trivial one needs no more than asserted.

## Read the axes in this order

An axis whose condition the diff meets is not optional. When axis 5 or 6 names a reference and its condition holds, read that reference before moving to the next axis, however clear the diff looks without it.

1. **Design and scope.** Does the change do one thing, is it more complex than the problem needs, and does it build what nobody asked for? State a design finding as a concrete cost, such as a second path nobody calls, a layer with one caller, or a flag no caller passes, never as a preference.
2. **Correctness and edge cases.** The empty input, the boundary value, the refused call, the second run, the concurrent run, and the error path a caller actually meets.
3. **What breaks outside the diff.** List every consumer of a changed contract, whether a function signature, a file format, a flag, an output shape, or a heading another tool matches, and check the change against each one. Then list each behavior the diff removes or changes, such as a guard, a refusal, a default, or an output, and search every doc the diff touches, in full rather than at the hunk, for a sentence still promising the old behavior. File that sentence as a finding against the doc, quoting it and naming its section, since the doc is what goes wrong for the next reader.
4. **Tests.** Hand each test the change adds or edits to `canon:test-craft` and its final filter. Report it rather than proceeding silently when that skill does not resolve.
5. **Security.** Read `${CLAUDE_SKILL_DIR}/references/security.md` when the diff runs a command, writes a file, handles input from outside the process, touches a secret, adds a dependency, or changes a default a consumer installs.
6. **Rendered output.** Read `${CLAUDE_SKILL_DIR}/references/ui.md` when the diff touches a file that paints, such as markup, a stylesheet, a component, a template, or a design token, or when the pull request carries an evidence comment. A finding read off a stylesheet diff says what the author changed, and only the screenshot says what a user sees, so the reference opens the images and checks whether any exist.
7. **Developer experience and operations.** Ports, hooks, scripts, config, and scaffold defaults a consumer installs. A new required step nobody documented, a default that fails on a clean machine, or a hook that slows every commit is a finding even when the code is correct.
8. **Executable prose.** A skill body, a rule, or a prompt is instructions a model runs. Read it the way you read code: a step that races another, a precondition it never states, a branch with no exit, and two instructions that contradict each other are bugs.

## Hold every finding to the evidence bar

- Confirm each finding against the file at the reviewed head before grading it. A finding read off the diff alone misses the guard three lines outside the hunk.
- Quote the rule when a finding cites one, with its file, so the author can check the claim without finding the rule first.
- Name the input or the state that breaks, not only the line. A finding with no failing case is a suspicion.
- Drop what a linter, a type checker, or a gate in the project already owns. The gate reports it with more certainty than a review can.
- Drop a finding resting on state you did not read. Say what you would need to read instead.

## What this delegates

- Which files a pass reads, the high-signal filter, the severity ladder, and where findings go: `review-branch` for local work and `review-pr` for a pull request
- Which layer a test belongs at and what makes it good: `test-craft`
- Writing what a reviewer should look at on a rendered change: `ui-checklist`
- A deliberate full security audit of a codebase: the built-in `security-review`
