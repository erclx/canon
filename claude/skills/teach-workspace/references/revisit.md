---
title: Revisit schedule
description: How teach-workspace Step 5 writes a learning record's Revisit section, being the bullet shape, where each date and rung is copied from, the first schedule for a new item, and how a later record revises one
---

# Write the Revisit section

Part of Step 5 of `teach-workspace`. The session reads this file once the record's lessons, retrievals, and wrong answers are written, before restating the mission's success lines.

Then write `## Revisit`, one bullet per item, in the shape `${CLAUDE_SKILL_DIR}/references/teach.md` fixes:

```markdown
## Revisit

- **<what comes back up>**: due <YYYY-MM-DD>, rung <n>
```

Take both the date and the rung from the `due` entry Step 1 already read, copying `hit` for an item the learner retrieved unaided and `miss` for one they did not, with the rung stepped the same way. Do not compute a date from the ladder. A session told to widen a gap still picks the number by judgment, which is the reason the verb reports both dates at all.

An item the records have never scheduled has no `due` entry to copy from. Open it at rung 1, dated the day after this session, which is the ladder's floor and the one number this body states. Every later date for it comes from the verb.

An entry outside this shape schedules nothing and nothing reports that it was skipped, so write the shape exactly. A later record naming the same item supersedes an earlier entry, so revise a schedule by writing the new bullet rather than editing the record it was set in.
