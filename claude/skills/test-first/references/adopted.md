---
title: Adopted and declined
description: Which external sources the test-first loop draws on, which parts it declined, and which of its rules no source states, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

The loop predates this ledger, so this file records the sources it matches rather than the ones it was drafted from. Each was opened before it was cited. A later session extending the skill adds to this file rather than re-arguing an item settled here.

In the toolkit's checkout, `governance/ledger/skills/test-first/SKILL.md` sources each step of the body, and `canon claude skills audit` checks it row by row. That ledger never ships, so this file keeps the source-level position. <!-- canon-allow-reference: read only in the toolkit checkout -->

## Adopted

### The loop itself

Kent Beck's Canon TDD states it as turning one item into "an actual, concrete, runnable test", changing the code "to make the test (& all previous tests) pass", then refactoring. Adopted as steps 2, 4, 5, and 6, with the whole suite run after the pass rather than the new test alone.

### Making it pass without designing

The same post warns against "mixing refactoring into making the test pass", and keeps implementation design decisions for the refactor. Adopted as step 4's smallest change and step 6's cleanup of the shortcuts that change left.

### Never faking the pass

The same post lists deleting assertions "so the test pretends to pass" and "copying actual, computed values & pasting them into the expected values" as mistakes. Adopted as step 5's rule that a pass must be the one the test was written to prove.

### Refactoring is a step, not an option

Martin Fowler's TestDrivenDevelopment names "neglecting the third step" as the most common way to get the practice wrong. Adopted as step 6 being mandatory where Canon TDD writes "optionally refactor".

### Watching the failure

`obra/superpowers`' Test-Driven Development skill makes the red run mandatory and has it confirm the test "Fails because feature missing (not typos)". On a pass it says "You're testing existing behavior. Fix test." Adopted as step 3 and as both rules under extending existing behavior, which this file first recorded as stated by no source.

## Declined

**The test list.** Canon TDD opens by listing every expected variant of the new behavior before writing a test. Declined because a plan already names the behaviors a build covers, and `canon:build-in-slices` owns the order they land in, so a second list here would hold a second copy of the scope.

**Refactoring only as far as the session needs.** Canon TDD warns against refactoring further than necessary and calls duplication "a hint, not a command". Declined as a separate rule, since `canon:code-craft` owns when an abstraction earns its place and step 6 already limits refactoring to what step 4 left.

## Checked and not a source

**Software Engineering at Google, [Testing Overview](https://abseil.io/resources/swe-book/html/ch11.html).** The default shelf's testing chapter covers why tests matter and how a suite is structured, and never addresses writing a test before its code or watching it fail. It informs `canon:test-craft`, which step 1 loads, rather than this loop.

**Kent Beck's _Test-Driven Development: By Example_.** The book is the loop's origin, and no openable copy was available to cite a version from. Canon TDD is Beck's own later restatement and stands in for it here.

## Stated by no source

**Loading the sibling skills.** Steps 1 and 4 load `canon:test-craft` and `canon:code-craft`. No source routes between skills, so those clauses rest on the split each sibling's own description draws.
