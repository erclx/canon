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
| Step 2 noted a requirements change          | `↪ Direction changed this session: run document-health on canon/REQUIREMENTS.md` |
| Per audit finding Step 4 reported           | `⚠ Audit:` in the shape the body gives                                           |
| No file updated and Step 4 reported nothing | `✅ No changes needed.`                                                          |

Do not shorten or paraphrase the audit lines here or in the reply, since the finding is what a reader checks it against.

## Suppressing the closing line

Suppress `✅ No changes needed.` when Step 2 already reported no context updates. That report closes the run on its own, and emitting both leaves a quiet session reporting success twice for one outcome.
