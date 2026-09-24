---
name: codebase-layout
description: Carries the rules that decide where a new file goes, when a folder splits, and when a file moves from its one consumer to shared code, so a plan places each new path by role and feature with a one-clause reason rather than beside its nearest neighbor. Use when a plan names a file or folder that does not exist yet, when `plan-feature` reaches its placement step, or when asked "where should this file go", "this folder is flat", "restructure this folder", or "should this be its own folder". Do NOT use to choose which layer a test belongs at, which is `test-craft`, or to shape a module's interface and seams.
---

# Codebase layout

A session placing a new file copies the folder next to it, so a flat folder stays flat until a refactor pays to split it. In one target, two source folders grew to 46 and 36 flat files under installed rules against it, and the split cost a pull request touching 98 files. This skill carries the placement call to the moment the path is written, which is the one moment it is cheap.

Load it before writing a new path into a plan, not after. A worker copies the path the plan gives it, so the placement is settled once the plan is.

Skip it when every path the work names already exists.

## Read the project's strategy first

- Name the layout the project already uses before placing anything: by feature, by route, by role, or flat. Look at the folders a new file would sit beside and at any stated rule on layout.
- Keep to that strategy. A second strategy beside the first costs every later reader a guess about which one a file follows.
- Propose a strategy change as its own decision, never as a side effect of placing one file.

## Group what changes together

- Put files that change for the same reason in one folder, and separate files that change for different reasons.
- Name a folder for what it holds for a reader, being a feature, a route, or a role, over its technical kind alone. `checkout/` tells a reader what is inside where `helpers/` does not.
- Never create a bucket named `misc`, `common`, `utils`, or `helpers` on its own. Qualify it by what it serves, or place the file with its consumer.

## Split before the file lands

- Split a folder when the new file brings a second role into it, before the file lands rather than in a later refactor. The split that touched 98 files would have touched a handful when the folder held eleven.
- Treat roughly ten files as a prompt to look, not a gate. A folder holding one role can stay flat at any size, and a folder mixing two roles is worth splitting at six.
- Give a new role a named folder in the plan, rather than dropping its first file beside the nearest neighbor.

## Place a file with its consumer

- Colocate a new file with the one module that uses it.
- Promote it to shared code when a second consumer arrives, and move it in the change that adds that consumer.
- Keep imports flowing one way, from shared code toward features toward the app entry. A shared module importing from a feature, or one feature importing another, names a file in the wrong place.

## State the reason on every new path

- Give each new path in a plan a one-clause reason for where it sits: the role it holds, the consumer it serves, or the strategy it follows.
- Name a new folder in the plan entry that creates it, so the worker creates the folder rather than inferring it.

## Read the reference for the category

Read the reference matching what the new paths hold, and skip the rest.

- Application source for an interface: `${CLAUDE_SKILL_DIR}/references/frontend.md`
- Test files of any layer: `${CLAUDE_SKILL_DIR}/references/tests.md`

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records which external layouts were adopted, which were declined, and why.

## What this delegates

- Which layer a test belongs at: `test-craft`. This skill decides where the test file sits once its layer is chosen.
- Where a new path gets written into a plan, and the plan's shape: `plan-feature` and the plan standard
- The directory principle every session loads: `000-constitution`
- Runner, suffix, and top-level test folder conventions per language: `300-testing-ts`, `330-testing-py`, `335-testing-go`, and `336-testing-php`
