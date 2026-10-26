---
name: ui-checklist
description: Why the visual half of a UI change needs a written record a reviewer can open, why that record travels with the screenshots it annotates, and why writing the tests belongs elsewhere now
---

# UI checklist requirement

## Gap

Without this skill, UI work ships on the confidence of the session that wrote it. Nobody states which part of the change an eye has to judge, so a reviewer reads the automatable half and never looks at what only rendering shows. A checklist printed into chat scrolls away.

A file under a gitignored folder is unreadable to a pull request reviewer, and a checklist posted as its own comment sits apart from the screenshots it annotates. A later push then re-renders the screenshots and leaves the checklist describing an older head. Nobody names the behaviors shipping untested either, which is a list rather than a test.

## Must

- Every change is split into visual-only and automatable before anything is written, and a behavior the review's engine cannot read, such as a keyboard trap, gets a box of its own
- The checklist covers the visual-only half, each item an action and the result a person looks for, with its route, width, and a `(taste)` or `(local only)` marker where one applies
- Every automatable change shipping with no test is named, with the layer `test-craft` would place it at, in the same file
- The file is written to the `.canon/tmp/handoff/ui-checklist/<slug>.md` handoff at the main worktree root, overwriting
- A change with nothing visual and nothing untested reports the coverage and writes no file

## Must not

- Write a test at any layer, read a project's test config to write against it, or assert a visual property programmatically
- Repeat the full checklist in chat, stage or commit it, or talk to GitHub directly
- Move the handoff path to match this skill's name, which strands a checklist an older binary wrote
- Run in a session with no implementation context, since there is nothing to split

## Out of scope

- Judging whether the UI is any good, which `ui-audit` owns
- The rules for choosing a test layer, which `test-craft` owns
- Writing the test itself, which `test-first` owns
- Posting the checklist, which `pr-evidence` owns as the sole consumer of the handoff file
- Performing the visual verification, which `review-ui` owns for the boxes a driver can run
