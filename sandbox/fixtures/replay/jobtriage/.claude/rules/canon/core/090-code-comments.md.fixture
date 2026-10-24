---
description: Decide when a code comment should exist and what it may claim
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.jsx'
  - '**/*.sh'
  - '**/*.py'
---

# Code comment standards

## When a comment should exist

- Write a comment only when it records a fact the reader cannot recover from the code: an external contract, a rejected alternative, or the reason a surprising line is correct.
- Do not restate in prose what the line beside it already says.
- Do not comment a self-contained function whose signature and body already carry its behavior.
- Let comment density follow how much of a file's behavior is decided outside that file. Treat density as an outcome, never as a target.
- Do not add or delete a comment to move a file toward a density figure.

## What a comment may claim

- State only what is true of the code as written.
- Describe a function's contract and its constraints, never its steps line by line.
- Update or delete an invalidated comment in the same change that invalidates it.
- Do not name a person, a ticket, or a date in place of the fact itself.

## What never goes in a comment

- Delete commented-out code. Do not park it beside the live path.
- Do not record the edit that produced the code. Version control holds the change history.
- Do not defer work into a comment. Deferred work belongs in the tracker.

## Degradation vocabulary

Do not write a comment carrying any of these terms.

- `FIXED`, `BUGFIX`, `HACK`, `XXX`, `NOTE:`, `TODO`, `FIXME`, `don't remove`, `previously`, `used to`, `workaround`
