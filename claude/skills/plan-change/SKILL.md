---
name: plan-change
description: Plans a feature by reading the project's Claude setup and scanning relevant source files. Outputs which files to touch, risks, and ambiguities, then stops. Use before implementing anything, or when asked to "implement X", "add X", "build X", or "I want to add X". Do NOT implement. Plan only.
metadata:
  family: decide
---

# Plan change

## Guards

- If no feature description is provided, stop: `❌ No feature description. Describe what you want to add.`
- Do not implement anything. Output the plan and stop.
- When the feature description spans two or more independent concerns, write one plan file per concern. Bundle them under one slug only as an agreed bundle row.

## Write scope

Write the plan, and nothing else in the tree being planned against.

- A file made only to look at goes to scratch under a topic slug, per `${CLAUDE_SKILL_DIR}/references/onboarding.md`
- A fixture or headless session that must be its own project goes outside the repository, in a temporary directory

### Predict the next three questions

Before Step 3, name the next three questions you would ask about what the ask must achieve, and predict the operator's answer to each. The test reads the ask's success criteria, never the plan's open questions.

Read `### Predicted questions` in `${CLAUDE_SKILL_DIR}/references/plan.md` for where each prediction goes.

## Step 1: read the Claude setup

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: behavior rules, conventions, commands
- `canon/REQUIREMENTS.md`: feature scope and non-goals
- `.canon/tasks/index.md`: current scope and status, then any task file the feature relates to

Also read `canon/DESIGN.md` when the feature touches code or UI, for visual intent and component rules, with values read from the stylesheet its lead names. Skip it for prose, docs, catalog, or config-only changes. For a UI feature, also read `canon/design/index.md` and the group files it links, for the code each accepted design governs.

Coding standards live in `.claude/rules/`. Claude Code loads them automatically, and path-scoped rules apply to the files they match. For a UI feature, load `canon:ui-craft` for how it behaves and `canon:design-taste` for how it looks, whether or not `canon/DESIGN.md` exists.

- Read `${CLAUDE_SKILL_DIR}/references/board-frames.md` for picked board frames
- Onboard to each domain the feature touches before reading its code, through its context entry, per `${CLAUDE_SKILL_DIR}/references/onboarding.md`

## Step 2: run the surface, then scan relevant source files

When the feature changes a verb, a route, or a rendered surface that already exists, run it once before reading its code and record what it showed. Read `onboarding.md` for the safe form per surface kind, the rules that keep the run from writing, and the not-run record.

Read the source files directly relevant to the feature, never whole directories speculatively. Then read the code and any outside source per `## Step 2` of `${CLAUDE_SKILL_DIR}/references/procedure.md`.

## Step 3: build the plan

The section list, what each section holds, and the suggested-and-answer contract are fixed by `${CLAUDE_SKILL_DIR}/references/plan.md`, and the lifecycle by `${CLAUDE_SKILL_DIR}/references/plan-lifecycle.md`. Read it before writing, never from memory, and grade `## Weight` from the code Step 2 read.

Read `## Step 3` of `procedure.md` for what this skill adds on top.

## Pull request boundaries

A plan sequencing its work into batches declares where each pull request ends, since a dependency chain cannot be split once it is built. Read `${CLAUDE_SKILL_DIR}/references/batches.md` when the plan carries more than one batch, for the one-file-per-batch rule, when a dependent batch folds, and the build order. A single-batch plan skips it.

## Step 4: output

Decide the mode based on what Step 3 produced:

- **Small** when the plan touches 2 files or fewer, has no architectural or cross-cutting choices, and both Risks and Questions come out `None identified.` Output the plan to chat and write no file.
- **Full** otherwise

A consumer list is a `Risks` entry, which already forces Full. A resource with more than one consumer, at least one writing, is a cross-cutting choice, so such a plan stays Full even at two files.

Read `${CLAUDE_SKILL_DIR}/references/output.md` for each mode's shape, the checks on a written plan, and the chat output.

- The `.canon/plans/` directory is gitignored, so do not stage or commit the file.
- Do not proceed to implementation until the user explicitly says to continue.

## Discussion rounds

After the plan is written, keep chat output to a decision-help shape, per `## Discussion rounds` in `output.md`.

Read `procedure.md` and `output.md` at the step that uses them on every invocation, never from memory of an earlier plan.
