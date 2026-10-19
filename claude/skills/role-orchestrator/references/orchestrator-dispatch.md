---
title: Orchestrator dispatch runbook
description: The plan-answer gate, the collision check before a self-dispatch, the conflict check against the tracks in flight and the evidence it rests on, the branch the launch names, the one model test applied to each role, the fallback to a human launch, and the loop's stopping condition
---

Run this at loop step 4, for a `## Up next` row whose plan is verified, in place of handing the worktree to a human. The conflict check below is where that row is tested against every track in flight, and it is the one statement of what holds a row there.

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

Run `canon tasks plan-branch <plan> --json` against the row's plan file and read `branch`, `type`, `slug`, and `conforms` off the record. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

- `conforms: true`: take `branch` as the candidate, and take `type` and `slug` from the same record for the check below.
- `conforms: false`: the plan's filename breaks a cap in `${CLAUDE_SKILL_DIR}/../git-branch/references/branch.md`. Report which, and hand the row to the human-launch line below.
- `reason: archived`, `no-plan`, or `bad-input`: the row cites no live plan, so repoint the row or fix the citation, since `auto-ship` Step 1 refuses the same file
- Anything else, including no `branch` key or a binary lacking `plan-branch`: treat the candidate as unverified, name the missing reading, and fall back to the human

### Why the verb decides

Never shorten a non-conforming slug here, since a rename parts the branch from the plan filename that `session-worktree` tier 1 and `git-pr`'s plan lookup read back. Re-deriving by prose rebuilds the defect the verb closes, quietly.

- The worker calls the same verb on the same plan at `auto-ship` Step 0, so the checked branch and the taken branch are one string by construction
- Two readings of one plan part on the slug and the type alike, and a check against a branch nobody uses verifies nothing
- The type is fixed at `feat`, which is safe because `git-stage` and `git-pr` read types off the diff and no release reads the branch name
- The cost is a worktree listing where every dispatched branch reads `feat/`

## Check the plan waits on nobody

Run `canon tasks plan-answers <plan> --json` and read `launchable` off the record. Branch on `launchable` rather than on the exit code, which a wrapping shell function can flatten to zero and so read a held row as clear.

- Hold a row whose `Waiting on` has not cleared, which no other check reads
- `launchable: true`: the plan answers itself, so proceed to the branch check.
- `launchable: false`: report every entry in `open`, each with its question label and stated reason, and hand the row to the human-launch line below
- Never fill the slot on the operator's behalf, the one move the plan standard forbids outright
- `reason: archived`: the plan sits in `.canon/plans/archive/` and describes shipped work, so repoint the row, since `auto-ship` Step 1 refuses the same file

### Refusals and staging

A refusal or a staged plan holds the row as surely as an open question.

- Any other refusal, or no `launchable` key: treat the row as unverified, name what could not be read, and fall back, since a gate reading nothing is not running
- A plan still staging batches in one file with `**Batch N**` sub-headings reports an `open` entry labeled `Batch staging`, so the row waits on a split
- A `Fan-in` entry holds a fan-in set, per `batches.md` in `plan-feature`
- A `Stacked sibling` entry means the plan stacks on a live sibling it mostly shares files with, so the row waits on a fold or a `Judged apart from` line

### What the gate reads

This gate runs first because it is the cheapest reading, needing no roster and no ref, and the only one asking about the row itself. It reads the plan rather than a cell describing one, since a cell omitting a renamed path clears a check the tree would fail.

A blank `- Answer:` is not an unanswered question, since `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md` fixes an empty slot as accepting the suggestion. A gate reading every blank slot as open would refuse every plan in the folder.

- The narrow case is `- Suggested: needs your call, <why>` over an empty slot, the form the standard writes where the answer turns on preference
- Two demonstrated paraphrases read the same, `needs operator's call` and `needs the operator's call`

The gate prevents a halt nobody is watching for. `role-worker` correctly stops a session on a question written as needing the operator's call, so a dispatch that never reads the plan lands a worker waiting for a person who does not know it. The dispatch is the defect, not the halt.

## Check the branch is unclaimed

Run `canon sessions list --branch <type>/<slug> --json` and read `claimed` off the record. The field is already the composed answer across the worktree listing, the live roster, and the refs naming the branch, so nothing here re-derives the OR.

- `claimed: true`: report what holds it, `worktree` naming a path, `sessions` carrying a row, or `refs` when the branch exists, and move to the next candidate
- `claimed: false`, `sessionsReadable: true`, and `refsReadable: true`: proceed to the conflict check.
- `claimed: false` with either flag false, a refusal, or no `claimed` key, such as `no-registry` or `no-repository`: treat it as unverified and fall back to the human
- Dispatching on a check that could not be read reproduces the exact collision this exists to prevent

### The refs reading

`refs` catches a shipped row, since a branch behind a merged pull request has no worktree and no session. Without it the check answered clear until a worker refused and named the cost: a second pull request against a merged head, a row citing two numbers, and `canon tasks archive`'s `ambiguous` refusal.

The ref read cannot see a branch pushed from another machine since the last fetch. A `git ls-remote` per dispatch costs 0.438s against 0.001s, so the gap is recorded rather than closed.

### A cloud worker's claim

A cloud worker never appears in the roster and never pushes the derived branch, so run the local check above and then the cloud claim in `${CLAUDE_SKILL_DIR}/references/orchestrator-cloud-launch.md` before a cloud dispatch.

## Hold what this pass already launched

A worker registers with `branch: main` and the main worktree as its `cwd` until `auto-ship` Step 0 moves it, which took several seconds on both measured runs. Neither the roster nor the refs name the candidate during that window, so a second check inside it reads clear.

Keep the branch of every row this pass has launched and treat a candidate matching one as claimed, without re-running the check. That closes the window for this dispatcher alone, since a second dispatcher reads only git and the roster, so say so when reporting.

## Check for a conflict with the tracks in flight

No count binds this, and a shared file does not either. Hold a candidate behind a track in flight when any of these five holds, naming the hold and the track, and dispatch it otherwise:

- **Dependency.** The row or plan cites the track as something it waits on or builds over, including a stacked slice on the other's branch.
- **Contract.** One plan changes a contract the other consumes, such as an exported signature, a verb's flags or record, a cited skill step, or a config key.
- **Relocation.** One plan moves, renames, splits, or deletes a path the other writes or reads, which a rebase cannot settle mechanically.
- **Sweep.** One plan rewrites a file or folder wholesale, such as a terminology pass or a `canon/context/` reflow, and the other writes inside it.
- **A stated reason.** A singleton resource, or tracks interacting where no file reading shows, as a row creating a skill does with one counting that catalog.

Read a contract off the changing plan's `**Risks:**`, and both sides of a rename before the colon of a `**Files to touch:**` entry, per `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`. Nothing verifies a stated reason, so it stands only while the dispatcher applies it.

### A shared file is not a hold

Dispatch both and name the shared paths, so the merge order and the second branch's rebase are planned rather than discovered. The branch merging second resolves after the first merges, never against a sibling still building.

- It resolves by running `review-address` in the session that built it, whose Step 5 rebases the branch once it no longer merges
- A hunk needing a decision the tree does not carry goes to the controller
- A branch no live session holds gets the review-address shape in `orchestrator-launch.md`

### The evidence

No practitioner source serializes on a shared file. Each builds in parallel and tests at integration, where the merge surfaces a textual conflict and the suite over the merged result a semantic one.

- Fowler's [branching patterns](https://martinfowler.com/articles/branching-patterns.html) have the second integrator pull mainline in and check health "even if it's a clean merge"
- His [Semantic Conflict](https://martinfowler.com/bliki/SemanticConflict.html) names self-testing code as the first defense, and [DORA](https://dora.dev/capabilities/trunk-based-development/) keeps branches to a few hours
- GitHub's [merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) tests each pull request against everything queued ahead of it
- A candidate has no commits to trial-merge, so `git merge-tree` runs at integration and this check reads what a plan declares

### Reading the tracks

Read `canon sessions list --json` for the branches in flight as well as the board, since a hand-launched track carries no row, and read the plan of any branch no row names.

- `canon tasks validate` and `canon tasks plan-reach` report the paths two rows share, a candidate list for the five holds and the paths a dispatch names
- A shared folder means a plan declared it bare, so narrow that plan's list rather than reading the folder as a sweep
- A declared set predicts rather than bounds, since `canon:context-fold`, `canon:docs-sync`, and the drift stages write past every plan
- Such a crossing changes what the second branch rebases over, not whether a row holds, and `canon tasks plan-reach` at `canon:git-ship` step 5 names it

What binds past the five holds is review attention, which `## Parallelism` in the skill body states.

## Pick the model

This section binds every launch shape that names `<model>`, the planner and both reviewers as well as the step 4 build, none of which pass through that step.

A `claude --bg` session inherits the launching session's model, so an orchestrator on the larger model spends it on every launch. Name `<model>` on each with one test: `opus` where a wrong result is costly and nothing automatic would catch it, `sonnet` otherwise, never `haiku`.

- Read the role's worst failure and whether a test, gate, or review stops it, never the folder or the plan's length
- Planner: `opus` for a row that changes a contract others consume, spans modules, or needs slicing. `sonnet` for a narrow row, even one inside a hook or governance folder.
- Worker, and the review-address pass against the findings in hand: `opus` where the plan leaves a cross-module call tests will not settle. `sonnet` where it pins the fix, however long.
- Code reviewer: `opus` where a miss would ship unseen, a change to behavior no test or gate exercises that other surfaces read. `sonnet` otherwise, a one-line hook edit included.
- UI reviewer: always `sonnet`. A cheaper tier was measured on that checklist and passed real defects as clean while judging taste boxes it was told to leave.

## Pick local or cloud

Dispatch to a cloud worker only on the operator's explicit pick for that dispatch, until three cloud rows have merged. Whether a cloud session is worth its cost is the operator's account to judge, and the review load a cloud pull request adds is unmeasured, so the pick stays a person's until that count gives a reading.

A row qualifies for that pick when its plan carries no open question and touches no surface needing local state, such as the sandbox, the records remote, or a browser. A cloud worker cannot reach any of the three, and it cannot ask the operator mid-build except through a draft pull request.

## Dispatch

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-launch.md` once every check above clears, and launch from its build template, which sits beside the review-address and planning shapes that skip these checks. A cloud row launches from `${CLAUDE_SKILL_DIR}/references/orchestrator-cloud-launch.md`, since the VM shares no plugin or board.

Once the launch succeeds, run `canon tasks promote <stem>`.

## Fall back to the human

Hand the row to the human-launch line in step 4 instead of dispatching when any of these hold, and name which one. A shared file alone is not listed.

- The plan still waits on the operator
- The plan-answer read could not be taken, or the collision check refused
- The row holds behind a track already out on a dependency, a contract, a relocation, a sweep, or a stated reason

The first is the one that reaches a person rather than the board. A row held on its branch or under the conflict check waits on the wave clearing, and one held on its plan waits on an answer only the operator can give, so hand it over with the question label and its stated reason attached.

### The command to hand over

Hand the person one command, `/canon:auto-ship <plan>`, naming the row, the plan path, and the branch together, with no worktree call ahead of it. `auto-ship` Step 0 already enters the worktree.

- A second command risks a client folding two into one message, dropping the second, per `### Position zero` in `orchestrator-launch.md`
- Suggest in one line that the operator rename their own session to the row's id, so a process listing shows what the session is for

## Stop the loop

Wrapped in `/loop`, re-run the check against `## Up next` on each wake, and stop once the group is empty or every row left in it is held. Report that once, on the wake that finds it, rather than polling a board nobody is clearing, the reasoning `orchestrator-poll.md` carries for the review trigger.
