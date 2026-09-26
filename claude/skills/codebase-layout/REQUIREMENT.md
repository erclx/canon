---
name: codebase-layout
description: Why the session writing a new path into a plan needs placement guidance at that moment, and where that guidance stops short of test layers and module interfaces
---

# Codebase layout requirement

## Gap

Without this skill, the session that decides where a new file goes has nothing about layout in front of it when it decides. The planner writes each new path into the plan, the worker copies it, and the planner's only instruction on the tree is to measure against it, which for a new path reads as copying the flat folder beside it.

The failure is measured on a real target. Two source folders grew from 11 files to 46 and 36 flat files in six days, with the constitution's directory line and a stack rule mandating feature folders both installed throughout. The split that followed touched 98 files, and the end to end folder is flat again, four specs beside five helpers. Archived plans from the same project name every new file as a literal flat path.

Sharpening the rules does not reach the decision. Both were loaded and neither was applied, since an always-loaded line competes with everything else a session holds and a path-scoped rule fires on a read of an existing file rather than on a path written into a plan.

## Must

- Be loaded by `plan-feature` whenever a plan names a path that does not exist yet, so the guidance is in front of the planner at the moment it writes the path
- Tell the session to name and keep to the project's existing layout strategy before placing a file, since two strategies in one tree cost every reader a guess
- State the split trigger as a second role entering a folder, with a file count only as a prompt to look
- State colocation with the one consumer and promotion on the second, and imports flowing from shared toward features toward the app entry
- Require a one-clause placement reason on every new path the plan names
- Hold the stack-neutral core in the body and defer category specifics to a reference loaded only when a new path falls in that category
- Record the external layouts adopted and declined with the reason for each, so a later session extends the position instead of re-deriving it
- Fire on a direct question about placement as well, such as where a file goes or whether a flat folder should split, since a session outside any plan still places files

## Must not

- Name a framework or runner in the body. Stack specifics live in the references.
- Carry a hard file-count threshold. A command folder holding sixty files of one role reads fine flat, and a number would fail it.
- Restate the layer rule, the layer table, or the final filter `test-craft` owns
- Mandate one layout across projects, such as a `features/` tree, over the project's own strategy
- Restate the pointer in `000-code`, which loads in code stacks only. The rule points here and this body carries the depth.

## Guards

- A plan that only edits existing files does not load the skill, so the cost lands only where a placement is decided
- A strategy change is proposed as its own decision rather than made while placing one file

## Out of scope

- Which layer a test belongs at: `test-craft`
- Interface depth, seams, and where a module boundary sits in code, which govern a module's shape rather than its path on disk
- Per-language placement conventions such as test suffixes and the top-level test folder: the language testing rules
- Backend, asset, and script layouts, which wait for a driving project before a reference is written
- Whether a plan that loaded the skill actually places files differently, which needs a measured run on a target rather than a rule here
