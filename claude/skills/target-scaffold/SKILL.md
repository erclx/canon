---
name: target-scaffold
description: Starts a new project on the toolkit from an empty folder. Asks for the stack and the project name, runs the stack's starter through `canon tooling scaffold`, then hands off to `target-setup`. Use when asked to "start a new project", "scaffold a project here", "start a new astro project here", "create a vite app from scratch", or "set up this empty folder". Assumes the `canon` CLI is on PATH. Do NOT use on a folder that already holds files, which is `target-setup`, or to change the stack of an existing project.
metadata:
  family: setup
---

# Scaffold

Starts a project in an empty folder and hands it to `target-setup`. The CLI owns the starter command, the empty-folder test, and the name check, while this skill picks the arguments, runs the verb, and routes on its record. It runs no scaffolder itself. Nor does it name a stack.

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

| Record                                 | Route                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ok: true`                             | Report the `files` it moved, then hand off below                                                             |
| `bad-name`                             | Offer the record's `suggested` name as a subfolder target, and rerun only once the person accepts or renames |
| `not-empty`                            | Route to `/canon:target-setup`, since something landed in the folder after step 2                            |
| `scaffold-failed` or `no-output`       | Report the `message` and the `scratch` folder the verb kept, and stop. Nothing reached the target.           |
| `no-scaffold`, `no-manifest`, or other | Report the `message` and stop, since the catalog read in step 3 and the verb disagree                        |

Never rename the folder or retry with a name the person did not choose, since the folder name becomes the package name.

## Hand off

Invoke `canon:target-setup` with the target as the working folder. Its detect phase now finds the starter's files and resolves the stack from them, so pass it nothing this skill resolved.

- The hand-off is the last step. Install, governance, verify, and indexes all belong to `target-setup`.
- Report the stack, the target, the files the verb moved, and that setup ran, in that order.
