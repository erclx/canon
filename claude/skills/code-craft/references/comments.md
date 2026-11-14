---
title: Comments
description: What a code comment says, where it sits, and what it leaves out, with the limits left to canon comments scan, which the gate fails a touched file on
---

# Comments

Read this before writing or keeping a comment. The figures live in `canon comments scan --help`, which the gate reads, so this file states none of them.

## What a comment says

- State a contract, an outside constraint, or why a surprising line is right. The code says the rest, or should.
- Never walk through what the code does step by step. Rename or restructure until the code reads without that comment.

## Where it sits

- Put the reason at the head of the function, telling a reader what it does and why.
- Keep a note inside a body to a line or two that warns about one surprising line. A body needing more is a function to split.

## What it leaves out

- Leave history to the pull request or a groundwork folder, being the date a figure was measured, the commit or issue it came from, and the alternative tried first. Write `<YYYY-MM-DD>` where a format needs an example date.
- Read a block past three lines of text as a cue to cut. Keep what the code cannot carry and drop the rest.

## The limits

- Run `canon comments scan` for the head, in-body, and history limits and every block past the checkpoint. The gate fails a file a change touched past them, and a full run only reports.
