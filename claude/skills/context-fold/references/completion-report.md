---
title: Completion report
description: The lines context-fold prints once every step has run, being one per file updated, the direction-change note, Step 4's audit lines, and the closing line with when it is suppressed
---

# Completion report

The close of `context-fold`. The session reads this file once every step has run, before printing anything.

## Lines

| When                                        | Line                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Per file updated                            | `✅ Updated: <path written>`                                                     |
| Per sibling entry Step 3 opened             | `✅ Opened: <path written>, beside <owner> past its cap`                         |
| Per entry Step 3 wrote that is past a cap   | `↪ <rel> is past its cap: run document-health on <rel>`                          |
| Step 2 noted a requirements change          | `↪ Direction changed this session: run document-health on canon/REQUIREMENTS.md` |
| Per audit finding Step 4 reported           | `⚠ Audit:` in the shape the body gives                                           |
| No file updated and Step 4 reported nothing | `✅ No changes needed.`                                                          |

Do not shorten or paraphrase the audit lines here or in the reply, since the finding is what a reader checks it against.

## The past-cap line

Print the past-cap line once per entry Step 3 wrote, opened sibling or not, that Step 4's `canon context audit --json` record reads as full. Step 3's pre-write record cannot see what this run wrote. Full takes the test Step 3 states, so a shape break that is no cap prints nothing here.

The fold never splits the entry, since a split moves paths that queued plans cite.

- `document-health` builds the split, so the line names it as the repair
- When the finding is a folder H3 past its bullet cap, add the ways out under `### When a folder passes the cap` in `${CLAUDE_SKILL_DIR}/references/context.md` beside it

## Suppressing the closing line

Suppress `✅ No changes needed.` when Step 2 already reported no context updates. That report closes the run on its own, and emitting both leaves a quiet session reporting success twice for one outcome.
