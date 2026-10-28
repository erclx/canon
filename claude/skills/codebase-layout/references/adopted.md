---
title: Adopted and declined
description: Which external layout patterns this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record, and a later session extending the skill adds to it rather than re-arguing an item settled here.

A source a bullet rests on is linked once, in that bullet's row of the toolkit's per-bullet ledger at `governance/ledger/skills/codebase-layout/`, which ships outside the plugin. This file names those sources without the link and keeps the catalog-level adopted and declined record, linking only a source no row cites.

## Adopted for placing files

### Group what changes together

Robert Martin's restatement of the single responsibility principle reads "Gather together the things that change for the same reasons. Separate those things that change for different reasons" (The Single Responsibility Principle).

It gives "split by role" a test a planner can apply to a folder, which is whether these files would change together.

### Name folders for the domain rather than the framework

Martin's Screaming Architecture argues the top level should tell readers "about the system, not about the frameworks you used in your system". It is the root of naming a folder for what it holds rather than its technical kind.

### Feature folders, no cross-feature imports, one-way flow

bulletproof-react puts most code under per-feature folders holding only the subfolders each needs, forbids one feature importing another, and enforces a shared, then features, then app direction with an import-path lint rule (project structure).

Adopted as the direction rule in the body and the feature-folder guidance in `frontend.md`, without the mandate.

### Grow in levels and promote on the second consumer

Robin Wieruch grows a project from one file to feature folders, each level triggered by a named event rather than a count, and moves a helper to the shared layer once two or more features need it (React folder structure).

Adopted as the promotion rule in the body and the levels in `frontend.md`.

### Consistency over any one strategy

The Next.js docs call the framework unopinionated about organization, list three strategies, and ask a project to "choose a strategy that works for you and your team and be consistent across the project" (project structure).

Adopted as the body's first section, reading and keeping the project's own strategy.

### Fixtures in modules, page objects on their own

Playwright defines fixtures in dedicated modules that extend the base test, merges them into one module the specs import, and keeps page objects as their own modules (fixtures). Adopted in `tests.md` as the split between specs and support.

## Adopted for closing the body

From `addyosmani/agent-skills@2686b620`, [`docs/skill-anatomy.md`](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/docs/skill-anatomy.md), the Common Rationalizations, Red Flags, and Verification sections.

- Adopted as the three closing sections every practice skill carries
- Each excuse row rebuts a reason a flat folder stayed flat in the target this skill's requirement measures, rather than an objection nobody raised

## Declined

Each item below was read and left out, with the condition that would reopen it where one exists.

### Deep modules and seams

Matt Pocock's [codebase-design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md) skill covers a lot of behavior behind a small interface placed at a clean seam. It answers where a boundary goes in code, not where a file goes on disk.

Absorbing it doubles the skill's scope before the placement problem is shown solved. It becomes a reference only when a plan places files well and still draws a boundary badly.

### A mandated `features/` tree

bulletproof-react's layout, and a stack rule some projects install, put domain code under `src/features/`. Declined as a mandate because it conflicts with keeping the project's own strategy, and a project that never adopted feature folders gains a second strategy rather than a better one.

A stack rule mandating the tree still loads beside this skill in a project that installs it. The two give different answers there until that rule is softened on its own.

### Numbers, fields, and the worker

Three smaller items were declined for the reason each states.

- **A numeric file ceiling.** No source gives a reliable number, and a count fails sixty files of one role that read fine flat. The body triggers on a second role, with about ten files a prompt to look.
- **A required placement field in the plan format.** It would touch every plan, even ones creating nothing, so the body asks a reason per new path. Revisit only if plans still list flat paths.
- **Loading the skill in the worker.** The worker copies the path the plan gives it, so placement is already decided by the time a worker would read this.
