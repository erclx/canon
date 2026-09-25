---
description: Enforce planning standards before implementation
---

# Planning standards

## Planning

- Confirm a numbered implementation plan before a change whose diff cannot be described in one sentence.
- Challenge ambiguous or over-engineered requests before implementation.
- Search the project, its dependencies, and the standard library for an existing implementation before writing new code.
- State where the search ran and why each candidate was rejected. Do not assert a search without naming its results.
- Propose the simplest solution that satisfies the requirement before implementing complex patterns.
- Write or update tests as part of every implementation plan.
- Write the test for a behavior before the code that implements it. Confirm visual output after implementing it, not before.
- Run `canon gov test-order` before shipping a branch. Fix what it names as reaching history ahead of its test.
