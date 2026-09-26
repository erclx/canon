---
title: Arms
description: What the board, intake, routing, and standards citation arms prove, the fixture property each rests on, and what each leaves unmeasured
---

# Arms

Each section states what an arm's declaration proves and what it leaves open, so a green verdict reads at its real width. Read the declaration itself in `scripts/sandbox/fixtures/<category>/<scenario>/`, which carries the pins, the ceilings, and the `manual` entries this entry does not restate.

## Decisions

- Read a verdict as covering the arm that ran, not the skill. A skill with one armed arm and four unarmed ones reports `asserted` while four arms score nothing.
- Read `unchecked` beside `asserted` rather than under it. Several arms carry `manual` entries covering what no substring reaches, so `asserted` is a denominator rather than the coverage.
- A claim that the harness cannot drive something owes one attempt before it is written down. The runner's defaults are not refusals, as the `session-worktree` submodule arms show.
- An escape naming a file another session edited during the run is read against what the machine was doing before it counts as a finding. Drive board-reading arms while the board is quiet.

## Gotchas

- `canon sandbox check <category>:<command>` with no arm asserts nothing on a multi-arm scenario and reports clean. Name the arm in every check call.
- The prompt a caller supplies and the arm's assertions are joined by nothing. `Expectation` in `src/sandbox/expect.ts` carries no prompt field, so crossing the prompts of two arms over one tree swaps both verdicts and reports ordinary failures. Each arm's header names the prompt it assumes, which is a convention rather than a check.

## Standards citation arms

`claude/review-branch`, `claude/ui-checklist`, and `claude/memory-review` each run against a target holding no standards folder, so the plugin root is the only route to the slug transform. Each stages a branch carrying a `/`, and the transform replacing it with `-` appears in no skill body, so the output filename is evidence the citation resolved. Each also asserts that `.claude/standards/skill.md` and `standards/skill.md` are both absent, so an arm staging a copy of its own goes red where it lands rather than quietly voiding the premise.

`claude/ui-checklist` asserts the exact checklist path, because the checklist is the skill's whole output and a run producing none has produced nothing. Its remaining entries stay `Semantic:`, since which changes land on the visual list and which layer each missing-test line names are the skill's calls, and a pattern cannot tell a correct classification from a lucky one.

## Task board

`claude/task-board.sh` carries separate `create` and `archive` arms, because the two paths have disjoint preconditions and one arm running both would assert the second against a tree the first mutated. Both stage the board rather than inheriting one, since `SANDBOX_INJECT_SEEDS` leaves `.canon/tasks/` holding only the seeded `index.md`.

- `canon tasks archive` is a typed verb whose refusals `src/tasks/archive.test.ts` covers, so the archive arm stages a board that satisfies every gate and asserts the successful move. The create path has no CLI verb, so the skill writes the file from `standards/tasks.md` and that arm covers prose with nothing underneath it.
- The create board runs three consecutive versions with no gaps, which forces the next one, and a `.canon/tasks/` reply fragment pins the proposed label.
- The archive task carries a `Pull request:` line, which satisfies the work-reached-main check without a remote, and its `Plan:` line points at a live plan no other task cites, which puts the plan move under assertion.
- `priority.md` puts the archived task's row first and a control row second. An `absent` entry cannot express a removed table row, so the arm pins the separator line and the row that follows it.
- Neither arm asserts `.canon/tasks/index.md`, which a hook regenerates. Both leave the main-worktree-root guard in `manual`, since a standalone sandbox repository has no linked worktree.

## Intake

`claude/plan-intake.sh` writes a folder that is gitignored in every target, so no check anywhere reads its shape, and a wrong numbering leaves a record cited for weeks with nothing reporting the drift.

- The `file` arm pins the slug through the invocation, since `paths` and `content` match exact paths. The numbering is still asserted, because the index links its cluster files and the pattern requires a two-digit number and a domain name in each link.
- The `route` arm asserts a refusal. Its three `absent` entries name the folders a wrong turn would create, and the reply pin catches a stop that refuses without naming where the question goes. Why the run refused stays in `manual`.

## Operator routing

`claude/canon-operator.sh` drives a skill whose subject is a decision. Each arm pins the skill or command a route names in `reply`, pairs it with a `manual` entry for the negative a substring cannot carry, and asserts over the tree in the direction a correct run leaves it alone.

- A proposal-only skill cannot be covered by tree assertions alone, since a session that did nothing passes every negative one.
- `gitignore` pins what the write produced, the managed entries back in the file and the install stamp as the inject wrote it, which separates the narrow mode from a full inject.
- `fresh` carries no tree pin, because a handoff to `target-setup` may continue into that skill and write the whole scaffold, and no path assertion separates routing from doing. It is reachable only from a real run.
- `unclaimed` pins the reverse walk's attribution rather than a route, since the walk reports a folder the toolkit stopped shipping and offers nothing. Provisioning refuses a CLI whose report attributes no unclaimed folder, which is the two-speed release risk `canon/ARCHITECTURE.md` records arriving in the harness. The refusal names both causes, since reading attribution cannot separate a binary predating the walk from a walk that reached nothing. The declaration pins the dropped folder's name so the fragility sits where a reader sees it.
- Every section of the operator report is gated on `isManagedTarget`, so the fixture stages a short `CLAUDE.md` as the one marker it needs rather than inheriting one from dev-skill injection.

### The audits arm

`audits` stages a target carrying two of the four audit surfaces. A passing run names the scaffold handoff first, offers the two staged audits, withholds the comment scan with a reason, and names `plans` as the only record kind.

`## Route` in the skill carries a measurement row for the audit offers, and the preamble above the table ranks a lifecycle row ahead of them, because a session acting on the lifecycle row never opens the section below it. The arm pins `target-setup` beside the two audit commands to score that ranking. The order between the handoff and the offers stays in `manual`, because a substring set is unordered, and the withheld offer is a negative substring any rephrasing satisfies.

The fixture stages one target shape with nothing installed, so a target shaped differently could rank the rows the other way with no assertion seeing it.
