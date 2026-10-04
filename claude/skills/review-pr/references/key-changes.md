---
title: Key changes check
description: How review-pr Step 3 tests what the pull request body's Key Changes section claims against the diff, reading each field the canon pr key-changes record carries and which one becomes a finding
---

# Test the Key Changes claims

Part of Step 3 of `review-pr`. The session reads this file after the `## Testing` boxes and before the `## For the reviewer` bullets.

Test what `## Key Changes` claims against the diff it describes, with `canon pr key-changes <number> --json`. This repository squash-merges, so that section becomes the commit message and the record on the trunk once the branch is gone, which is the same thing a stale ticked box corrupts. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

Read `unmet` as a `should-fix` finding under the same `**PR body**` block the stale box takes, one entry per path, quoting the bullet the record carries on `preview` and naming the `head` the comparison ran at. Read the bullet before filing it, since one class survives the reader: a bullet citing where something is defined while claiming an edit elsewhere, which puts a real path in the claim region and points the change at a locative the path does not name. Report that as the class rather than as a stale claim. A body is edited between pushes, so the reading is true at that commit and can be false a minute later. Read `unnamed` for yourself and raise nothing off the count. The class still covers a real omission and equally a generated asset or a regenerated index that earns no bullet, and the entries the reader can name as owing none are already held apart under `incidental`. Open the section and confirm no bullet names the file before putting a single one to the author, because this instruction has sent the question to three pull requests in one day over bullets that had named the files all along, and one of those authors added bullets nobody needed. Report `unresolved` and `incidental` nowhere: the first was judged in neither direction and the second owes no bullet, so neither says anything about the body.

A `reason` of `no-claims` means the reader resolved no path out of a section that exists, which is the extractor failing over prose rather than the body being wrong. Say so and raise nothing. `no-section` is the body carrying no such heading, which is a finding only where the pull request template asks for one.

Compose this on the body read Step 4 already performs rather than opening a second one. That step scans the title and body for a leaked phase label, and both reads answer from the same text at the same head.
