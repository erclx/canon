---
title: Dispatch
description: The self-dispatch that launches a background worker for a Run now row, its plan-answer, branch, and file-set gates, how the worker is named and addressed, and what binds concurrency
---

# Dispatch

## The self-dispatch

Step 4 of the loop can launch a background `claude --bg` worker itself for a `## Run now` row, rather than only naming the invocation for a human to run. `orchestrator-dispatch.md` holds the procedure: derive the candidate branch with `canon tasks plan-branch <plan> --json`, check the row's plan against `canon tasks plan-answers <plan> --json`, check the branch against `canon sessions list --branch <branch> --json`, check the row's file set against every track in flight, then dispatch.

Spawning a worker with the Agent tool stays forbidden, since an in-process subagent cannot be steered or reached independently. The `claude --bg` dispatch is a separate process with its own worktree and its own pull request, which is the property the boundary protects rather than the mechanism it happens to name.

## The plan-answer gate

The plan-answer gate runs ahead of the other two, and it is the only one of the three reading the row rather than the tree. `canon tasks plan-answers` reports `launchable`, and where that is false it names every question still open with the label identifying it and the reason its suggestion gave for needing a person. It closes from the other end the failure `canon/context/claude-internal/orchestration/planning.md` records under a blank answer: a guard testing only for the plan file admits a plan whose open question needed a person.

The blank-answer default is what makes the read narrow enough to gate on. `standards/plan.md` fixes an empty `- Answer:` as accepting the suggestion above it, so a gate treating every blank slot as open refuses the whole folder, and the shapes this reads are `- Suggested: needs your call, <why>` and its two demonstrated paraphrases, `needs operator's call` and `needs the operator's call`, over an empty slot. `src/tasks/answers.ts` takes the question block through the same `readQuestions` the plan validator runs, which keeps this read and the conformance check from holding two definitions of a question.

An exact-prefix match can miss a paraphrase, so a plan whose suggestion reads `needs operator's call` rather than the canonical phrase could clear this gate as `launchable: true` with the question still effectively open. `src/records/validate.ts` owns `OPERATOR_CALL` and a `normalizeOperatorCall` matcher reading both paraphrases as the canonical phrase, and `src/tasks/answers.ts` imports both rather than defining its own copy.

A write-time `operator-call-phrasing` finding in `checkQuestionContract` catches a paraphrase in the same session that wrote it, so `canon records validate plans` reports it before it reaches this dispatch gate. The normalization set stays two spellings of `operator` rather than a general list, so a fifth variant can still slip both reads.

### Resolving the plan reference

The reference a dispatcher hands it resolves against the project root first and the board directory second. Root order leaves the documented spellings untouched and the second base catches the one nobody documented, since a board row writes its link relative to `.canon/tasks/` and a dispatcher copying that reference out of the row it is dispatching has `../plans/feature-<slug>.md` to hand. Resolving that against the root alone lands a directory above the repository and refuses a plan that exists, which a refusal naming one base reports as a missing file rather than as a base that could not answer.

`resolveLivePlan` reads a task's own line against those same two bases and is a different function rather than the same one. It takes the board first and accepts a candidate only under the live plans folder, where `planCandidates` takes the root first and tests containment nowhere, so the two agree on every spelling a board writes and part company outside them. The shared bases buy a board link resolving for both.

The liveness half is stated separately rather than folded into the resolution. `planAnswers` refuses a plan sitting in the archive as `archived`, because it answers every question and would otherwise report launchable while `auto-ship` Step 1 refuses the same file as already-shipped work.

A question carrying no suggestion is a stop at execution too, and it stays the validator's finding rather than becoming this one's. `checkQuestionContract` already reports it as `suggestion-missing`, and the runbook dispatches a row whose plan is verified, so the gate testing it again would put one rule on two surfaces that ship on different cadences. The verb reads the `Questions` section rather than the file, which keeps a plan discussing the phrase in its own `Risks` from refusing itself.

## The branch gate

The branch check reads `claimed` off its own record rather than composing the readings itself. The field already answers across all three, and reading a pre-composed field keeps the check a verb rather than a rule the model can talk itself out of. `src/sessions/claim.ts` is the composition, joining the session roster against `listWorktrees()` and `branchRefs()` in `src/worktree.ts`.

Three readings rather than two. A worktree can outlive the session that made it and a session can hold a branch before a worktree exists for it. A branch behind a merged pull request has neither and is taken anyway, so a check reading only the first two clears it and sends a worker onto a used branch.

`branchRefs()` reads the local head and the `origin` remote-tracking ref in one `git for-each-ref`. `git show-ref --verify` is the obvious instrument and cannot carry the job, since handed two ref paths it exits 128 when one is missing and 128 again when the directory is no repository, so a half match and a failed read are one answer. `for-each-ref` exits zero with empty output for absent and non-zero only for a failure, which is the separation `refsReadable` reports. What neither sees is a branch pushed from another machine since the last fetch, left open at 0.438s for `git ls-remote` against 0.001s for the local read.

Each reading that can fail carries its own flag, so `refsReadable` sits beside `sessionsReadable` rather than folding into either `claimed` or the other flag. Without its own flag, an absent registry leaves `claimed` covering the worktree half alone with nothing distinguishing that from a genuinely clear branch, and a dispatcher reading one boolean cannot tell the two apart. Merging the two flags rebuilds that defect one reading over, since a dispatcher told the roster failed goes and looks at the roster.

### One derivation for the branch

Both sides derive the branch from the plan through one verb rather than either naming it for the other. Each side deriving its own candidate from the same prose disagrees in practice, on the slug and on the type alike, so two dispatches for one plan produce different strings.

`canon tasks plan-branch <plan>` in `src/tasks/branch.ts` is the one derivation. The dispatcher derives its candidate there, and `auto-ship` Step 0 runs the same verb on the same `<plan>` the launch already carries and hands the result to `session-worktree` as its tier 0 argument, so the checked branch and the taken branch are one string by construction. `planBranch` and `planAnswers` share `resolvePlanReference` in `src/tasks/answers.ts`, so the two verbs answer one reference through one resolution ladder.

The type is a constant rather than a reading, since determinism is the property that makes two sides agree and grading a plan's prose is the judgment that disagrees. The constant is safe because a branch type is cosmetic: `git-stage` reads a commit's type off the staged diff and `git-pr` reads a title off the diff, so nothing a release reads passes through the branch name. `git-branch` does not correct a wrong type, since its second guard stops on a name already following conventions and `standards/branch.md` makes the type vocabulary an axis without making the choice within it one. It does rename a description past the word or length cap, which is a stated axis.

The verb does not close the fallback. A target whose installed binary carries no `plan-branch` derives by prose on both sides, and a caller reaching autoship Step 0 through a task path has no plan to hand the verb yet, since resolving one is Step 1's work.

The launch window is the one defect closed by a rule rather than by a reading. A worker registers on `main` in the main worktree until autoship Step 0 moves it, so for those seconds no reading names the candidate. The dispatcher holds the branches it launched this pass and treats a match as claimed, which closes the window for that session alone. A second dispatcher elsewhere sees git and the roster and nothing of that record, so the runbook states which case it covers rather than implying it covers both.

## The launch

The launch names the model. A `claude --bg` session inherits the launching session's model rather than reading the machine's configured default, so an orchestrator on a larger model than the machine's own default silently spends it on every worker. Sizing the model to the row is the dispatcher's call, and it is the one judgment the launch still carries now that the branch travels through a verb.

A self-dispatched worker's name carries the prefix `worker-` rather than naming the launcher. A launcher prefix breaks any rule that reaches a controller by scanning the roster for it: the scan returns a sibling or the sender itself, and no controlling session carries the prefix. The comment in `scripts/watch.sh` keeps the `orchestrator-` spelling deliberately, since it describes that matching mistake.

An identity carried on the launch does the addressing rather than a scan. The dispatcher interpolates its own `sessionId`, read from `canon sessions list --self --json`, and the worker resolves a current name from that id at the moment it sends. A name cannot do that job: `nameSource` reads `derived` on 279 of 327 records, and nine of the 181 records stamping both `nameSince` and `startedAt` took their name after launch at a median of 5.4 minutes and a maximum of 509, three of them past ten minutes and so inside the window a worker announces its pull request in. `-n` is passed explicitly on every dispatch as well, because a derived name falls back to a fragment of the session's own identifier, which serves as both the address and the whole of what an operator sees in agent view.

Agent view renders that name in full rather than truncating it. Names from 34 to 42 characters print whole with no ellipsis, so the dispatch template's `worker-<project>-<slug>` carries no length concern to weigh against the collision the project segment closes.

The last hop reads a third surface, because a name is not unique. Two live sessions can hold one, the roster carries no field separating them, and a bare send reaches whichever the channel resolves first. The agent listing prints a ref beside each row where the roster prints none, so a resolved name matching more than one live row is completed from that listing. Two rows differing only by a trailing ` (3)`, one of them a controller, is the shape this meets in practice.

Asking sits above inferring on the worker's ladder. A session with an operator present puts the candidate rows through the structured question surface and halts, which costs less than sending to the wrong session and reporting success. Where nobody is there to ask, the inference rung takes the sessions holding no feature branch, since a controlling session holds none, and never a name prefix.

## What binds concurrency

The bound is the file-set disjointness test `docs/workflow/operating-model.md` states under `## Parallelism`, compared at the file path rather than at a folder above it, plus a stated reason to serialize a disjoint pair the sets cannot separate. A fixed cap of three concurrent workers was the rejected alternative: a cap reads session names, while the disjointness test reads what those sessions write, so the two never answer the same question. The cost is a bound a dispatcher can talk past, since nothing verifies a serialize reason. Measured at `83fc7fb5` on 2026-08-27, against seven workers dispatched in one afternoon, four concurrent and none colliding.

What binds and what costs are separate readings, and `## Parallelism` carries both. A cross-session message arrives as a new turn carrying the orchestrator's whole accumulated context, and a recurring poll bills that window again on its own interval, so a wave's spend tracks the controlling session's context rather than the work coming back. `crossSessionInbound` is the only control over it and stays unset, since `hold` and `refuse` both break the worker handback and `accept` bounds nothing. The section states the conclusion beside the cost, because a lever named without it reads as available to pull.

Granularity is where the verb reads wrong rather than fails. `sharesPath` in `src/tasks/validate.ts` collides a row naming a directory with a row naming a file inside it on purpose, since an intersection over the written strings would miss exactly that overlap. A row whose `Touches` cell claims a bare folder such as `src` therefore collides with every row writing a file under it, and the imprecise half is the cell rather than the verb. The finding names the claiming row, and a `Touches` cell naming a bare folder reports as a `claims` entry beside the findings, moving no exit code. A row rewriting a whole directory has no other way to say so, and a measure that fails on a legitimate cell teaches a reader to skip it.

The `worker-` prefix separates a dispatched worker from an operator's own launch in a session listing, since only a self-dispatch writes it. It carries no count.

A grep on the policy phrase undercounts the surfaces stating it. `docs/workflow/operating-model.md` carries the policy twice, once in loop step 2 and once in its own `## Parallelism` section, and the second spelling names a number without using the phrase, so a sweep keyed on the phrase leaves it stating a retired rule.

## Gotchas

### A task argument resolves an ambiguous plan

`session-worktree` Step 2 asks the user when more than one `feature-*.md` plan exists and the current branch matches none of them. An `auto-ship <task-file>` invocation carries information that step does not: the plan's own Constraints section already cites the task file it was written for. Matching the autoship argument against each candidate plan's citation resolves the ambiguity without asking, which a worktree entry made in isolation from that argument cannot do.

### A branch name carrying the token git

The Claude Code worktree-isolation guard on the Bash tool refuses a `git branch -m`, `git checkout -b`, `git rev-parse --verify`, or `git symbolic-ref` invocation whose ref-name argument contains the literal token `git` bounded by `-` or `/`, reporting "this command names git more than once" for a plain form and "too complex to verify" for an escaped or quoted one. A direct ref-file rewrite through the Write tool is refused too, since that path resolves under the shared main-root `.git`.

This fires on any plan whose derived slug carries "git" as a hyphen-bounded segment, which a git-tooling plan in this repository routinely does, and it blocks `session-worktree` Step 5's rename regardless of which form the rename takes. Rename the plan file itself and re-derive the branch from the new path with `canon tasks plan-branch`, then take a fresh `git checkout -b <name>` off the target commit rather than renaming onto the blocked name. A name with no "git" token clears the guard and keeps the plan filename, its slug, and the branch name in agreement.

### One branch per run, whatever batches a plan declares

`auto-ship` builds and opens exactly one branch and one pull request per invocation, with nothing splitting a plan's own declared batches across several. A plan stating several stacked pull requests, because a later batch depends on an earlier one, gets built one batch at a time: the worker builds only the first, independent batch and leaves the task's remaining outcomes open for a later invocation against the same plan and task files. A batch stuck on the board after its predecessor merged under the shared branch name cannot dispatch its next batch.

`standards/plan.md` forbids the `**Batch N**` shape outright: a staged batch is a concern of its own and takes its own plan file, stating its dependency on earlier batches in its own `**Constraints:**`. `canon records validate plans` flags a plan still carrying the shape as `batch-unsplit`, and `canon tasks plan-answers` reads a live plan the same way, reporting it `launchable: false` with an `open` entry labeled `Batch staging`, so the plan-answer gate refuses the row before a worker is spent on it rather than after.
