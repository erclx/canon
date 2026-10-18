---
title: Repair batches
description: How document-repair sizes and orders a batch, when it stops, and what a rewrite may cut
---

# Repair batches

`document-repair` reads this at Step 2 to pick a folder and at Step 3 before cutting anything.

## Size

One batch is one folder, gated before the next starts. A folder is the unit `canon markdown gated add` takes, so a batch spanning two leaves one half rewritten and ungated when the session stops.

Split a folder with more findings than one session can rewrite with care into its subfolders, and gate each subfolder by its own prefix.

## Order

Take the folder a reader opens most, then the folder with the fewest findings.

| Order | Folder            | Why                                             |
| ----- | ----------------- | ----------------------------------------------- |
| 1     | `README.md`       | The first page anyone reads                     |
| 2     | `docs/`           | Pages written for a reader rather than an agent |
| 3     | `canon/context/`  | Read on every session that touches its domain   |
| 4     | `.claude/skills/` | Loaded on request, so a long body costs a turn  |
| 5     | The wiki folder   | Orientation pages, read least often             |

Within a tier, a folder close to zero goes first, since it gates the soonest and stops drift there.

## Stop rule

Stop the batch, and report it ungated, when a rewrite would change what a document claims rather than how it says it. That call belongs to the document's owner, so name the file and the block.

Stop the run after the batch in hand when the session's context is running short. A half-rewritten folder is worse than an untouched one, since the next session cannot tell which files were read.

## What a rewrite may cut

A rewrite changes shape and keeps substance.

- Keep every stated reason. A rule without its reason is the cut a reviewer cannot recover from the diff alone.
- Keep every command, path, and number the document states, unless the tree shows it wrong
- Cut a sentence restating the one above it, and a list item repeating its heading
- Move detail to a table or a linked page rather than deleting it
- Never cut a warning, a refusal condition, or a stated limit to pass the audit
