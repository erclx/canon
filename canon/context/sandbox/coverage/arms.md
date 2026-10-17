---
title: Arms
description: What the board, intake, routing, and standards citation arms prove, the fixture property each rests on, and what each leaves unmeasured
---

# Arms

Each section states what an arm's declaration proves and what it leaves open, so a green verdict reads at its real width. Read the declaration itself in `sandbox/fixtures/<category>/<scenario>/`, which carries the pins, ceilings, and `manual` entries this entry does not restate.

## Decisions

### Reading a verdict

A verdict covers the arm that ran, not the skill.

- A skill with one armed arm and four unarmed ones reports `asserted` while four arms score nothing
- Read `unchecked` beside `asserted` rather than under it, since several arms carry `manual` entries covering what no substring reaches, making `asserted` a denominator rather than the coverage
- A claim that the harness cannot drive something owes one attempt before it is written down, as the `session-worktree` submodule arms show
- An escape naming a file another session edited during the run is read against what the machine was doing before it counts as a finding, so drive board-reading arms while the board is quiet

### Standards citation arms

`claude/ui-checklist` runs against a target holding no slug reference copy, so the plugin root is the only route to the slug transform. It stages a branch carrying a `/`, and the `-` replacement appears in no skill body, so the output filename shows the citation resolved.

- It also asserts `.claude/skills/git-branch/references/slug.md` is absent, so an arm staging a copy of its own goes red where it lands rather than quietly voiding the premise

The arm asserts the exact checklist path, because the checklist is the skill's whole output and a run producing none has produced nothing. Its remaining entries stay `Semantic:`, since which changes land on the visual list and which layer each missing-test line names are the skill's calls.

- Two patterns bite on the format itself, being a box line opening on a route and a box whose action after the colon opens on neither "read" nor "look at"
- The `(taste)` marker stays `Semantic:` too, since whether a change reads as a judgment or an observable fact is the same classification call

### Task board

`claude/task-board.ts` carries the `create` arm and `claude/task-complete.ts` the `archive` arm, because the two paths have disjoint preconditions and one arm running both would assert the second against a tree the first mutated. Both stage the board, since seeds leave `.canon/tasks/` holding only `index.md`.

`canon tasks archive` is a typed verb whose refusals `src/tasks/archive.test.ts` covers, so the archive arm stages a board that satisfies every gate and asserts the successful move. The create path has no CLI verb, so the skill writes the file from `claude/skills/task-board/references/tasks.md` and that arm covers prose with nothing underneath it.

- The create board runs three consecutive versions with no gaps, which forces the next one, and a `.canon/tasks/` reply fragment pins the proposed label
- The archive task carries a `Pull request:` line, which satisfies the work-reached-main check without a remote
- Its `Plan:` line points at a live plan no other task cites, which puts the plan move under assertion
- `priority.md` puts the archived task's row first and a control row second. An `absent` entry cannot express a removed table row, so the arm pins the separator line and the row that follows it.
- Neither arm asserts `.canon/tasks/index.md`, which a hook regenerates, and both leave the main-worktree-root guard in `manual`, since a standalone sandbox has no linked worktree

### Intake

`claude/plan-intake.ts` writes a folder that is gitignored in every target, so no check anywhere reads its shape, and a wrong numbering leaves a record cited for weeks with nothing reporting the drift.

- The `file` arm pins the slug through the invocation, since `paths` and `content` match exact paths
- The numbering is still asserted, because the index links its cluster files and the pattern requires a two-digit number and a domain name in each link
- The `route` arm asserts a refusal. Its three `absent` entries name the folders a wrong turn would create, and the reply pin catches a stop that refuses without naming where the question goes.
- Why the run refused stays in `manual`

## Gotchas

### Checking without an arm

`canon sandbox check <category>:<command>` with no arm asserts nothing on a multi-arm scenario and reports clean. Name the arm in every check call.

### Prompts and arms are joined by convention

The prompt a caller supplies and the arm's assertions are joined by nothing. `Expectation` in `src/sandbox/expect.ts` carries no prompt field, so crossing the prompts of two arms over one tree swaps both verdicts and reports ordinary failures. Each arm's header names the prompt it assumes, which is a convention rather than a check.
