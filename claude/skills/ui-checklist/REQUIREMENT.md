---
name: ui-checklist
description: Why the visual half of a UI change needs a written record a reviewer can open, why that record travels with the screenshots it annotates, and why writing the tests belongs elsewhere now
---

# UI checklist requirement

## Gap

Without this skill, UI work ships on the confidence of the session that wrote it. Nobody states which part of the change an eye has to judge, so a reviewer opens the diff and reads the automatable half, which the tests already cover, and never looks at the half that only rendering shows.

The visual half is where the record is lost. A checklist printed into chat scrolls away before anyone verifies it, so the ship step has nothing to gate on and the work reads as verified because a list was produced. Written from a linked worktree against `pwd`, the file lands where the caller does not look.

Writing the checklist correctly to disk does not close the gap either. The file sits under a gitignored folder on the machine that authored it, so a pull request reviewer, on that machine or another, never sees it. A record that only the author can open reads as verified for the same reason a record that never existed does.

Posting it as a comment of its own is the next failure. The screenshots the checklist annotates sit in a second comment, so a reviewer reads "the hero settles without a jump" with no picture of the hero beside it and scrolls looking for one. Two comments describing one change also drift: a later push re-renders the screenshots and leaves the checklist claiming what an older head showed.

The automatable half has its own gap, and it is no longer this skill's to close by writing the tests. `test-first` writes a behavior's test while the code is written, and `test-craft` owns which layer it belongs at. A skill writing tests after implementation duplicates both, and what it produces is the test the session already skipped rather than the test the behavior needed. What stays open is that nobody names the behaviors shipping untested, which is a list rather than a test.

## Must

- Split every change into visual-only and automatable before writing anything
- Write the checklist for the visual-only half, each item an action and the result a person is looking for
- Name every automatable change shipping with no test, with the layer `test-craft` would place it at, as a section of the same file
- Write the file to the `.canon/tmp/handoff/ui-checklist/<slug>.md` handoff at the main worktree root, overwriting
- Report that there is nothing to verify rather than manufacturing a checklist to show work

## Must not

- Write a test at any layer, which is `test-first` while the code is written and `test-craft` for where it goes
- Read a project's test config or runner in order to write against it
- Try to assert a visual property programmatically
- Repeat the full checklist in chat, which is what made it evaporate
- Stage or commit the checklist, which is gitignored scratch
- Talk to GitHub directly. Posting the checklist belongs to `git-pr`, the sole consumer of the handoff file
- Move the handoff path to match this skill's name, which strands a checklist an older binary wrote

## Guards

- No implementation context in the session: stop, since there is nothing to split
- Nothing visual and nothing untested: skip the file write and report the coverage

## Out of scope

- Judging whether the UI is any good, which `ux-audit` owns
- The rules for choosing a layer, which `test-craft` owns
- Writing the test itself, which is `test-first`
- Deciding whether an outstanding checklist blocks the ship, which the calling pipeline gates on
- Performing the visual verification, which needs a person
