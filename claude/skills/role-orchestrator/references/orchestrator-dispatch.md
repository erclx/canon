---
title: Orchestrator dispatch runbook
description: The plan-answer gate, the collision check before a self-dispatch, the conflict check against the tracks in flight and the evidence it rests on, the branch and model the launch names, the fallback to a human launch, and the loop's stopping condition
---

Run this at loop step 4, for a `## Run now` row whose plan is verified, in place of handing the worktree to a human. The conflict check below is where that row is tested against every track in flight, and it is the one statement of what holds a row there.

## Contents

- [Derive the candidate](#derive-the-candidate)
- [Check the plan waits on nobody](#check-the-plan-waits-on-nobody)
- [Check the branch is unclaimed](#check-the-branch-is-unclaimed)
- [Hold what this pass already launched](#hold-what-this-pass-already-launched)
- [Check for a conflict with the tracks in flight](#check-for-a-conflict-with-the-tracks-in-flight)
- [Pick the model](#pick-the-model)
- [Pick local or cloud](#pick-local-or-cloud)
- [Dispatch](#dispatch)
- [Fall back to the human](#fall-back-to-the-human)
- [Stop the loop](#stop-the-loop)

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
- An entry labeled `Stacked sibling` means the plan stacks on a live sibling it mostly shares files with, so the row waits on a fold into that sibling or on a `Judged apart from` constraint line, and not on the operator.

Branch on `launchable` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero and so read a held row as a clear one.

This gate runs ahead of the two collision checks because it is the cheapest reading of the three, needing no roster and no ref, and because it is the only one asking about the row itself rather than about what else is in flight. A row nobody can launch does not need testing against the tracks already out.

It also reads the plan rather than a cell describing one, which is the input the gate below it does not have. The conflict check reads the sets a dispatcher wrote into the constraints and the Touches column, so a cell omitting a renamed or relocated path clears a check the tree would fail, and what catches it then is a worker's message rather than any check.

A blank `- Answer:` is not an unanswered question. `${CLAUDE_SKILL_DIR}/../../standards/plan.md` fixes an empty slot as accepting the `- Suggested:` line above it, which is what makes a plan decision-ready in one pass. The narrow case this reads is `- Suggested: needs your call, <why>` and its two demonstrated paraphrases, `needs operator's call` and `needs the operator's call`, over an empty slot, the form that same standard writes where the answer turns on preference rather than on a technical default. A gate reading every blank slot as open would refuse every plan in the folder.

What it prevents is a halt nobody is watching for. `role-worker` instructs a session to stop on a question written as needing the operator's call, correctly and by its own body, so a dispatch that never reads the plan lands a worker in a wait for a person who does not know it is waiting. The worker's halt is not the defect, and the dispatch that made it necessary is.

## Check the branch is unclaimed

Run `canon sessions list --branch <type>/<slug> --json` and read `claimed` off the record.

- `claimed: true`: the row is not free. Report what holds it, `worktree` when it names a path, `sessions` when it carries a row, and `refs` when the branch already exists. Move to the next candidate rather than colliding.
- `claimed: false`, `sessionsReadable: true`, and `refsReadable: true`: proceed to the conflict check.
- `claimed: false` with either flag false, or the command refuses, or the record carries no `claimed` key (`reason` reads `no-registry` or `no-repository`): treat the candidate as unverified rather than clear. Report which reading could not be taken and fall back to the human-launch line below. Dispatching on a check that could not be read reproduces the exact collision this exists to prevent.

Reading `claimed` off the record is what keeps this a check rather than a rule a session can talk itself out of. The field is already the composed answer across the worktree listing, the live session roster, and the refs that name the branch, so nothing here re-derives the OR.

`refs` is the reading that catches a shipped row. A branch behind a merged pull request has no worktree and no session, so the check answered clear on one until a worker refused the instruction and named the consequences: a second pull request against a head GitHub already shows merged, a row whose pull-request line points at two numbers, and the `ambiguous` refusal `canon tasks archive` documents.

What the ref read cannot see is a branch pushed from another machine since the last fetch, because it reads the remote-tracking ref rather than the remote. Nobody has hit that, and a `git ls-remote` per dispatch costs 0.438s against 0.001s, so the gap is recorded rather than closed.

### A cloud worker's claim

A cloud worker never appears in the roster and never pushes the derived branch, so run the local check above and then the cloud claim in `${CLAUDE_SKILL_DIR}/references/orchestrator-cloud-launch.md` before a cloud dispatch.

## Hold what this pass already launched

A worker registers with `branch: main` and the main worktree as its `cwd` until `auto-ship` Step 0 moves it, which took several seconds on both measured runs. Neither the roster nor the refs name the candidate during that window, so a second check inside it reads clear.

Keep the branch of every row this pass has launched and treat a candidate matching one as claimed, without re-running the check. That closes the window for this dispatcher and only for it. A second dispatcher in another session reads git and the roster alone, sees none of this record, and can still take the same row. Say so when reporting, rather than implying the window is shut.

## Check for a conflict with the tracks in flight

No count binds this, and a shared file does not either. Hold a candidate behind a track in flight when any of these five holds, naming the hold and the track, and dispatch it otherwise:

1. Dependency. The row or plan cites the track as something it waits on or builds over, including a stacked slice based on the other's branch.
2. Contract. One plan changes a contract the other consumes, such as an exported signature, a CLI verb's flags or JSON record, a skill step another skill cites, or a config or frontmatter key, read off the changing plan's `**Risks:**`.
3. Relocation. One plan moves, renames, splits, or deletes a path the other writes or reads, which a rebase cannot settle mechanically. Both sides of a rename sit before the colon of a `**Files to touch:**` entry, per `${CLAUDE_SKILL_DIR}/../../standards/plan.md`.
4. Sweep. One plan rewrites a file or folder wholesale, such as a terminology pass or a `canon/context/` reflow, and the other writes inside it.
5. A stated reason, written on the hold: a singleton resource, or tracks interacting where no file reading shows, as a row creating a skill does with one counting that catalog. Nothing verifies the reason, so this hold stands only while the dispatcher applies it.

A shared file with none of the five is not a hold. Dispatch both and name the shared paths, so the merge order and the second branch's rebase are planned rather than discovered. The branch merging second resolves after the first merges, never against a sibling still building, by running `review-address` in the session that built it, whose Step 5 rebases the branch once it no longer merges. A hunk needing a decision the tree does not carry goes to the controller, and a branch no live session holds gets the review-address shape in `orchestrator-launch.md`.

No practitioner source serializes on a shared file. Each builds in parallel and tests at integration, where the merge surfaces a textual conflict and the suite run over the merged result surfaces a semantic one. Fowler's [branching patterns](https://martinfowler.com/articles/branching-patterns.html) have whoever integrates second pull mainline in and check health "even if it's a clean merge", his [Semantic Conflict](https://martinfowler.com/bliki/SemanticConflict.html) names self-testing code as the first defense, [DORA](https://dora.dev/capabilities/trunk-based-development/) keeps branches to a few hours, and GitHub's [merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) tests each pull request against everything queued ahead of it. A candidate has no commits to trial-merge, so `git merge-tree` runs at integration and this check reads what a plan declares.

Read `canon sessions list --json` for the branches in flight as well as the board, since a track a person launched by hand carries no row, and read the plan of any branch no row names. `canon tasks validate` and `canon tasks plan-reach` report the paths two rows share, which is a candidate list for the five holds and the paths the dispatch names. A shared folder means a Touches cell claimed it bare, so narrow that cell rather than reading the folder as a sweep.

A declared set predicts what a branch writes rather than bounding it, since `canon:context-fold`, `canon:docs-sync`, and the regenerated drift stages write past every plan. Such a crossing changes what the second branch rebases over rather than whether a row holds, and `canon tasks plan-reach` at `canon:git-ship` step 4 names it before the pull request opens. What binds past the five holds is review attention, which `## Parallelism` in the skill body states. The one number this skill carries is the review dispatch's count of three in `orchestrator-review-dispatch.md`, which moves a review rather than binding a track, and this runbook carries none.

## Pick the model

A `claude --bg` session inherits the model of whatever launched it rather than reading the machine's configured default. An orchestrator on the larger model therefore spends it on every worker it launches, and the operator who set the default never sees the override.

Name `<model>` on the launch, and pick it against the task rather than copying whatever this session happens to run. Sizing the model to the row is the dispatcher's call, the same call it already makes on the branch. A mechanical row moving files under a written plan is not the row that needs the largest model, and one whose plan carries an open judgment is.

## Pick local or cloud

Dispatch to a cloud worker only on the operator's explicit pick for that dispatch, until three cloud rows have merged. Whether a cloud session is worth its cost is the operator's account to judge, and the review load a cloud pull request adds is unmeasured, so the pick stays a person's until that count gives a reading.

A row qualifies for that pick when its plan carries no open question and touches no surface needing local state, such as the sandbox, the records remote, or a browser. A cloud worker cannot reach any of the three, and it cannot ask the operator mid-build except through a draft pull request.

## Dispatch

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-launch.md` once every check above clears, and launch from its build template. That runbook also holds the review-address and planning shapes, which skip the checks above. A row the operator picked for cloud launches from `${CLAUDE_SKILL_DIR}/references/orchestrator-cloud-launch.md` instead, since the cloud VM shares neither the plugin nor the board with this machine.

## Fall back to the human

Hand the row to the human-launch line in step 4 instead of dispatching when any of these hold, and name which one: the plan still waits on the operator, the plan-answer read could not be taken, the collision check refused, or the row holds behind a track already out under the conflict check, on a dependency, a contract, a relocation, a sweep, or a stated reason. A shared file alone is not on that list.

The first of those four is the one that reaches a person rather than the board. A row held on its branch or under the conflict check waits on the wave clearing, where a row held on its plan waits on an answer only the operator can give, so hand that one over with the question label and its stated reason attached rather than as a name and a refusal.

Hand the person one command: `/canon:auto-ship <plan>`, naming the row, the plan path, and the branch together, with no worktree call ahead of it. A leading worktree call adds nothing beyond what `auto-ship` Step 0 already reaches for itself. A second command also risks a client folding two commands into one message, which reads everything after the first command's name as its own argument and drops the second, per `### Position zero` in `orchestrator-launch.md`.

Suggest, as one line to the operator, that they rename their own session to the row's id, so a process listing shows what the session is for without a cross-reference to the board.

## Stop the loop

Wrapped in `/loop`, re-run the check against `## Run now` on each wake. Stop rather than firing again once the group is empty or every row in it reads `claimed: true`. Report that once, on the wake that finds it, and let the loop end rather than continuing to poll a board nobody is clearing. `orchestrator-poll.md` already carries this reasoning for the review trigger, and it binds a dispatcher the same way.
