---
name: review-craft
description: Carries what a code review looks for and how much evidence a finding needs, from design and scope through breakage outside the diff, a test or check the change weakens to pass, performance, developer experience, executable prose, stale docs, security classes, and rendered output checked against the screenshots a pull request carries. Use when reviewing a change, when a review procedure loads it for its axes, or when asked "what should a review look for", "what does a good review check", "how sure do I need to be before flagging this", or "did the review look at the screenshots". Do NOT use to run a review, post it, or grade its findings, which is `review-branch` for local work and `review-pr` for a pull request, and do NOT use for a deliberate full security audit, which is the built-in `security-review`.
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

An axis whose condition the diff meets is not optional. When the security or the rendered output axis names a reference and its condition holds, read that reference before moving to the next axis, however clear the diff looks without it.

1. **Design and scope.** Does the change do one thing, is it more complex than the problem needs, and does it build what nobody asked for? State a design finding as a concrete cost, such as a second path nobody calls, a layer with one caller, or a flag no caller passes, never as a preference. Walk it in the order `Walk the design` below gives.
2. **Correctness and edge cases.** The empty input, the boundary value, the refused call, the second run, the concurrent run, and the error path a caller actually meets.
3. **What breaks outside the diff.** List every consumer of a changed contract, whether a function signature, a file format, a flag, an output shape, or a heading another tool matches, and check the change against each one. Then list each behavior the diff removes or changes, such as a guard, a refusal, a default, or an output, and search every doc the diff touches, in full rather than at the hunk, for a sentence still promising the old behavior. File that sentence as a finding against the doc, quoting it and naming its section, since the doc is what goes wrong for the next reader.
4. **Tests.** Hand each test the change adds or edits to `canon:test-craft` and its final filter. Report it rather than proceeding silently when that skill does not resolve.
5. **Guard the bar.** A change can pass by lowering its own bar: a threshold moved, a test skipped, deleted, or emptied of assertions, an inline suppression, a path dropped from a lint or type run, a stub that throws or an empty catch where behavior was promised, or a new config exception. Each is a finding unless the diff says why, and a suppression whose stated reason holds is the author's call.
6. **Performance.** A query or a remote call inside a loop, a read with no bound on its size, and a list endpoint with no pagination. A claimed speedup needs a before and an after measured the same way and repeated past run-to-run noise. One run on each side is an anecdote, and a result inside the noise argues for reverting the added complexity.

### Axes a condition opens

Read each of these when the diff reaches what it names.

7. **Security.** Read `${CLAUDE_SKILL_DIR}/references/security.md` when the diff runs a command, writes a file, handles input from outside the process, touches a secret, adds a dependency, or changes a default a consumer installs.
8. **Rendered output.** Read `${CLAUDE_SKILL_DIR}/references/ui.md` when the diff touches a file that paints, such as markup, a stylesheet, a component, a template, or a design token, or when the pull request carries an evidence comment. A finding read off a stylesheet diff says what the author changed, and only the screenshot says what a user sees, so the reference opens the images and checks whether any exist.
9. **Developer experience and operations.** Ports, hooks, scripts, config, and scaffold defaults a consumer installs. A new required step nobody documented, a default that fails on a clean machine, or a hook that slows every commit is a finding even when the code is correct.
10. **Executable prose.** A skill body, a rule, or a prompt is instructions a model runs. Read it the way you read code: a step that races another, a precondition it never states, a branch with no exit, and two instructions that contradict each other are bugs.

### Walk the design

Walk the design axis in this order, and skip a step the change gives nothing to read:

1. Name the next change this code is likely to need, and count the files and units it would touch. A count that grows with each new case is the cost to report.
2. State what each new unit hides from its callers. A unit that passes its arguments straight through to another hides nothing and is a layer with no work.
3. Find each rule or constant the change states, and check that it lives in one place. The same rule in two places drifts the first time one copy changes.
4. Look for a parameter that switches what a function does, a chain of calls reaching through one object into another, and a read or write of global state. Each ties a caller to internals it should not know.
5. Ask each changed file for its one reason to change. A file that two unrelated requests would both edit carries two concerns.
6. List what the code reads without being handed it, such as the clock, the environment, the filesystem, or a random source. A hidden input is what makes the code hard to test and to reuse.
7. Match each pattern or abstraction the change introduces to a problem the code has today. One built for a case nobody has asked for is speculative.
8. Check that the rules of the domain sit apart from the code that moves data in and out, so a change of transport or storage leaves them untouched.
9. Read names, unexplained literal numbers, errors caught and dropped, and side effects a function's name does not declare.

Three scope checks follow the walk:

- When a change carries two concerns that could land as two changes, name the split. Size is no finding on its own, since one concern can run long.
- On a refactor, count the concepts a reader must hold before and after. Complexity moved into a new file or function is moved, not reduced, so report it as such rather than as a design gain.
- Before calling removed code dead, state why it existed. Read `git blame` and the commit that added it, since a guard nobody remembers is often still guarding something.

## Hold every finding to the evidence bar

- Confirm each finding against the file at the reviewed head before grading it. A finding read off the diff alone misses the guard three lines outside the hunk.
- Quote the rule when a finding cites one, with its file, so the author can check the claim without finding the rule first.
- Name the input or the state that breaks, not only the line. A finding with no failing case is a suspicion.
- Drop what a linter, a type checker, or a gate in the project already owns. The gate reports it with more certainty than a review can.
- Drop a finding resting on state you did not read. Say what you would need to read instead.

## Excuses and rebuttals

| Excuse                                                      | Rebuttal                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The tests pass, so the change works                         | Read what the diff did to the tests first. A test skipped, deleted, or stripped of its assertions passes by proving nothing.    |
| The hunk reads clean, so the review is done                 | The hunk is where the author looked. A consumer, a doc a section away, and the commit that added a removed guard are not in it. |
| The checker passes on the branch                            | Read the checker's config and the inline suppressions in the diff. A path excluded from the run passes by not being read.       |
| It was split into smaller functions, so it is simpler       | Count the concepts a reader holds before and after. Moved complexity reads as simpler only to the person who moved it.          |
| Nothing calls it, so deleting it is safe                    | Read why it was added. Code nobody calls today can still be guarding a path nobody exercised in the change.                     |
| The description says it is faster                           | A claimed speedup with no measurement, or one run each side, is asserted. Ask for runs that beat the noise.                     |
| The change only touches styles, so the screenshots can wait | A stylesheet diff says what changed and only the image says what a user sees. Open them, or say none exist.                     |

## Red flags

- You are about to call the change clean having read only the lines it changed.
- A threshold, an exclude list, or a skip marker changed and you have not found the sentence explaining it.
- You are approving a refactor because it has more, smaller pieces.
- You are calling code dead without having read the commit that added it.
- A performance claim rests on a number you cannot trace to a repeated measurement.
- An axis condition held and you moved past it without reading the reference it names.

## Before handing over

- Every axis whose condition the diff meets has a finding or a stated reason it found none.
- Every changed threshold, skip, suppression, and exclusion in the diff is either a finding or paired with the reason the diff gives.
- Every removal the review accepted names why the removed code existed.
- Every design finding states a concrete cost, and every refactor finding says whether complexity was reduced or moved.
- Every finding was confirmed against the file at the reviewed head and names the input or state that breaks.

## What this delegates

- Which files a pass reads, the high-signal filter, the severity ladder, and where findings go: `review-branch` for local work and `review-pr` for a pull request
- Which layer a test belongs at and what makes it good: `test-craft`
- Writing what a reviewer should look at on a rendered change: `ui-checklist`
- A deliberate full security audit of a codebase: the built-in `security-review`
