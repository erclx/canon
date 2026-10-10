---
title: Completion report
description: The lines context-fold prints once every step has run, being one per file updated, the direction-change note, Step 8's own lines, and the closing line with when it is suppressed
---

# Completion report

The close of `context-fold`. The session reads this file once every step has run, before printing anything.

Output one line per file updated:

`✅ Updated: <path written>`

When Step 2 noted a requirements change: `↪ Direction changed this session: run document-health on canon/REQUIREMENTS.md`

Step 8 adds its own lines when it applied or reported a finding, in the exact shape `${CLAUDE_SKILL_DIR}/references/classify.md` gives them under its own Report section. Do not shorten or paraphrase those lines here or in the reply, since the quote and the reason are what a reader checks the finding against.

If no files were updated and nothing was swept, output:

`✅ No changes needed.`

Suppress that line when Step 2 already reported no doc updates. It closes the run on its own, and emitting both leaves a quiet session reporting success twice for one outcome.
