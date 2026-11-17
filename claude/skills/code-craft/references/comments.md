---
title: Comments
description: What a code comment says, where it sits, and what it leaves out, with the limits read from canon comments scan, which the gate fails a touched file on
---

# Comments

Read this before writing or keeping a comment. The figures live in `canon comments scan --help`, which the gate reads, so this file names only the two a writer counts while drafting.

## What a comment says

- State a contract, an outside constraint, or why a surprising line is right. The code says the rest, or should.
- Give a comment on an internal declaration or a member a reason or a constraint, never a description its name and type already carry.
- Never walk through what the code does step by step. Rename or restructure until the code reads without that comment.

## Where it sits

- Put the reason at the head of the function, telling a reader what it does and why.
- Keep a note inside a body to one line that warns about one surprising line. A body needing more is a function to split.

## What it leaves out

- Leave history to the pull request or a groundwork folder, being the date a figure was measured, the commit or issue it came from, and the alternative tried first.
- Write `<YYYY-MM-DD>` for an example date and a token name for a color written in digits alone, since the scan reads a real date and an issue number.
- Cut a head block to three lines of text, since the gate fails a fourth. Keep what the code cannot carry and drop the rest.

## The limits

- Run `canon comments scan` for the head, in-body, and history limits, the file share, and every block past the checkpoint, which it reports file by file.
