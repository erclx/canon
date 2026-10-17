---
title: Dispatch
description: The self-dispatch that launches a background worker for a Run now row, its plan-answer, branch, and conflict gates, how the worker is named and addressed, and what binds concurrency
---

# Dispatch

## Decisions

### The self-dispatch

Step 4 of the loop can launch a background `claude --bg` worker itself for a `## Run now` row, rather than only naming the invocation for a human. `orchestrator-dispatch.md` holds the procedure, which runs five steps in order.

- Derive the candidate branch with `canon tasks plan-branch <plan> --json`
- Check the plan with `canon tasks plan-answers <plan> --json` and the branch with `canon sessions list --branch <branch> --json`
- Run the conflict check against every track in flight, then dispatch from the template in `orchestrator-launch.md`

Spawning a worker with the Agent tool stays forbidden, since an in-process subagent cannot be steered or reached independently. The `claude --bg` process has its own worktree and pull request, which the boundary protects.

A cloud session can take the build instead, and `canon/context/claude-internal/orchestration/cloud-dispatch.md` carries that shape.

### The plan-answer gate

This gate runs ahead of the other two and is the only one reading the row rather than the tree. `canon tasks plan-answers` reports `launchable`, and where that is false it names each open question with its label and the reason its suggestion gave for needing a person.

It closes the failure `canon/context/claude-internal/orchestration/planning.md` records under a blank answer, where a guard testing only for the plan file admits a plan whose open question needed a person.

### What counts as open

An empty `- Answer:` accepts the suggestion above it, per `claude/skills/plan-feature/references/plan.md`, so treating every blank slot as open would refuse the whole folder. The gate reads one shape.

- `- Suggested: needs your call, <why>` over an empty slot, plus its two demonstrated paraphrases, `needs operator's call` and `needs the operator's call`
- `src/tasks/answers.ts` takes the block through the same `readQuestions` the plan validator runs, so the two never hold different definitions of a question
- `src/records/validate.ts` owns `OPERATOR_CALL` and `normalizeOperatorCall`, and `answers.ts` imports both. An exact-prefix match would clear a paraphrase as `launchable: true`.

A write-time `operator-call-phrasing` finding in `checkQuestionContract` catches a paraphrase in the session that wrote it, and `canon records validate plans` reports it before dispatch. The normalization stays two spellings of `operator`, so a fifth variant can still slip both reads.

A question with no suggestion stays the validator's `suggestion-missing` finding. The runbook dispatches a verified plan, and testing it here would put one rule on two surfaces shipping on different cadences. The verb reads the `Questions` section rather than the file, so a plan discussing the phrase in its `Risks` does not refuse itself.

### Resolving the plan reference

A reference resolves against the project root first and the board directory second. A board row writes its link relative to `.canon/tasks/`, so a dispatcher copying it has `../plans/feature-<slug>.md`, which the root alone resolves above the repository and reports as a missing file.

- `resolveLivePlan` reads a task's own line against the same two bases but takes the board first and accepts a candidate only under the live plans folder
- `planCandidates` takes the root first and tests containment nowhere, so the two agree on every spelling a board writes and part company outside them
- `planAnswers` refuses a plan in the archive as `archived`, since it answers every question and would report launchable while `auto-ship` Step 1 refuses it as shipped work

### The branch gate

The branch check reads `claimed` off its own record rather than composing readings itself. A pre-composed field keeps the check a verb the model cannot talk itself out of. `src/sessions/claim.ts` joins the session roster against `listWorktrees()` and `branchRefs()` in `src/git/worktree.ts`.

Three readings are needed because a worktree can outlive its session and a session can hold a branch before a worktree exists. A branch behind a merged pull request has neither and is taken anyway, so a check on the first two sends a worker onto a used branch.

### How branch refs are read

`branchRefs()` reads the local head and the `origin` remote-tracking ref in one `git for-each-ref`.

- `git show-ref --verify` exits 128 for a missing ref and for a non-repository alike, so a half match and a failed read are one answer
- `for-each-ref` exits zero with empty output for absent and non-zero only for a failure, the separation `refsReadable` reports
- Neither sees a branch pushed from another machine since the last fetch. `git ls-remote` was left out at 0.438s against 0.001s for the local read.

Each reading that can fail carries its own flag, so `refsReadable` sits beside `sessionsReadable`. Without one, an absent registry leaves `claimed` covering the worktree half alone, indistinguishable from a clear branch. Merging the flags rebuilds that defect, since a dispatcher told the roster failed goes and looks at the roster.

### One derivation for the branch

Both sides derive the branch through one verb, since each deriving its own from the same prose disagrees on slug and type, and two dispatches for one plan produce different strings.

`canon tasks plan-branch <plan>` in `src/tasks/branch.ts` is the derivation. The dispatcher uses it, and `auto-ship` Step 0 runs it on the same `<plan>` and hands the result to `session-worktree` as its tier 0 argument, so the checked and taken branch are one string.

- `planBranch` and `planAnswers` share `resolvePlanReference` in `src/tasks/answers.ts`

### The branch type is a constant

Determinism is what makes two sides agree, and grading a plan's prose is the judgment that disagrees. A constant is safe because the type is cosmetic, since `git-stage` and `git-pr` read theirs off the diff and nothing a release reads passes through the branch name.

- `git-branch` does not correct a wrong type, since its second guard stops on a name already following conventions
- `claude/skills/git-branch/references/branch.md` makes the type vocabulary an axis without making the choice within it one
- It does rename a description past the word or length cap, which is a stated axis

### Where the derivation falls short

The verb does not close the fallback. A target whose binary lacks `plan-branch` derives by prose on both sides, and a caller reaching Step 0 through a task path has no plan to hand it yet.

The launch window is closed by a rule rather than a reading. A worker registers on `main` until Step 0 moves it, so no reading names the candidate for those seconds. The dispatcher holds the branches it launched this pass and treats a match as claimed.

- A second dispatcher sees git and the roster and nothing of that record, so the runbook states which case it covers

### The launch names the model

A `claude --bg` session inherits the launching session's model, so an orchestrator on a larger one silently spends it on every worker. One test sizes the model, the larger one where a wrong result is costly and nothing automatic would catch it, applied to planner, worker, and both reviewers.

Sizing by folder sends a one-line rule edit over a folder nothing reads to Opus reviewers. Sizing by plan length sends a Sonnet worker to a plan that goes three review rounds. Both read a proxy for the cost of a miss.

### How a worker is named and addressed

A self-dispatched worker's name carries the prefix `worker-` rather than naming the launcher. A launcher prefix breaks any rule reaching a controller by scanning the roster, which returns a sibling or the sender. The comment in `scripts/watch.ts` keeps the `orchestrator-` spelling because it describes that mistake.

The launch carries an identity, not a name. The dispatcher interpolates its own `sessionId` from `canon sessions list --self --json`, and the worker resolves a current name from that id at send time.

- `nameSource` reads `derived` on 279 of 327 records
- Nine of the 181 records stamping both `nameSince` and `startedAt` took their name after launch, median 5.4 minutes and maximum 509. Three passed ten, inside the announce window.
- `-n` is passed explicitly anyway, since a derived name falls back to an identifier fragment, which agent view prints whole at 34 to 42 characters

### The last hop reads a third surface

A name is not unique. Two live sessions can hold one, the roster carries no field separating them, and a bare send reaches whichever the channel resolves first.

- The agent listing prints a ref beside each row, so a name matching more than one live row is completed from it
- Two rows differing by a trailing ` (3)`, one a controller, is the usual shape

Asking sits above inferring on the worker's ladder. With an operator present, the candidate rows go through the structured question surface and the session halts, which costs less than sending to the wrong session. With nobody there, the inference rung takes sessions holding no feature branch, since a controller holds none, and never a name prefix.

### What binds concurrency

A row holds behind a track in flight only on a conflict a merge cannot settle, being a dependency, a contract one changes and the other consumes, a relocation, a sweep, or a stated reason. `orchestrator-dispatch.md` states these once with their sources. What binds past that is review attention.

A shared file is not a hold. Both build, and the branch merging second resolves any conflict after the first lands, which is how Fowler, DORA, and GitHub's merge queue run parallel work.

- The rejected alternative was a file-set disjointness gate. It ran six ready canvas rows one at a time though they shared only docs paragraphs and appended tests.
- A trial merge cannot replace it at dispatch, since a candidate has no commits, so `git merge-tree` stays at integration
- The cost is more rebases and a contract hold resting on the dispatcher reading a plan's Risks by hand

### What binds and what costs

`## Parallelism` carries what binds, and its `references/orchestrator-inbound.md` carries what costs. A cross-session message arrives as a new turn carrying the orchestrator's whole context, and a recurring poll bills that window again, so a wave's spend tracks the controller's context rather than the work coming back.

`crossSessionInbound` is the only control and stays unset, since `hold` and `refuse` both break the worker handback and `accept` bounds nothing. The section states the conclusion beside the cost, because a lever named without it reads as available to pull.

### Granularity reads wrong in `sharesPath`

`sharesPath` in `src/tasks/validate.ts` collides a row naming a directory with a row naming a file inside it on purpose, since an intersection over the written strings would miss that overlap. A `Touches` cell claiming a bare folder such as `src` collides with every row under it.

- The imprecise half is the cell rather than the verb, and the finding names the claiming row
- A bare folder also reports as a `claims` entry beside the findings, moving no exit code
- A row rewriting a whole directory has no other way to say so, and a measure failing on a legitimate cell teaches readers to skip it

### Policy phrasing and the worker prefix

The `worker-` prefix separates a dispatched worker from an operator's launch in a listing, since only a self-dispatch writes it. It carries no count.

A grep on the policy phrase undercounts the surfaces stating it. The shared-file rule was spelled in the orchestrator body, its requirement, five runbooks, two workflow docs, and this entry, and also as `wiring seam`, `serialize`, and `shared file`, which a grep on `disjoint` misses. Re-grep all four after any change to the policy.

## Gotchas

### A task argument resolves an ambiguous plan

`session-worktree` Step 2 asks the user when more than one `feature-*.md` plan exists and the branch matches none. An `auto-ship <task-file>` argument carries what that step lacks, since the plan's Constraints cite the task file. Matching it against each candidate resolves the ambiguity.

### A branch name carrying the token git

The worktree-isolation guard on Bash refuses `git branch -m`, `git checkout -b`, `git rev-parse --verify`, or `git symbolic-ref` when the ref-name argument holds the literal token `git` bounded by `-` or `/`. It reports "this command names git more than once", or "too complex to verify" for an escaped or quoted form.

A ref-file rewrite through the Write tool is refused too, since it resolves under the shared main-root `.git`.

- This fires on any plan whose slug has "git" as a hyphen-bounded segment, which a git-tooling plan here routinely does, and it blocks `session-worktree` Step 5's rename in any form
- Rename the plan file, re-derive the branch from the new path with `canon tasks plan-branch`, then take a fresh `git checkout -b <name>` off the target commit
- A name with no "git" token clears the guard and keeps plan filename, slug, and branch in agreement

### One branch per run, whatever batches a plan declares

`auto-ship` builds and opens exactly one branch and one pull request per invocation. A plan stating stacked batches gets built one at a time, the first independent batch first, with the remaining outcomes left open for a later invocation.

- A batch stuck on the board after its predecessor merged under the shared branch name cannot dispatch its next one

`claude/skills/plan-feature/references/plan.md` forbids the `**Batch N**` shape. A staged batch takes its own plan file and states its dependency in its own `**Constraints:**`.

- `canon records validate plans` flags a plan still carrying the shape as `batch-unsplit`
- `canon tasks plan-answers` reports it `launchable: false` with an `open` entry labeled `Batch staging`, so the gate refuses the row before a worker is spent
- A plan stacked on a live sibling it mostly shares files with reads the same way, as a `Stacked sibling` entry, and waits on a fold
