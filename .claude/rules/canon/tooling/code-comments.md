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
- Do not add or delete a comment to move a file toward a density figure, since density follows how much of its behavior is decided outside it.

## What a comment may claim

- Keep each comment true of the code as written, and update or delete one a change invalidates in that same change.
- Describe a function's contract and its constraints, never its steps line by line.
- Do not name a person, a ticket, or a date in place of the fact itself.

## What never goes in a comment

- Delete commented-out code. Do not park it beside the live path.
- Do not record the edit that produced the code. Version control holds the change history.
- Do not defer work into a comment. Deferred work belongs in the tracker.

## Degradation vocabulary

Do not write a comment carrying any of these terms.

- `TODO`, `FIXME`, `HACK`, `XXX`
