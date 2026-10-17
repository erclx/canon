---
title: Create report
description: The report a task-board create run closes on, being the created path, the label and surface lines, and the two blocks Step 5's origin scan fills
---

# Create report

Read from `## Output` of `task-board` when the run created a task. A decline run skips this file and reports through its own reference.

## Report block

```plaintext
✅ Created: .canon/tasks/vXX.Y-<slug>.md

<label>, next after <highest>.
<board or backlog, and why it landed there>.

**Origin with no task:**

- `.canon/groundwork/<slug>/`: open, touched <date>
- `.canon/intake/<slug>/`: every item answered, nothing promoted
- #NNN: <issue title>

**Waiting on you:**

- `.canon/intake/<slug>/`: <n> of <n> items unread
- `.canon/intake/<slug>/`: <n> items carry no answer slot, so no verb reaches them
```

## When a block drops

Drop either block when it carries no rows. When both are empty, which is the ordinary result, replace them with one line naming what was read:

```plaintext
Read <n> tracks, <n> dumps, and <n> open issues. Nothing unlinked.
```
