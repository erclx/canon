---
title: Intake retell reference
description: The chat retell of an intake folder, one block per item stating its problem, its fix, and why a declined one was declined, and the wording rules a groundwork close and an app drive share
---

# Intake retell reference

Applies to the retell a session gives in chat of an intake folder at `.canon/intake/<nn>-<slug>/`. An item is written for the file, with a measured `Problem:` line dense in paths and counts. The retell says the same item in plain words for an operator who reads the chat and has not opened the folder.

## Scope

Governs the shape of an intake retell and the wording rules every retell follows, an intake one or another skill's.

Does not govern:

- **`intake.md`**: the item format and the answer contract, which a retell leaves unchanged
- **`plan-groundwork`'s output reference**: the groundwork retell's own template, which takes the wording rules below and nothing else
- **the `write-human` skill**: voice, rhythm, and sentence construction

## What a retell is

A retell is chat only. It writes no file, and it never fills, edits, or infers a `You:` slot.

- Read the items through `canon intake list <slug> --json`, which carries every item answered or not
- Retell an answered item and an unread one alike, marking the unread one `unread`
- Offer no verdict on an unread item, since the call is the operator's and the retell only restates it

## One block per item

Give one block per item, in cluster order, the cluster file and its label opening each block so the measured line is one open away.

```plaintext
**<cluster file> <label>. <short title>** (<the answer, or unread>)

- **Problem:** <what goes wrong today, in plain words>
- **Fix:** <the one change proposed, in plain words>
- **Why declined:** <the reason, on a declined item only>
```

Write each line fresh from the item for a reader who has not opened the file, condensing rather than pasting.

### The decline reason

A declined item carries the operator's answer and the filed `Worth it:` and `Suggested:` lines, and the two can differ.

- Take the reason from the answer when it gives one, as in `decline, the design board owns this`
- Otherwise, when the filed suggestion recommended declining, say the reason is the suggestion's, as in `Why declined: the filed suggestion, since the merge gate already catches it`
- Otherwise say the answer gave no reason, since a suggestion to keep or promote carries no reason to decline
- Never state a reason as the operator's that their answer does not give

## Wording rules

These hold for every retell, an intake one, a groundwork close, and an app drive's.

- Say what happened in plain words, never the item's measured line with its paths and counts
- Keep one number at most per item, and only where it carries the point
- Name a thing by what it does, such as the merge gate, never by a skill or section name
- Give every item the same shape, and put a dependency in a few words at the end
- Past six items, retell in waves of about six grouped by theme, with a table of the waves first

Follow the `write-human` skill for voice. Say once, at the end, what the retelling session did not verify, such as a claim read off the item rather than checked against the tree.

## Waves

A folder of thirty items retold whole is a wall of text. Open a long retell on the wave table, then give one wave per message and wait for the operator before the next.

```plaintext
| Wave | Theme               | Items |
| ---- | ------------------- | ----- |
| 1    | <what the wave is>  | <N>   |
| 2    | <what the wave is>  | <N>   |
```

A wave groups items by theme and may cross cluster files, with each block still naming its own cluster file and label.
