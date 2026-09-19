---
name: ui-test
description: Why UI changes split into what a browser can assert and what only an eye can judge, and why the visual half is written to disk rather than printed
---

# UI test requirement

## Gap

Without this skill, UI work ships on the confidence of the session that wrote it. What verification does happen mixes the two kinds without noticing, so a checklist item about spacing sits beside one about a form submission, and neither is done properly because they need different work from different people. Tests get written against a config the project does not use, or duplicate what a component test already covers.

The automatable half fails the other way. Sending every interaction, state, and form to Playwright leaves the layers unrouted, so a loading state lands in a full browser run and the end to end suite grows on each UI change. A state a component test reaches costs a browser to check, and the cost recurs on every later run.

The visual half is where the record is lost. A checklist printed into chat scrolls away before anyone verifies it, so the ship step has nothing to gate on and the work reads as verified because a list was produced. Written from a linked worktree against `pwd`, the file lands where the caller does not look.

Writing the checklist correctly to disk does not close the gap either. The file sits under a gitignored folder on the machine that authored it, so a pull request reviewer, on that machine or another, never sees it. A record that only the author can open reads as verified for the same reason a record that never existed does.

## Must

- Split every change into visual-only and automatable before writing anything, then route each automatable one to its layer through `test-craft`
- Write end to end only for a journey or a behavior only a real browser renders, and component or unit tests for the rest
- Name a missing component runner in the output and put the state on the checklist
- Read the project's existing test config and patterns before writing a test against them
- Assert a user action and its outcome per test, covering the happy path and the key edge cases
- Run the tests after writing them and fix what fails
- Write a produced checklist to the `.canon/tmp/handoff/ui-checklist/<slug>.md` handoff at the main worktree root, overwriting
- Report that everything is covered rather than manufacturing a checklist to show work

## Must not

- Try to assert a visual property programmatically
- Re-test what unit or component tests written during implementation already cover
- Route a state a component test reaches into end to end, or fall back to end to end silently when no runner exists
- Repeat the full checklist in chat, which is what made it evaporate
- Stage or commit the checklist, which is gitignored scratch
- Talk to GitHub directly. Posting the checklist to a pull request belongs to `git-pr`, the sole consumer of the handoff file

## Guards

- No implementation context in the session: stop, since there is nothing to derive tests from
- Every change automatable: skip the file write and report the coverage

## Out of scope

- Judging whether the UI is any good, which `ux-audit` owns
- The rules for choosing a layer, which `test-craft` owns
- Deciding whether an outstanding checklist blocks the ship, which the calling pipeline gates on
- Performing the visual verification, which needs a person
