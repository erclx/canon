---
title: Key changes check
description: How review-pr Step 3 tests what the pull request body's Key changes section claims against the diff, reading each field the canon pr key-changes record carries and which one becomes a finding
---

# Test the Key changes claims

Part of Step 3 of `review-pr`. The session reads this file after the `## Testing` boxes and before the `## For the reviewer` bullets.

Test what `## Key changes` claims against the diff it describes, with `canon pr key-changes <number> --json`. This repository squash-merges, so that section becomes the commit message on the trunk once the branch is gone, the same record a stale ticked box corrupts.

## Reading each field

Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero. Each field the record carries takes its own reading.

| Field        | Reading                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| `unmet`      | a `should-fix` finding under the `**PR body**` block the stale box takes, one per path |
| `unnamed`    | read for yourself and raise nothing off the count                                      |
| `unresolved` | reported nowhere, since it was judged in neither direction                             |
| `incidental` | reported nowhere, since it owes no bullet                                              |

Each `unmet` finding quotes the `preview` bullet and the `head`.

### Before filing an unmet path

Read the bullet before filing it, since one class survives the reader. A bullet citing where something is defined while claiming an edit elsewhere puts a real path in the claim region, so report that as the class rather than as a stale claim.

A body is edited between pushes, so the reading is true at the `head` it names and can be false a minute later.

### Before raising an unnamed path

The `unnamed` class covers a real omission and equally a generated asset or a regenerated index that earns no bullet. Open the section and confirm no bullet names the file before putting one to the author.

This instruction once sent the question to three pull requests in one day over bullets that had named the files all along, and one author added bullets nobody needed.

## Refusals

- `no-claims` means the reader resolved no path out of a section that exists, the extractor failing over prose, so say so and raise nothing
- `no-section` means the body carries no such heading, a finding only where the pull request template asks for one

Compose this on the body read Step 4 already performs rather than opening a second one. That step scans the title and body for a leaked phase label, and both reads answer from the same text at the same head.
