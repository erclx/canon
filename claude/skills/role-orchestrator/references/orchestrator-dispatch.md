---
title: Orchestrator dispatch runbook
description: The plan-answer gate, the collision check before a self-dispatch, the file-set disjointness gate, the branch and model the launch names, the fallback to a human launch, and the loop's stopping condition
---

Run this at loop step 4, for a `## Run now` row whose plan is verified, in place of handing the worktree to a human. The disjointness gate below is where that row's file set is tested against every track in flight.

## Derive the candidate

Run `canon tasks plan-branch <plan> --json` against the row's plan file and read `branch`, `type`, `slug`, and `conforms` off the record.

- `conforms: true`: take `branch` as the candidate, and take `type` and `slug` from the same record for the check below.
- `conforms: false`: the plan's own filename breaks a cap in `${CLAUDE_SKILL_DIR}/../../standards/branch.md`. Report which, and hand the row to the human-launch line below rather than shortening the slug here. A rename parts the branch from the plan filename that `session-worktree` tier 1 and `git-pr`'s plan lookup both read back.
- `reason: archived`, `no-plan`, or `bad-input`: the row does not cite a live plan. Repoint the row or fix the citation rather than dispatching, since `auto-ship` Step 1 refuses the same file and the worker would meet that refusal after the launch spent.
- Anything else, including a record carrying no `branch` key and an installed binary carrying no `plan-branch` subcommand: treat the candidate as unverified rather than clear, name which reading could not be taken, and fall back to the human-launch line below. Re-deriving by prose here rebuilds the defect the verb closes, and does it quietly.

Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

The worker calls the same verb on the same plan at `auto-ship` Step 0, so the branch this gate checks and the branch that session takes are one string by construction rather than two readings of one paragraph. Two readings of one plan part on the slug and on the type alike, and a check against a branch nobody uses verifies nothing.

The type the verb reports is fixed at `feat` whatever the row does, which is the half of the derivation that disagreed most. What makes that safe is that a branch type is cosmetic: `git-stage` reads a commit's type off the staged diff and `git-pr` reads a title off the diff, so nothing a release reads passes through the branch name. What it costs is a worktree listing where every dispatched branch reads `feat/`, which a person scanning one loses. Nothing renames it later, since `git-branch`'s conventions guard fires on a conforming `feat/` before reaching any type judgment.

## Check the plan waits on nobody

Run `canon tasks plan-answers <plan> --json` and read `launchable` off the record.

- `launchable: true`: the plan answers itself, so proceed to the branch check.
- `launchable: false`: the row is not dispatchable. Report every entry in `open`, each carrying the question label and the reason its suggestion gave for needing a person, and hand the row to the human-launch line below. Never fill the slot on the operator's behalf, which is the one move the plan standard forbids outright.
- `reason: archived`: the row's plan sits in `.canon/plans/archive/` and describes work that already shipped. Repoint the row at a live plan rather than dispatching, since `auto-ship` Step 1 refuses the same file and the worker would meet that refusal after the launch spent.
- The command refuses for any other reason, or the record carries no `launchable` key: treat the row as unverified rather than clear, name what could not be read, and fall back to the human. A gate that reads nothing and proceeds is the gate not running.
- The same read also refuses a plan still staging its batches in one file with `**Batch N**` sub-headings. That reports as an entry in `open` labeled `Batch staging`, so a staged plan reads as `launchable: false` the same way an unanswered operator call does, and the row waits on a split rather than on the operator.

Branch on `launchable` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero and so read a held row as a clear one.

This gate runs ahead of the two collision checks because it is the cheapest reading of the three, needing no roster and no ref, and because it is the only one asking about the row itself rather than about what else is in flight. A row nobody can launch does not need testing against the tracks already out.

It also reads the plan rather than a cell describing one, which is the input the gate below it does not have. The disjointness gate compares the sets a dispatcher wrote into the constraints and the Touches column, so a cell omitting a file clears a check the tree would fail, and what catches it then is a worker's message rather than any check.

A blank `- Answer:` is not an unanswered question. `${CLAUDE_SKILL_DIR}/../../standards/plan.md` fixes an empty slot as accepting the `- Suggested:` line above it, which is what makes a plan decision-ready in one pass. The narrow case this reads is `- Suggested: needs your call, <why>` and its two demonstrated paraphrases, `needs operator's call` and `needs the operator's call`, over an empty slot, the form that same standard writes where the answer turns on preference rather than on a technical default. A gate reading every blank slot as open would refuse every plan in the folder.

What it prevents is a halt nobody is watching for. `role-worker` instructs a session to stop on a question written as needing the operator's call, correctly and by its own body, so a dispatch that never reads the plan lands a worker in a wait for a person who does not know it is waiting. The worker's halt is not the defect, and the dispatch that made it necessary is.

## Check the branch is unclaimed

Run `canon sessions list --branch <type>/<slug> --json` and read `claimed` off the record.

- `claimed: true`: the row is not free. Report what holds it, `worktree` when it names a path, `sessions` when it carries a row, and `refs` when the branch already exists. Move to the next candidate rather than colliding.
- `claimed: false`, `sessionsReadable: true`, and `refsReadable: true`: proceed to the disjointness gate.
- `claimed: false` with either flag false, or the command refuses, or the record carries no `claimed` key (`reason` reads `no-registry` or `no-repository`): treat the candidate as unverified rather than clear. Report which reading could not be taken and fall back to the human-launch line below. Dispatching on a check that could not be read reproduces the exact collision this exists to prevent.

Reading `claimed` off the record is what keeps this a check rather than a rule a session can talk itself out of. The field is already the composed answer across the worktree listing, the live session roster, and the refs that name the branch, so nothing here re-derives the OR.

`refs` is the reading that catches a shipped row. A branch behind a merged pull request has no worktree and no session, so the check answered clear on one until a worker refused the instruction and named the consequences: a second pull request against a head GitHub already shows merged, a row whose pull-request line points at two numbers, and the `ambiguous` refusal `canon tasks archive` documents.

What the ref read cannot see is a branch pushed from another machine since the last fetch, because it reads the remote-tracking ref rather than the remote. Nobody has hit that, and a `git ls-remote` per dispatch costs 0.438s against 0.001s, so the gap is recorded rather than closed.

## Hold what this pass already launched

A worker registers with `branch: main` and the main worktree as its `cwd` until `auto-ship` Step 0 moves it, which took several seconds on both measured runs. Neither the roster nor the refs name the candidate during that window, so a second check inside it reads clear.

Keep the branch of every row this pass has launched and treat a candidate matching one as claimed, without re-running the check. That closes the window for this dispatcher and only for it. A second dispatcher in another session reads git and the roster alone, sees none of this record, and can still take the same row. Say so when reporting, rather than implying the window is shut.

## Check the file sets are disjoint

No count binds this. List the files the candidate's plan touches, from its `**Files to touch:**` lines, against the file set of every track already in flight, read off the Touches column of each row on the board. Dispatch when the sets are disjoint and hold the row otherwise.

The board is not the whole set. A track a person launched by hand carries no row, so that column cannot see it, which is the ordinary shape whenever the operator is launching rather than dispatching. Read `canon sessions list --json` for the branches in flight, and take the file set of any branch no row names from the plan that branch is building. A candidate cleared against the board alone is cleared against a partial reading.

Take the comparison at the file path rather than at a folder above it. `canon tasks validate` compares the paths each row wrote, so a collision it reports on a folder means a row's Touches cell claimed that folder rather than the verb widening anything. A cell naming a bare folder collides with every row writing a file under it, which reads as the verb comparing path segments too coarsely and is not.

The finding names which row contributed the containing path, and a bare-folder cell reports as a claim of its own beside the findings. Read that output as a candidate list, settle each pair by file, and narrow the cell that over-claimed rather than discounting the collision it caused.

A declared set is what a branch sets out to write rather than a bound on it, so this gate clears against a prediction and the branch outgrows it hours later. A track can cross the set it cleared against and still merge clean, which is a gate reporting disjoint while a real overlap stood. Two classes account for nearly all of the crossing. The ship chain's own steps write past every plan, since `canon:context-fold` refreshes whichever context entry a change reaches and `canon:docs-sync` reaches the public docs, and neither surface is one a planner can name before the change exists. The drift stages `bun run check` regenerates and asserts are the second, together with the test and sandbox siblings a source change drags in. Nothing here prevents either, because the files at issue are written long after this gate clears. What reads the other end is `canon tasks plan-reach`, which `canon:git-ship` runs at step 5 against the branch's own diff, so a crossing this gate could not see is named before the pull request opens rather than after it merges.

Disjointness is necessary and not sufficient, so hold a candidate whose sets do not touch when a stated reason serializes it, and write the reason on the hold. One row creating a skill and another auditing that catalog and counting it write nothing in common, and dispatching both still leaves the audit counting a denominator that moves underneath it. Nothing verifies that a reason was written, so the rule holds only while the dispatcher applies it.

What binds past that is review attention rather than a count, and `## Parallelism` in the skill body states it along with the cap an operator can set for a session. The one number this skill carries is the review fallback's count of three in `orchestrator-review-fallback.md`, which moves a review rather than binding a track, and this runbook carries none.

## Pick the model

A `claude --bg` session inherits the model of whatever launched it rather than reading the machine's configured default. An orchestrator on the larger model therefore spends it on every worker it launches, and the operator who set the default never sees the override.

Name `<model>` on the launch, and pick it against the task rather than copying whatever this session happens to run. Sizing the model to the row is the dispatcher's call, the same call it already makes on the branch. A mechanical row moving files under a written plan is not the row that needs the largest model, and one whose plan carries an open judgment is.

## Dispatch

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-launch.md` once every check above clears, and launch from its build template. It also holds the review-address and planning shapes, which skip the checks above.

## Fall back to the human

Hand the row to the human-launch line in step 4 instead of dispatching when any of these hold, and name which one: the plan still waits on the operator, the plan-answer read could not be taken, the collision check refused, the row's file set overlaps a track already out, or a stated reason holds the row behind one.

The first of those five is the one that reaches a person rather than the board. A row held for a collision or for a serialize reason waits on the wave clearing, where a row held on its plan waits on an answer only the operator can give, so hand that one over with the question label and its stated reason attached rather than as a name and a refusal.

Hand the person one command: `/canon:auto-ship <plan>`, naming the row, the plan path, and the branch together, with no worktree call ahead of it. A leading worktree call adds nothing beyond what `auto-ship` Step 0 already reaches for itself. A second command also risks a client folding two commands into one message, which reads everything after the first command's name as its own argument and drops the second, per `### Position zero` in `orchestrator-launch.md`.

Suggest, as one line to the operator, that they rename their own session to the row's id, so a process listing shows what the session is for without a cross-reference to the board.

## Stop the loop

Wrapped in `/loop`, re-run the check against `## Run now` on each wake. Stop rather than firing again once the group is empty or every row in it reads `claimed: true`. Report that once, on the wake that finds it, and let the loop end rather than continuing to poll a board nobody is clearing. `orchestrator-poll.md` already carries this reasoning for the review trigger, and it binds a dispatcher the same way.
