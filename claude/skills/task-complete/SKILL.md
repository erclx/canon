---
name: task-complete
description: Marks the outcomes a branch's diff shipped `[x]` on the task board, sweeps the review receipts whose branch is gone, and archives a shipped task by hand where the `post-merge` hook could not. Use when asked to "mark what shipped", "tick the outcomes", "close out a shipped task", or "archive that task", or as the ship-chain step after `context-fold`. Do NOT use to create or decline a task, which is `task-board`, or to update the context entries, which is `context-fold`.
metadata:
  family: ship
---

# Task complete

Owns the two operations that settle a task once its work exists: marking the outcomes the diff shipped, and archiving a task whose work reached `main`. `task-board` brings a task into existence and declines one, and `context-fold` writes the context entries. Do not create a task here, and do not move a plan by hand: the archive carries it.

## Guards

- Resolve the board at the main worktree root, not `pwd`. Run `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside a git repo. The board is gitignored scratch shared across worktrees, so a linked worktree reading its own `pwd` finds no board at all.
- If `.canon/tasks/` does not exist at that root, stop: `❌ No .canon/tasks/ board. Run canon claude init to set it up.`
- Route on the request rather than on a flag. A request naming a shipped task to archive, or a task file the `post-merge` hook left in place, takes Archive. Every other request takes Mark, which is what the ship chain invokes.
- Never hand-edit `.canon/tasks/index.md`. A hook regenerates it.

## Mark

### Step 1: resolve the diff baseline

Resolve the base ref once:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Take the union of `git diff --name-only <base> HEAD`, `git diff --name-only HEAD`, and `git ls-files --others --exclude-standard`. Read content with `git diff <base> HEAD` and `git diff HEAD`.

Prefer `origin/main` over local `main`. On `main` itself the local ref resolves to HEAD, so every committed change drops out of the set and this step goes blind to the work it is meant to read.

The baseline is unusable when no merge base resolves against either ref, or when the base came from local `main` and equals HEAD. On an unusable baseline, read `${CLAUDE_SKILL_DIR}/references/unusable-baseline.md` before Step 2 for what to read instead.

### Step 2: match the diff against the board

Read `.canon/tasks/index.md` at the main worktree root, pick the task files whose title or description relates to the changed paths, and read them.

Path matching only chooses which files to open. Behavior decides each outcome. For each unchecked outcome, decide whether the diff shipped the behavior that outcome names.

Completion is a fact about the repository rather than a fact about the conversation, so the diff decides it and the session does not.

Keep the match conservative:

- Mark only outcomes already written on the board. Never infer a new task from the diff.
- Match on the behavior an outcome describes, not on filenames or commit subjects. The path match above only narrowed which task files to open.
- Leave an outcome `[ ]` when the diff is ambiguous. An unmarked shipped outcome costs one manual edit, while a wrongly marked one hides work that never happened.
- Do not touch task files the diff does not relate to.

### Step 3: close the matched outcomes

Mark each completed outcome `[x]` in the task's own file through `canon tasks outcome <stem> --close <n> --json`, repeating `--close` for each. Positions count every outcome checkbox in file order from 1, which the read above already gives. Do not move or archive the file, even when every outcome now reads `[x]`, since the pull request has not merged and the `post-merge` hook archives the task once it does.

The verb resolves the board at the main worktree root in-process, which is the route `session-worktree` states for an edit inside an existing main-root file.

Read `ok` and `reason` out of that record rather than the exit. An operator's shell profile may wrap `canon` in a function that runs the binary and then a second command and takes the second status, which flattens every non-zero exit to zero. A refusal arriving as success leaves the outcome unmarked while the chain moves on, so the board reports shipped work as open and the next session re-plans it.

### Step 4: sweep consumed receipts

Read `${CLAUDE_SKILL_DIR}/references/receipt-sweep.md` for which review receipts this run sweeps, which it keeps, and the output lines. Skip this step silently when nothing qualifies.

## Archive

Read `${CLAUDE_SKILL_DIR}/references/archive.md` when the request names a shipped task to archive. It carries the check that the work reached `main`, the `canon tasks archive` call, the route for each refusal, and the prose to clear afterwards. Never move the file, edit `priority.md`, or regenerate the index by hand, since the command owns all three.

## Output

Emit the full relative path from the project root for every file written or moved. A bare filename names a file the reader cannot open.

Mark, one line per outcome closed, then the sweep lines Step 4 names:

```plaintext
✅ Marked: .canon/tasks/vXX.Y-<slug>.md, outcome <n>
```

When the diff closed nothing, output `✅ No outcomes shipped on this diff.` and nothing for Step 3. A refusal reports the record's `reason` on one line, naming the task.

Archive, reporting the paths the command returned:

```plaintext
📦 Archived: .canon/tasks/archive/vXX.Y-<slug>.md

<ordering and index disposition in one line>
```

A refusal reports the reason and the resolution `references/archive.md` routes it to under its Step 3, on one line each.
