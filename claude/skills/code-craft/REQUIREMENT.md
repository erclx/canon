---
name: code-craft
description: Why a session writing code needs stated rules on the shape of a function, a class, or a module's internals, and where that judgment stops short of placement, the test loop, a caller's contract, and review
---

# Code craft requirement

## Gap

Nothing shapes code at the moment it is written. The loop, the file's placement, and the caller's contract each have an owner, and the shape of a function, a class, or a module's internals is left to whatever the neighboring code suggests.

Agents fail there in recorded ways. They copy where reuse belonged, spread one change across files, build features nobody asked for, fill in assumptions, and patch a symptom by brute force. Each reads fine in its own diff and costs the next change.

## Must

- Open with the change test, naming the change most likely to come next and counting what it would touch before choosing a shape
- State depth as rules a session can act on, covering a unit's interface being simpler than its work, inlined pass-throughs, and splitting by the decision hidden
- State each tension as when one side wins, such as one place for knowledge against coupling two things that only look alike
- State hidden inputs: pass in the clock, environment, and randomness, and keep business rules free of transport and storage code
- Close with the agent failure modes as checks on the session's own diff, with excuses, red flags, a checklist, and the external sources adopted and declined with the reason for each

## Must not

- Restate a definition a model already holds, state a tension as one side only, or shape code for a change nobody can name
- Name a language, a framework, or a type system feature in the body
- Restate error or naming bullets, which the core code rule and `api-design` carry

## Out of scope

- Where a new file sits on disk, which `codebase-layout` owns
- The red, green, refactor loop, which `test-first` owns
- Which layer a test belongs at, which `test-craft` owns
- The contract a caller depends on, which `api-design` owns
- Judging a finished diff, which `review-craft` owns
