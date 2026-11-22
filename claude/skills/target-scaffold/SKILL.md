---
name: target-scaffold
description: Starts a new project on the toolkit from an empty folder. Asks for the stack and the project name, runs the stack's starter through `canon tooling scaffold`, then hands off to `target-setup`. Use when asked to "start a new project", "scaffold a project here", "start a new astro project here", "create a vite app from scratch", or "set up this empty folder". Assumes the `canon` CLI is on PATH. Do NOT use on a folder that already holds files, which is `target-setup`, or to change the stack of an existing project.
metadata:
  family: setup
---

# Scaffold

Starts a project in an empty folder and hands it to `target-setup`. The CLI owns the starter command, the stack's post-scaffold step, the empty-folder test, the name check, and the git repository, while this skill picks the arguments, runs the verb, and routes on its record. It runs no scaffolder itself. Nor does it name a stack.

## Steps

1. Resolve the target. The current folder is the default, and its folder name becomes the project name. When the request names a different project name, the target is a new subfolder of that name.
2. Run `ls -A` on the target, where a subfolder that does not exist yet counts as empty. When it lists anything but `.git`, stop and route to `/canon:target-setup`, since the folder is already a project.
3. Run `canon tooling list --json` and offer only the stacks whose `scaffold` is `true`. A stack without a starter is a layer synced onto a project.
4. Resolve the stack. Take one the request named, or ask through the structured question surface with one option per offered stack.
   - With no person present and no stack named, stop and list the offered names rather than picking one
5. Preview the stack, the target, the project name, and the command, then run it:

```bash
canon tooling scaffold <stack> <target> --json
```

## Route on the record

Branch on the record's `ok` and `reason` rather than on the exit, which a shell function wrapping `canon` can flatten to zero.

| Record                                              | Route                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ok: true`                                          | Report the `files` it moved and the `git` field, then hand off below                                         |
| `bad-name`                                          | Offer the record's `suggested` name as a subfolder target, and rerun only once the person accepts or renames |
| `not-empty`                                         | Route to `/canon:target-setup`, since something landed in the folder after step 2                            |
| `scaffold-failed`, `no-output`, or `prepare-failed` | Report the `message` and the `scratch` folder the verb kept, and stop. Nothing reached the target.           |
| `no-scaffold`, `no-manifest`, or other              | Report the `message` and stop, since the catalog read in step 3 and the verb disagree                        |

Never rename the folder or retry with a name the person did not choose, since the folder name becomes the package name.

### The git field

The verb runs `git init -b main` when the target sits in no work tree, so a `target-setup` hook install finds a repository.

- `initialized` reads as a new repository on `main`, holding no commit, since the first commit belongs after setup lands its files
- `existing` reads as a target already holding `.git` or inside a parent repository, which the verb leaves alone rather than nesting a second one
- `failed` reads as an init that exited non-zero. Report it and name `git init -b main` for the person to run, then hand off anyway, since the files already reached the target.

## Hand off

Invoke `canon:target-setup` with the target as the working folder. Its detect phase now finds the starter's files and resolves the stack from them, so pass it nothing this skill resolved.

- The hand-off is the last install step. Install, governance, verify, and indexes all belong to `target-setup`.
- Report the stack, the target, the files the verb moved, the `git` field, and that setup ran, in that order.

## Kickoff note

Run this after `target-setup` returns, whatever its report. It resolves nothing setup detects, and only leaves the project's first session what this session knew.

Write the note only when this session holds context the new project lacks, such as a plan, a groundwork or design record, or a planning conversation behind the request. A bare request like "start a vite app here" carries none, so write nothing and add one line to the report saying no kickoff note was written, since there was no planning context.

1. Read `${CLAUDE_SKILL_DIR}/references/kickoff.md` for the six parts, what stays out, and the template.
2. Write the note to `.canon/tmp/kickoff/next-session.md` at the target root, a scratch slug that never takes the reserved `handoff`.
3. Run `git check-ignore -q .canon/tmp/kickoff/next-session.md` in the target. Delete the note on any non-zero exit, a target with no repository included, since it may cite a private path.
4. Close the report on whichever branch step 3 took, printing the first opening prompt as the last output in a fenced `plaintext` block.
   - Kept: name the note's path, then print the prompt as the template writes it
   - Deleted: print the note's content in place of the path, and open the prompt by telling the operator to paste that content into the session rather than read a file

Seed no task on the new board and write nothing under `.canon/tasks/`. The first rows stay candidates in the note until the new project's orchestrator files them on the operator's word.
