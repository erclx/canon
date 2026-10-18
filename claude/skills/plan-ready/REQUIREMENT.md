---
name: plan-ready
description: Why writing a ready folder, its overview, the thin plan, and the task row is one invocation rather than four hand writes, and where the boundary against the planning and shipping skills falls
---

# Plan ready requirement

## Gap

A session handing finished files to a worker writes the folder, the overview, the plan, and the task row by hand, and the four drift. A destination missing from the plan's `**Files to touch:**` is invisible to `plan-reach`, so a second track writes the same file.

Numbering scans one place, so an ordinal can reuse a number an archive already spent, and a bare phase label reserves nothing. A draft beside the real files, or no verbatim-source line, sends the worker off to write its own version. A main-root write from a worktree lands in a copy nobody reads, and the archive move goes unreported.

## Must

- Refuse before writing when the operator named no finished file or a named file does not resolve
- Read the ordinal from the live folder and the archive together, and take the label from `canon tasks next-label --claim`, stopping on a binary that predates the flag
- Derive the overview's `destinations` and the plan's `**Files to touch:**` from one list and compare them before reporting
- Copy each finished file whole into the folder with nothing else, and write the plan's `**Constraints:**` line naming the folder as the verbatim source
- Place the task's row by the branches `task-board` states, route main-root writes through `Bash`, and name the archive move in the closing report

## Must not

- Edit a finished file, since the worker copies verbatim
- Hardcode a branch type or restate the folder shape
- Write `priority.md` or `backlog.md` where an orchestrator is on the roster or the session is a worker or planner
- Automate the archive move or start the worker

## Out of scope

- Writing a plan for a change nobody has written, which `plan-feature` owns
- Copying the folder into a worktree and shipping it, which `role-worker` owns
- A task file for a row with no ready folder, which `task-board` owns
- Shipping a branch, which `git-ship` owns
- The folder's shape and lifecycle, which `references/ready.md` owns
