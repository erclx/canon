---
name: assembly
description: The overview and thin-plan templates for a ready folder, and the match check between the two lists of destinations
---

# Assembly

Loaded from Step 3 and Step 5 of `draft-ready`. The shape rules live in `${CLAUDE_SKILL_DIR}/../../standards/ready.md` and `${CLAUDE_SKILL_DIR}/../../standards/plan.md`, so this file holds the fill-in forms and the one check that compares them.

## The overview

```markdown
---
title: <Change in sentence case>
description: <one line naming what the handoff carries>
type: <branch type from branch.md>
destinations:
  - <path/to/file>
---

<What the files carry, one bullet each where a file's purpose is not its name.>

<What the worker still owns beyond copying, or "nothing further".>
```

- Write `destinations` from the Step 1 list in the order the plan will list them.
- Keep the prose to what the files cannot say themselves, such as a docs sync, a sandbox scenario, a test the folder does not carry, or the order a change lands in.

## The thin plan

```markdown
# Feature: <short title>

<Two or three sentences on why this ships as a copy rather than as an authoring job.>

## Summary

- <what the change does, one bullet per file group>
- <branch type and what the worker still owns>

**Constraints:**

- `.canon/ready/<nn>-<slug>/` holds the verbatim source for every path below. Copy each file whole rather than reading it as a description and writing a version.
- <a live plan or run row holding a path, when one exists>

**Files to touch:**

- `<path/to/file>`: copy from the ready folder, <one clause on what it changes>

**Risks:**

- <what could go wrong, or "None identified.">

**Questions:**

None identified.
```

## The destination match check

Read the overview's `destinations` and the plan's `**Files to touch:**` paths, then compare the two sets:

- A path in `destinations` and not in the plan is invisible to `plan-reach`, so the plan gains the line.
- A path in the plan and not in `destinations` names a file the folder does not carry, so either the folder gains the file or the plan loses the line.
- A path in either list with no file at that relative path inside the folder is a broken mirror. Report it and stop rather than writing a plan around a hole.

Report the sets as equal, or name each path that differs and on which side. Do not report the check as passed without having read both lists.
