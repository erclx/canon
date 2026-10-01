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

## Name a file for what it covers inside its folder

- Never repeat the folder's name as a file's whole stem or as its prefix. `billing/invoice.md` says what `billing/billing-invoice.md` says with one word fewer in every path that cites it.
- Drop the prefix when a file moves into a subfolder that now states it, and retarget every citation of the old path in the same change.
- Read the stem as the basename up to its first dot, so `checkout/checkout.test.ts` repeats its folder as much as `checkout/checkout.md` does.

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

## Excuses and rebuttals

| Excuse                                                    | Rebuttal                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The neighbors are flat, so one more flat file fits        | The neighbors are how the folder got to 46. Ask whether this file brings a second role.                    |
| The folder is under ten files, so it does not need a look | Ten is a prompt, not a gate. A second role splits a folder at six.                                         |
| Splitting now is a refactor outside this plan's scope     | Splitting before the file lands touches a handful of paths. Splitting later touched 98.                    |
| A `utils` folder is where shared code goes                | Shared code needs a second consumer. Until then the file sits with the one it serves.                      |
| The worker can decide where the file goes                 | The worker copies the path the plan gives it. A path left loose in the plan is placed beside its neighbor. |

## Red flags

- A new path's only reason is that a similar file sits in the same folder.
- A new file's name repeats its folder as its stem or its prefix.
- A new folder is named for a technical kind alone, such as `helpers/` or `common/`.
- A shared module is about to import from a feature.
- The plan writes a file into a folder that does not exist without naming the folder.

## Before handing over

Check every new path the plan or the change names against each line, and fix the path rather than noting it.

- It follows the strategy the project already uses, or the plan proposes the change as its own decision.
- It carries a one-clause reason naming its role, its consumer, or the strategy it follows.
- Its folder holds one role after it lands.
- Its stem names what it covers without repeating its folder.
- A file with one consumer sits beside it, and a file with two sits in shared code.

## What this delegates

- Which layer a test belongs at: `test-craft`. This skill decides where the test file sits once its layer is chosen.
- Where a new path gets written into a plan, and the plan's shape: `plan-feature` and the plan standard
- The pointer here that every session of a code stack loads: `000-code`
- Runner, suffix, and top-level test folder conventions per language: `300-testing-ts`, `330-testing-py`, `335-testing-go`, and `336-testing-php`
