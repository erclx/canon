---
title: Tier 1 task reads
description: How auto-ship Step 1 resolves a caller-supplied task's Plan line to a plan, and the three stops it takes when that pointer is missing, archived, or resolves to no file
---

# Reading a task's plan pointer

Step 1 of `auto-ship`, tier 1. The session reads this file when the invocation carried a path under `.canon/tasks/`.

## Reading the pointer

One plan per task is what makes the tier 1 read unambiguous, so it takes the first `Plan:` line and never scans for a second. A caller who means the task holds its path already, having read it off the board, which is why a bare slug never reaches this tier.

Read the target out of the link's parentheses, and take the rest of the line when the line carries no link, since an older task writes the target as a plain path with nothing around it. Resolve a relative target against the directory holding the task file rather than against `.canon/tasks/`, and take a project-root target from the root. The archived task is what makes that base matter, since the standard points its line at `../../plans/archive/feature-<slug>.md` once the task sits a folder deeper, and reading that from `.canon/tasks/` lands on a repository-root `plans/archive/` that never exists.

## When a tier fails

Tier 1 stops on three failures, and each names a different repair:

- No `Plan:` line at all. Stop: `❌ <path> carries no Plan: line, so nothing there names a plan to run. Write the plan and point the task at it, or pass the plan path directly.` A row still awaiting a plan is the ordinary case, so the message names the missing pointer rather than the missing plan sections a reader would then go hunting for.
- The pointer resolves into a plans archive. Stop: `❌ <path> points at an archived plan, which describes work that already shipped. Reopen the task against a live plan, or pass that plan directly.` Test the resolved path rather than the task's outcomes or its `Pull request:` line, since a stale board gets its ticks wrong and the standard fixes where a shipped pointer lands.
- The pointer resolves to no file. Stop: `❌ <path> points at <target>, which does not exist. The citation is stale, so repoint the task or pass the plan path directly.`

An archive is `.canon/plans/archive/` and also the two older spellings `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` leaves in place for a project that archived plans before the folder nested, written from a task as `../plans-archive/` and `../.tmp/plans-archive/`. Test all three, since a shipped pointer in a project nobody migrated lands on the older two. Run the archive test ahead of the existence test, so a pointer into an archive that no longer holds the file still refuses as shipped work rather than as a stale citation.

Each tier fails for a different reason and says so. A supplied path resolving to nothing is a typo, a derived path resolving to nothing is a plan nobody wrote, and a task pointer resolving to nothing is a stale citation the board should have caught.
