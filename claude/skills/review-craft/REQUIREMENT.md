---
name: review-craft
description: Why every review needs one stated set of axes and an evidence bar, and where that judgment stops short of the procedures that run a review
---

# Review craft requirement

## Gap

Without this skill, what a review looks for is seven words copied between two procedure bodies: bugs, edge cases, error handling, logic flaws, security. Nothing states design and scope, what breaks in a consumer outside the diff, developer experience, executable prose, a doc the change made stale, which security classes to check, or how much evidence a finding needs before it is reported.

The miss is measured. On a seeded branch that deleted a dirty-tree guard while the README two headings below the edited hunk still promised it, two runs of the local review found the removed guard and called the README clean. Security was not the gap: both runs caught the planted injection and the unpinned package under the one-word axis.

Rendered output is the larger hole. `git-pr` posts an `## Evidence` comment through `canon pr evidence`, carrying base and head screenshots and a checklist a reviewer ticks. The pull request review named that heading only in its heading set, and no step opened an image. On a seeded pull request whose narrow head screenshot shows the navigation running off the edge while a ticked box claims it collapses, the review filed the finding off the stylesheet diff and said it had not rendered the page. On a styling change with no screenshot at all, on a project whose trunk keeps them, it did not mention the absence.

A dependency upgrade is not a measured miss. On 2026-10-02 a seeded branch bumped one dependency across a major version beside a second, with a lockfile adding a transitive package that carried an install script, and the body without a dependency reference reported it. The run that measured it passed every assertion, including a graded finding naming the upgrade, so the case is a floor and no reference exists for it. An earlier run matched only a loose pattern and left no report to read, so it counts for nothing. The security reference still had no threat-model step and no class for a delete or clean on a derived path, both groundwork lifts with no miss to measure.

The axes also said nothing about a change that passes by lowering the bar it has to clear, such as a test skipped, a threshold moved, or a path excluded from a checker, nothing about performance, and one sentence about design with no procedure behind it. A refactor that only moved complexity read as a design gain, and a removal could call code dead without reading why it was added. The body carried no excuses, red flags, or closing checklist, so a session about to stop at the hunk met no answer first.

## Must

- Open with the one fact the change's safety rests on, read on a ladder of asserted, pointed at, walked through, tested, and reproduced
- State the axes in reading order: design and scope, correctness and edge cases, what breaks outside the diff, tests, guard the bar, performance, security, rendered output, developer experience and operations, and executable prose
- Carry the design review as an ordered procedure in the body, stack-neutral, plus the scope checks for a change carrying two concerns, complexity moved rather than reduced, and a removal that has not read why the code existed
- Name a lowered bar as a finding unless the diff states why, and accept a suppression whose stated reason holds
- Ask a claimed speedup for repeated measurements on both sides, and read a result inside the noise as an argument to revert
- Close with the practice skill's excuses, red flags, and closing checklist, and record every external source in `references/adopted.md`
- Require every consumer of a changed contract to be listed and checked, and every doc the diff touches to be read whole for a claim the change made false
- State a design finding as a concrete cost, so it survives the procedure's filter against subjective suggestions
- Carry the evidence bar: confirm against the file at the reviewed head, quote a cited rule, name the breaking input, and drop what a gate owns or what rests on unread state
- Carry security as classes with an exclusion list, in a reference loaded when the diff reaches one
- Open the security reference with a threat model drawn from the diff, and carry destructive operations on a derived path as a class, so a cleanup deleting an unchecked variable's glob is read for the empty-value collapse
- Open the evidence images on a rendered change through `git show` at the row's own sha, never through the embedded address, within a stated read budget
- Test each ticked checklist box against an opened image, and name a ticked box no image covers as untested
- Flag a rendered change that carries no screenshot, as a finding where the trunk already keeps them and as a question elsewhere
- Read the posted comment rather than running `canon pr evidence`, which renders a new body from the pull request's files and can differ from the comment already posted

## Must not

- State a severity or a posting rule. `review-pr` owns the ladder.
- Restate the high-signal filter either procedure carries
- Name a repository-specific capture layout, width list, or folder. The evidence marker and `canon/wireframes/` are target contracts, and everything else is the project's.
- Carry a per-surface reference beyond security and rendered output before a measured miss asks for one

## Out of scope

- Running a review, reading the diff, posting findings, and grading them: `review-pr`
- The high-signal filter and the severity ladder, which stay in each procedure body
- Which layer a test belongs at: `test-craft`
- Capturing screenshots or writing the visual checklist: `canon pr evidence` and `ui-checklist`
- A dispatched reviewer session that loads this skill, which a later trial decides
- A deliberate full security audit: the built-in `security-review`
