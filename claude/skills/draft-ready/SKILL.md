---
name: draft-ready
description: Writes a ready folder for finished files, its `00-overview.md`, the thin plan that points at it, and the task with a board row placed, reported to an orchestrator, or left to the operator, in one invocation. Use when asked to "write a ready folder", "hand these files to a worker", "package these finished files for a worker", "make a ready handoff", or when a session already holds the exact text of a skill, rule, or doc and a worker should copy it rather than author it. Do NOT use to plan a change nobody has written yet, which is `plan-feature`, to copy a folder into a worktree and ship it, which is `role-worker`, or to file a task with no finished files behind it, which is `task-board`.
---

# Draft ready

A warm session that has already written a change hands the exact text to the worker that ships it. This skill writes the three artifacts that handoff needs and stops before anyone is dispatched.

Read these in parallel before writing:

- `${CLAUDE_SKILL_DIR}/../../standards/ready.md`: the folder layout, the overview frontmatter, the mirrored tree, and the thin-plan contract
- `${CLAUDE_SKILL_DIR}/../../standards/plan.md`: the plan's sections and its answer contract
- `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`: the task file's shape and origin lines
- `${CLAUDE_SKILL_DIR}/references/assembly.md`: the overview and thin-plan templates and the destination match check

## Guards

- If the operator named no finished file, stop: `❌ No finished file named. A ready folder carries text that already exists, so write the files first or use /canon:plan-feature.`
- If a named file does not resolve, stop: `❌ <path> does not exist. Name a file that is already written.`
- Resolve `<main-root>` as `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`. The folder, the plan, and the task all live there.

## Step 1: read the finished files

1. Take each finished file with the destination path the operator gave it. A file arriving with no destination is asked for once, since the mirrored tree cannot place it.
2. Read every file whole. The overview states what the worker still owns beyond copying, and that comes off the files, not off the operator's description of them.
3. Take the branch type from `${CLAUDE_SKILL_DIR}/../../standards/branch.md`, never from a list carried here.
4. Derive one kebab slug for the change. The folder, the plan, and the task all carry it.

## Step 2: allocate the ordinal and the label

Read `<main-root>/.canon/ready/` and `<main-root>/.canon/ready/archive/` together and take the highest `<nn>` across both, plus one. A folder set with no entry takes `01`. Keep this skill-local. No verb allocates a ready ordinal, and two writers running at once can claim one number, so re-read the folder immediately before Step 3 writes.

Take the label from the verb rather than from a scan:

```bash
canon tasks next-label --json
```

Branch on the record's `label` rather than on the exit code. Report the verb as unavailable and stop when the installed binary carries no `next-label` subcommand, since a label picked by hand is the collision the verb exists to prevent.

## Step 3: write the overview

Write `<main-root>/.canon/ready/<nn>-<slug>/00-overview.md` from the template in `${CLAUDE_SKILL_DIR}/references/assembly.md`. Set `destinations` from the Step 1 list and nothing else, and state in prose what the worker still owns, or `nothing further` where the files are the whole change.

## Step 4: mirror the tree

Copy each finished file to `<main-root>/.canon/ready/<nn>-<slug>/<destination path>`, one command per file, so the tree mirrors the destinations exactly.

```bash
install -D -m 0644 <source> <main-root>/.canon/ready/<nn>-<slug>/<destination path>
```

- Copy whole and edit nothing. A change wanted now is made in the source file first and copied after.
- Carry no notes, alternates, or drafts into the folder. Anything else belongs in the plan or the pull request body.
- Write each of these at the main root through `Bash`, one plain command apiece. From a linked worktree `Edit` and `Write` are refused there, and the refusal's redirect names a second gitignored copy no later session reads, per `085-worktrees.md`. Create a whole new file with a heredoc.

## Step 5: write the thin plan

Write `<main-root>/.canon/plans/feature-<slug>.md` from the template, by heredoc, per `${CLAUDE_SKILL_DIR}/../../standards/plan.md`.

- List every Step 1 destination under `**Files to touch:**`, each with one clause on why it changes, pointing at the folder's copy rather than restating it.
- Add a `**Constraints:**` line naming the ready folder as the verbatim source for those paths.
- Name the branch type from Step 1 in `## Summary`. Write `None identified.` under `**Questions:**` unless a call is genuinely the operator's.

Run the match check in `${CLAUDE_SKILL_DIR}/references/assembly.md` before going further. The two lists are one list, and a path in either without the other stops the run.

## Step 6: write the task

Write `<main-root>/.canon/tasks/<label>-<slug>.md` by heredoc, from the label Step 2 read. Its frontmatter, H1, and `## Outcomes` follow `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`. Write a `Ready:` line beside the `Plan:` line pointing at the folder, then point the task at the plan through the verb:

```bash
canon tasks plan-link <task-stem> .canon/plans/feature-<slug>.md --json
```

Branch on the record rather than on the exit. `Ready:` is defined nowhere yet, so the line orients a worker reading the task and no check reads it.

A task file with no row is a dropped task, so place the row in the same pass. The plan exists, so the row takes `## Run now` when `canon tasks plan-reach` reports nothing claimed and `## Up next` otherwise, with the held path in its `Waiting on` cell, per the tests in `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`. Check the roster the way `canon:task-board` Step 4 does, reading `canon sessions list --self --json` for this session and `canon sessions list --json` for a row from the same repository, under another `sessionId`, whose `name` starts with `orchestrator-`. Treat a refused read as a roster read that failed.

- **Orchestrator found.** Write neither file. Message that session with the row's title, the plan link, and the group with its reason, so it places the row itself rather than two sessions writing the board at once.
- **Not found, and this session's name starts with `worker-` or `planner-`.** Write neither file, since both role bodies ban a board write with no exception. Report the row and its group in Step 8.
- **Not found otherwise, or the roster read fails.** Write the row into `priority.md` through the same `Bash` route the task file took. A failed read looks like a solo project, and stopping would strand the task on the one path with nobody to place it.

Say which branch fired in Step 8.

Regenerate the task index after writing, since a hook on `Write|Edit` never fires on `Bash`:

```bash
canon indexes regen .canon/tasks
```

## Step 7: validate

```bash
canon records validate plans --json
canon markdown audit <main-root>/.canon/ready/<nn>-<slug>/00-overview.md
canon markdown audit <main-root>/.canon/plans/feature-<slug>.md
```

Fix what the records name in the files this run wrote and re-run once. Report a finding on a file it did not write, such as a neighbor folder missing its overview, without repairing it.

## Step 8: report

```plaintext
✅ Ready folder written: .canon/ready/<nn>-<slug>/
   Plan: .canon/plans/feature-<slug>.md
   Task: .canon/tasks/<label>-<slug>.md
   Row: <label> <title>, <written under ## Run now | reported to <orchestrator name> | left for the operator to place>, <reason>
   Archive on ship: move the folder to .canon/ready/archive/<nn>-<slug>/ by hand, then retarget the task's Ready: line
```

Name the archive move every time. `canon tasks archive` moves the task and its plan and leaves the folder live, so the move is the one step this run leaves for whoever ships.

## Rules

- Edit no finished file. The worker copies verbatim, so a change belongs in the source before this runs.
- Restate nothing the standards own. A shape question is answered by `ready.md` and a plan question by `plan.md`.
- Dispatch nothing. Starting the worker belongs to whoever runs the board.
