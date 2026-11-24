---
title: AI workflow
description: Overarching AI workflow across domains
category: Agent surface
---

# AI workflow reference

Which tool to reach for, by what you are trying to do.

## Documents

Project docs split across three roots. `canon/` holds what the project authors and commits, `.claude/` holds what Claude Code reads, and `.canon/` holds every gitignored session record.

```plaintext
canon/
├── REQUIREMENTS.md  ← problem, goals, non-goals
├── DESIGN.md        ← visual intent, pointing at the stylesheet (UI projects)
└── context/         ← per-domain narrative loaded on demand via index.md

.claude/
└── rules/           ← path-scoped governance rules, written by canon gov install

.canon/
├── tasks/           ← one file per task with a generated index.md
├── plans/           ← one plan per feature, archived once it ships
└── tmp/             ← deletable scratch
```

A project scaffolded before the move keeps its records under `.claude/`, and every command reads either root. See [target migrations by verb](../migrations/by-verb.md).

Context loads always (`CLAUDE.md` and `canon/REQUIREMENTS.md`), by path (`.claude/rules/` with a `paths:` glob), or on demand (`canon/context/`, found through its `index.md`). Run `canon init` to seed `.claude/`, `CLAUDE.md`, and the rules.

## Scenarios

### Bootstrap a new project

See [target projects](../target/projects.md).

### New feature

Plan and build in session 1, then review and ship in a fresh session 2 when you want a cold reviewer on the diff.

- For a pile of findings, invoke `canon:plan-intake`, for a grown backlog `canon:backlog-triage`, and for open GitHub issues `canon:issue-triage`
- For an unmeasured state with live approaches, invoke `canon:plan-groundwork`
- Invoke `canon:plan-feature`, implement, and run the `CLAUDE.md` commands until they pass
- For UI changes, invoke `canon:ui-checklist`
- Invoke `canon:context-fold` before closing

Session 2 invokes `canon:git-ship` to verify, sync docs, commit by concern, and open the pull request.

### Parallel features

Run independent features in parallel, one worktree and one session each. See [parallel features](parallel-features.md).

### Autonomous ship

On a mature stack, approve the plan and invoke `canon:auto-ship` to implement, verify, and ship in one session.

- It stops on a verify failure after one fix attempt, a verify run past its time limit, or a hook failure, and you resume with `/git-ship --draft`, which keeps the pull request a draft
- Skip it for auth, migrations, security-sensitive changes, or an uncertain plan

### Pick where a row starts

Pick by how much you know. Hand a pile of notes to `canon:plan-intake`, which files one item per finding. When a question needs measuring before anyone can plan it, open `canon:plan-groundwork`. If you can already state the row, go straight to `canon:plan-feature`.

- Run `canon:backlog-triage` first when the backlog has grown and you doubt every row still earns its place
- Run `canon:issue-triage` first when the work sits in open GitHub issues

### One session for a small row, a fan-in for a big one

For a small row, launch `/canon:auto-ship --plan-first <task>`. One session writes the plan, then builds it, and a larger or heavy plan stops before the build. Add `--stop-after-plan` to read the plan before anything is built, and review stays a separate session.

A row too big for one pull request splits into batches that each build in their own session. An integrator merges them into one pull request, as the batches reference of `canon:plan-feature` states.

### Unattended, attended, and talk runs

Ask the orchestrator to run the board unattended, from now or from a time you name, when you will be away. It merges only what you granted before leaving and parks every question meant for you.

- Stay for an attended run when you want the queue moving while you merge
- Ask for a talk session when you want to shape a plan or a build with the session until you end it

### Merge

Run `canon pr merge <number>` once the reviews close and the pull request is out of draft. You can also name the pull request for the orchestrator to merge, or give a standing authorization for the pull requests in flight. The verb squashes with the body's summary as the message.

### Model and effort

A heavier model and a higher effort pay off where a wrong result is costly and no test or gate would catch it, which is what a heavy plan marks. A light plan that pins the fix runs on the lighter pick. The orchestrator makes each pick from the plan's weight, and `role-orchestrator` carries the mapping.

### Review

An independent session invokes `canon:review-pr` once the pull request is open, and the worker answers with `canon:review-address`. A verify failure goes to the session that built it, a design conflict to a new chat session with the plan, and a review finding to the worker.

### UI-heavy project

A UI feature runs the same plan, build, and review loop at any size. See [visual design workflow](visual-design-workflow.md).

## Skills

The [skill map](skill-map.md) and [skill map on request](skill-map-on-request.md) give every plugin skill one row saying when to reach for it.
