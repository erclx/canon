---
title: Orchestrator output formats
description: The invocation block with its four sections, the three-slot shape every later report opens with, the proof a merge line names, and the rule against a shape for a correction
---

Read this on invocation, before reporting the state of play, and again before any later report.

## On invocation

```plaintext
Orchestrator ready.

Ready to build (hand each to its own worker):

<feature>
  plan: .canon/plans/feature-<slug>.md
  → /auto-ship

<feature>
  no plan yet. A handoff without a plan has no scope
  → /plan-feature here first

In flight (this session's workers, building now):

<session name>  <branch>
  task: <row>, <n> commits, <n> files changed
  Model: <model>
  Effort: <effort>
  Why: <the plan's weight and the role, or no weight stated>

In review (your turn):

PR #<n> <title>
  → /review-pr

Merge order: #<a> before #<b> (shared paths: <files>).

Next: <the single most useful action>
```

Omit any section with nothing in it. Recommend a handoff only for a plan the conflict check in `orchestrator-dispatch.md` holds behind no track already in flight, and name any paths it shares with one.

- The block opens on the board rather than a version, since no committed file states one and a version line would restate the rows, dated by nothing
- Leave a plan out of `Ready to build` once a row in flight names it, since its file stays in `.canon/plans/` for the whole build
- Listing it would recommend handing off work underway, and the conflict check withdraws that only for a reader who knows what is running

### In flight

`In flight` covers the state between the other two, which lasts ten to thirty minutes and is most of what an operator sees once this session dispatches its own workers.

- Read the progress figures off each worker's worktree, since a busy status says a session is alive and nothing about whether it is moving
- Declare the model, the effort, and why on labeled lines under the row, since a dispatcher picks both per row from the plan's weight and the role

## Every later turn

The block above covers invocation alone. A sweep report, a board report, and an analysis each end in something the human decides, so each opens with the same three slots and puts its evidence underneath:

```plaintext
State: <what changed since they last looked>

Decisions:
  1. <one line each, or "none open">

Next: <the single most useful action>
```

Keep the detail below the block and keep it skippable. A decision reached at the bottom of three paragraphs has been buried, which is the failure this shape exists to prevent.

- Reuse the vocabulary above rather than inventing a second one
- Keep a file set on the row claiming it, so the reader can check a hold or a shared-path claim instead of taking it
- Name a session by its launch name in any line sending the operator into it, such as `claude attach worker-frameboard-design-reference-set`, with the id in parentheses
  - A bare id tells the operator nothing about which session it is
  - A rename leaves the launch name matching nothing, so read the current name off `canon sessions list --json` when the line is written
  - `claude rm` takes the id alone, so that line carries the id

## The merge line

A pull request recommended for merge names the proof its evidence comment carries, beside the merge command, since a lift's `ok` says the gates held and nothing about what anyone could look at.

```plaintext
PR #<n> <title>  proof: <screenshots|reel|screenshots and reel|waived|none>
  → canon pr merge <n>
```

Read the slot off `canon pr evidence <number> --json` at the moment the line is written, branching on the record rather than the exit code.

- `screenshots` when the record carries `states`, and `reel` when it carries `reel`
- `waived` when neither is carried and `canon pr lift <number> --check --json` names every listed path under `waived`, quoting no token from the reason
- `none` otherwise, and a pull request with no painted path takes no slot at all

### Gate the line on CI at the tip

Write the line only off `already-ready` or `clear` from `canon pr lift <number> --check --json`, read at the moment the line is written. A ready mark is not a merge-ready one, and `canon pr merge` refuses `ci-pending` on a pull request the mark alone vouched for.

- Read a record whose `gates` carries no `ci` entry as CI unread, which a CLI older than the plugin returns, and write no line on it
- On a `ci-pending` reason, report CI as running and run `canon pr lift <number> --json` with `run_in_background` as the wake, then take a fresh `--check` read and write the line only off that
- On any other refusal, report the reason and write no line, since a stale standing goes back through the poll's rebase handback

### A bot pull request

A release or Dependabot pull request takes no review, so its check read refuses `review-missing` forever, and a lift without `--check` returns it to draft. Never run the non-check lift on one.

- Gate its line on the `ci` entry in `gates` alone, written only when that entry reads `isOk: true`
- On a pending `ci` entry, wake through `gh pr checks <number> --watch --required` with `run_in_background`, then take a fresh `--check` read before writing the line

### An unproven painted pull request

A painted pull request whose slot reads `none` is unproven. Report it as unproven, never as ready, whatever the lift returned, and put the missing proof to the operator as a decision.

- Painted means the record carries a `checklist`, or the check record lists `uncaptured` paths
- A project whose base keeps no captures reads `uncaptured` absent, so a checklist with no stills and no reel is still unproven there
- Send the branch's session back to run `pr-evidence` under the proof check in `orchestrator-review-dispatch.md`, rather than recommending the merge

Write no shape for a correction. A correction is a sentence, and a format for admitting error invites ceremony where plainness is the whole value.
