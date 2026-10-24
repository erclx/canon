---
name: context-fold
description: Folds a branch's diff into the project's context entries, rewriting a folder or a gotcha the diff left untrue, then audits what it touched. Use when asked to "fold the session into context", "update the context entries", "refresh the context folder", when design or requirements changed mid-cycle, after a pivot, or before shipping. Do NOT use for `README.md` or `docs/`, which is `docs-sync`, or to mark a shipped task's outcomes on the board, which is `task-complete`.
metadata:
  family: ship
---

# Context fold

## Guards

- If neither a `canon/` nor a `.claude/` directory exists, stop: `❌ No canon/ or .claude/ directory found. Run canon claude init to set up the workflow.`

The skip for a session that changed nothing lives at the end of Step 2, because it needs the diff to decide.

## Diff baseline

Steps 2, 3, and 4 share one diff. Resolve the base ref once and reuse it:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Take the union of `git diff --name-only <base> HEAD`, `git diff --name-only HEAD`, and `git ls-files --others --exclude-standard`. Read content with `git diff <base> HEAD` and `git diff HEAD`.

- Prefer `origin/main` over local `main`. On `main` itself the local ref resolves to HEAD, so every committed change drops out of the set and the skill goes blind to its work.
- The baseline is unusable when no merge base resolves against either ref, or when the base came from local `main` and equals HEAD
- On an unusable baseline, read `${CLAUDE_SKILL_DIR}/references/unusable-baseline.md` before Step 3 for the set that step takes instead

## Step 1: read the context catalog

Read `canon/context/index.md` from the current worktree root (`pwd`), not the main worktree root, to see which domain entries exist.

- Entries are tracked files, so edits must commit with the branch
- A project the surface move has not reached holds the folder under `.claude/` rather than `canon/`, so read and write it at whichever root already carries it

Read `canon/REQUIREMENTS.md` beside it when it exists, for the direction a session decision is measured against. This skill never writes it.

## Step 2: identify what changed

Review the session for requirements added, removed, or changed in scope, which After completion reports and this skill never writes. Then resolve the diff baseline and keep the changed paths for Step 3.

Stop when both of these hold, since a session-only skip would drop the diff-driven refresh for a mechanical change nobody narrated:

- The session shows no direction change
- The diff carries no path a context entry could describe, being a change confined to the task board, scratch, or files outside source and docs

Report `✅ No context updates needed. Session matched the original plan.`

## Step 3: refresh context entries

Skip this step silently when `canon/context/` does not exist or its catalog lists no entries. Otherwise read `${CLAUDE_SKILL_DIR}/references/context-refresh.md` for the diff it reads, the widening a removed capability takes, when a new entry is created, and the output lines.

Write an entry only when the diff adds, moves, or removes a folder, makes a folder's existing bullet untrue, or adds, fixes, or removes a trap, and skip the step otherwise. Never write a decision, which the pull request records. Every write follows these rules:

- Never write `canon/REQUIREMENTS.md`. Report a requirements change in After completion.
- Update only the Layout H3 or the gotcha the trigger names, and leave unrelated sections alone.
- Edit the bullet that went untrue in place, and never append a correction beside it, per `${CLAUDE_SKILL_DIR}/references/context.md`
- Follow `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md` and the `write-human` skill for all edits.

Write each updated file immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

## Step 4: audit what the fold touched

Run the structural audit and the markdown audit, and answer each before the report. Findings never stop the fold.

### Structural audit

`canon context audit --json` takes a project root rather than a file list, so it reports the whole folder.

```bash
canon context audit --json
```

- Report only the findings whose `rel` names a file Step 3 wrote this run or a file the diff carries, one line each as `⚠ Audit: <rel>, <finding>`
- Leave the rest unreported, since a finding in an entry this run never touched belongs to whoever next edits it
- Repair a finding in a file Step 3 wrote this run when the fix is inside what it already rewrote, such as a bare reference or a missing section it dropped
- Report a missing subcommand or a refusal as `⚠ Audit: <message>` and continue

### Markdown audit

Run `canon markdown audit <path>` over every entry Step 3 wrote this run, and fix each ban and density finding it reports per the markdown standard Step 3 follows.

- Fix a finding inside a section Step 3 rewrote, then re-run the audit on that entry until it reports none there
- Report a finding in a section Step 3 left alone as `⚠ Audit: <rel>, <finding>`, since the rule above keeps unrelated sections as they are
- Report a refusal as `⚠ Audit: <message>` and continue

## After completion

Read `${CLAUDE_SKILL_DIR}/references/completion-report.md` before printing anything, for the line each outcome prints, the lines Step 2 and Step 4 add, and when the closing line is suppressed.
