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

- For a pile of findings, invoke `canon:plan-intake`, and for a grown backlog `canon:backlog-triage`
- For an unmeasured state with live approaches, invoke `canon:plan-groundwork`
- Invoke `canon:plan-feature`, implement, and run the `CLAUDE.md` commands until they pass
- For UI changes, invoke `canon:ui-checklist`
- Invoke `canon:context-fold` before closing

Session 2 invokes `canon:git-ship` to verify, sync docs, commit by concern, and open the pull request.

### Parallel features

Run independent features in parallel, one worktree and one session each. See [parallel features](parallel-features.md).

### Autonomous ship

On a mature stack, approve the plan and invoke `canon:auto-ship` to implement, verify, and ship in one session.

- It stops on a verify failure after one fix attempt, or on a hook failure, and you resume with `/git-ship`
- Skip it for auth, migrations, security-sensitive changes, or an uncertain plan

### Review

An independent session invokes `canon:review-pr` once the pull request is open, and the worker answers with `canon:review-address`. A verify failure goes to the session that built it, a design conflict to a new chat session with the plan, and a review finding to the worker.

### UI-heavy project

A UI feature runs the same plan, build, and review loop at any size. See [visual design workflow](visual-design-workflow.md).

## Skills

The [skill map](skill-map.md) and [skill map on request](skill-map-on-request.md) give every plugin skill one row saying when to reach for it.
