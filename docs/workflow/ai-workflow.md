---
title: AI workflow
description: Overarching AI workflow across domains
category: Agent surface
---

# AI workflow reference

A concise reference for when to reach for which tool, organized by what you're trying to do.

> **Mental model:** Claude Code for everything: planning, implementation, review, docs, git, and release.

## Documents

Project docs split across three roots at the project root. What the project authors and commits lives in `canon/`, what Claude Code reads lives in `.claude/`, and every gitignored session record lives in `.canon/`, which a single ignore entry covers.

```plaintext
canon/
├── REQUIREMENTS.md  ← problem, goals, non-goals
├── DESIGN.md        ← visual intent and token decisions (UI projects)
└── context/         ← per-domain narrative loaded on demand via index.md

.claude/
└── rules/           ← path-scoped governance rules, written by canon gov install

.canon/
├── tasks/           ← one file per task with a generated index.md, local scratch
├── plans/           ← one plan per feature, archived inside itself once it ships
├── memory/          ← durable session facts no context entry owns
└── tmp/             ← deletable scratch, safe to remove without loss
```

A project scaffolded before the move keeps its records under `.claude/`, and every command reads either root. `canon migrate records` moves one project across and repoints what cites it, and `canon migrate record-tree` follows it to reach the citations inside the records themselves, which the first verb passes over because it enumerates through git. A project scaffolded before the surface move keeps its context and loose documents under `.claude/` the same way, and `canon migrate surface-roots` moves those to `canon/` with the history following each file.

Three tiers of context load with different cost: always-loaded (root `CLAUDE.md` and `canon/REQUIREMENTS.md`), path-scoped lazy (`.claude/rules/<scope>.md` with `paths:` glob), and on-demand lookup (`canon/context/<domain>.md`, or `canon/context/<domain>/` once a domain outgrows one file, discovered via `canon/context/index.md`). See [the context model](../../canon/context/context-model/overview.md) for the full picture.

Run `canon init` to seed the `.claude/` directory, a root `CLAUDE.md` file, and `.claude/rules/` in one pass. `canon init` chains claude init and governance install. Claude Code auto-loads every file in `.claude/rules/` at session start, applying always-on rules unconditionally and path-scoped rules to files matching their `paths:` glob.

## Scenarios

### Bootstrap a new project

See [target projects](../target/projects.md) for the scaffold decision, core domains and skips, and the full lifecycle across scaffold, add-a-domain-later, and upstream sync.

### New feature

One session works for most features. Prefer splitting across two sessions only when the feature is large enough that you want a cold, independent reviewer on the diff. Plan and implement in session 1, then review and ship in session 2.

#### Session 1

Work in Claude Code directly. It reads `CLAUDE.md` automatically and has full file access, no pasting needed.

- When the input is a pile of findings rather than one feature, invoke `canon:plan-intake` first. It files the dump into `.canon/intake/<nn>-<slug>/`, one item per finding carrying a problem measured against the tree, a proposed fix, and a verdict, then names which items are plan-ready, which need measuring, and which are already settled.
- When the backlog has grown past what anyone rereads, invoke `canon:backlog-triage`. It files one item per backlog row into an intake folder, suggesting decline, archive, keep, or promote and leaning toward decline, and once `canon:plan-intake-answer` has taken your answers, a second run applies the approved verdicts through the task verbs.
- When the current state is unmeasured and more than one approach is live, invoke `canon:plan-groundwork` first. It opens a track folder under `.canon/groundwork/<nn>-<slug>/` and ends in a decision, which may be to do nothing. Skip it when the approach is already settled.
- Invoke `canon:plan-feature` to scan for code-level conflicts and ambiguities, confirm approach before proceeding
- Implement the feature, then Claude Code runs the commands defined in `CLAUDE.md`, fixes failures, and iterates until all pass
- For UI changes, invoke `canon:ui-checklist` to write what a reviewer has to look at and name any behavior shipping without a test
  End the session once the feature works and tests pass. Invoke `canon:context-fold` to capture any decisions made during implementation before closing.

The routing test is whether the repository can answer an item today. A session grepping handles the yes, and a groundwork track handles the no.

A groundwork track may run experiments to settle a question, writing a fixture it reads itself under `.canon/tmp/runs/groundwork-fixtures/<slug>/` and spawning up to three billed headless runs before it asks. A fixture a headless run is pointed at sits outside the repository, since a session started under the project root inherits that project's `CLAUDE.md` and rules and would measure them instead of the arm.

A spike starts against a sample, bounded on input size, duration, and spend, and scales up once the sample shows the method works. Nothing checks this, so it holds while a session reads the standard.

What a spike leaves behind splits on whether a later reader needs the file to check a claim. Bulk input, such as a large fixture, is re-runnable and cited by nothing, so the scratch path above is the right lifetime for it. Everything a reader opens to verify a result lives inside the track in one of three folders: `evidence/` for a recording or a render, `scripts/` for the arm scripts, and `clones/` for checkouts and copies of outside material a claim rests on. The scratch tree holds only what can be deleted without loss, which none of those is.

#### Session 2

Start a fresh Claude Code session. The diff is sufficient context for ship.

- Invoke `canon:git-ship` to run the project's verify commands, sync docs, commit by concern, rename branch, and open PR

### Parallel features

When features are independent, run them in parallel, one worktree and one session per feature. See [parallel features](parallel-features.md) for the loop in each worktree, the orchestrated flow, and the records and task board every session shares.

### Autonomous ship

For features on a mature stack, chain the post-plan pipeline in one session. Approve the plan, invoke `canon:auto-ship`, and the skill runs implement → verify → ship sequentially.

- Use when the plan is tight and the stack has real verify commands and test coverage
- Autoship stops on: verify failure after one fix attempt, or hook failure
- A produced UI checklist does not stop it. The checklist rides to the draft pull request's evidence comment, and the closing block names how many visual boxes are still unchecked and who owes them
- Every stop leaves recoverable state. Fix and resume with `/git-ship`
- Skip autoship for auth, migrations, security-sensitive changes, or work where the plan itself is uncertain

#### Memory in the chain

`git-ship` runs its verify gate and then opens on `memory-capture`, which sends what the session learned to the surface that owns it. `autoship` reaches the same step by invoking that skill at its Step 6 rather than restating the order. A fact about a domain carrying an entry in `canon/context/index.md` is routed to that entry, and `context-fold` folds it in on the next step, so it ships in the same pull request. Anything no entry owns stays a file in `.canon/memory/`.

Capture leads rather than trails because a routed fact edits a tracked file, which has to reach the branch before the commit steps run.

The chain ends at capture, and nothing curates the pen after it.

### UI polish

Verify the change manually in the browser. Invoke `canon:ui-checklist` if you need a written list of what to look at. For the fix itself, describe the change in Claude Code directly.

### Quick fix

- Verify failure or isolated bug → continue in Claude Code (it has the implementation context)
- Design or planning conflict → escalate to a new Claude chat session with the relevant plan context
- Fast file edit (a task file, config, renaming) → Claude Code directly, no chat needed

### Review

Review runs on the pull request. An independent session invokes `canon:review-pr` once `canon:git-ship` has opened it, and the worker answers what it posts with `canon:review-address`.

### UI-heavy project

Before the first feature session on a UI-heavy project, pick a design tier. The tier determines seed shape, installed MCP servers, and installed plugin skills. See [visual design workflow](visual-design-workflow.md) for the framework and decision guide.

## Skills

The [skill map](skill-map.md) and its sibling [skill map on request](skill-map-on-request.md) give every skill the plugin ships one row saying when to reach for it. The first groups rows by the moment a project meets them, and the sibling holds the skills that answer a request.

## Feedback routing

```plaintext
verify fails  → Session 1 (it has implementation context)
design fails  → new Claude chat session (planning problem)
review finds  → Session 2 (fix alongside review, before ship)
```
