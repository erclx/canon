---
name: review-craft
description: Why every review needs one stated set of axes and an evidence bar, and where that judgment stops short of the procedures that run a review
---

# Review craft requirement

## Gap

Without this skill, what a review looks for is a few words copied between two procedure bodies, being bugs, edge cases, and security. Nothing states design and scope, what breaks outside the diff, a doc the change made stale, or how much evidence a finding needs. A review finds a removed guard and calls the README promising it clean.

Rendered output is the larger hole. No step opens a screenshot, so a review files a finding off the stylesheet diff while the navigation runs off the edge. A change passing by lowering its bar, such as a skipped test or a moved threshold, reads as clean. A refactor that only moved complexity reads as a design gain.

## Must

- The axes are stated in reading order, from design and scope through correctness, what breaks outside the diff, tests, a lowered bar, performance, and security to rendered output and executable prose
- Design review is an ordered, stack-neutral procedure, and a design finding names a concrete cost
- A finding is confirmed against the file at the reviewed head, quotes the rule it cites, names the breaking input, and is dropped when a gate owns it
- Security is carried as classes with an exclusion list in a reference, opening with a threat model drawn from the diff
- Evidence images are opened through `git show` at the row's own sha, each ticked box is tested against an image, and a rendered change with no screenshot is flagged

## Must not

- State a severity or a posting rule, or restate the high-signal filter either procedure carries
- Name a repository-specific capture layout, width list, or folder
- Run `canon pr evidence` to read the evidence, since it renders a body that can differ from the posted comment
- Carry a per-surface reference beyond security and rendered output before a measured miss asks for one

## Out of scope

- Running a review, reading the diff, and posting and grading findings, which `review-pr` owns
- Which layer a test belongs at, which `test-craft` owns
- Capturing screenshots or writing the visual checklist, which `canon pr evidence` and `ui-checklist` own
- A deliberate full security audit, which the built-in `security-review` owns
