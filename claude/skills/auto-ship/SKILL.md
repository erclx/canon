---
name: auto-ship
description: Chains implement → verify → review → ship after a feature plan is approved. Reads the plan the caller names, the plan a named task points at, or the plan for the current branch when none is named, runs the full pipeline in one session, and stops on any failure or non-minor review finding. Use when asked to "autoship", "ship this feature end to end", or "run the chain". Do NOT auto-trigger. Requires an approved plan file.
disable-model-invocation: true
---

# Auto ship

Chain the post-plan pipeline in a single run. Every step has a stop condition. State is always recoverable on stop: code lives on the branch, review output on disk, plan still linked.

## Guards

- All `.canon/plans/` and `.canon/review/` reads resolve at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does.
- Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. This skill takes the stop rather than the `latest` fallback, since it commits and opens a pull request. If empty, stop: `❌ Detached HEAD. Checkout the feature branch first.` This slug is provisional. It is superseded once `session-worktree` runs, whether at Step 0 or before this chain began. Every later step keys its output on the slug that run resolves, being the worktree, the review receipt, and the branch, regardless of which plan Step 1 reads.
- Resolve `<plan>` in Step 1, ahead of any other read.
- If the working tree has uncommitted changes unrelated to the plan, stop: `❌ Uncommitted changes outside the plan. Commit or stash before autoshipping.`

## Diff baseline

Step 6 classifies the changed-file list to decide whether review runs. Resolve the base ref once:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Prefer `origin/main` over local `main`. A local `main` trailing the remote pulls other people's merged commits into the list, so the classifier decides against files this branch never touched.

The baseline is unusable when no merge base resolves against either ref. Stop: `❌ No diff baseline against main. Fetch origin, then re-run autoship.`

The base equalling HEAD stays usable here, unlike in the four read-only siblings carrying this section. Step 6 runs before anything is committed, since `git-stage` commits at Step 8, so the base equals HEAD on every ordinary run. The classifier diffs the base against the working tree rather than against HEAD, which keeps the uncommitted work in the set at correct scope. Do not port the sibling `base == HEAD` stop into this skill.

## Step 0: take the role, then enter a worktree

Invoke `canon:role-worker` first, whatever the worktree state. This session is about to build one branch under one plan, and that skill states the boundaries, the lifetime, and the channel obligations the role carries. A dispatched worker reaches the role here and nowhere else, since the launch names this chain rather than the role, and a hand-launched one reaches it on the same path.

Report it rather than proceeding silently when `canon:role-worker` does not resolve. It ships with the plugin, so a session running this chain from a project holding the CLI alone builds with no role asserted.

If `git rev-parse --git-dir` equals `git rev-parse --git-common-dir`, the session is in the main worktree. Invoke `canon:session-worktree` before continuing, carrying the argument the subsection below derives. The wrapper handles branch alignment. Do not call `EnterWorktree` directly.

If neither command resolves, stop: `❌ Not a git repository. Autoship needs git or a WorktreeCreate hook.`

If the two commands differ, the session is already in a linked worktree. Continue.

### Name the worktree from the plan rather than leaving it to be derived

This step runs ahead of Step 1, so what it holds is the raw invocation argument rather than a resolved plan. When that argument is a plan path or a bare slug, run the verb on it and hand the result to `canon:session-worktree` as its tier 0 argument:

```bash
canon tasks plan-branch <argument> --json
```

- `conforms: true`: pass the record's `branch`, which is already `<type>/<slug>`, and invoke nothing else to derive a name.
- `conforms: false`: the plan's own filename breaks a cap in `${CLAUDE_SKILL_DIR}/../../standards/branch.md`. Pass `branch` anyway and say the cap it broke, since the alternative is a name this session shortened by hand, which is a second derivation and the thing this call exists to prevent. `git-branch` decides the rename at ship.
- Anything else, including a refusal, a record carrying no `branch` key, and an installed binary carrying no `plan-branch` subcommand: invoke `canon:session-worktree` bare and let its ladder derive the name. Say the verb did not answer, so a reader can tell a derived name from a fallback one.

The dispatch runbook runs the same verb on the same plan to pick the branch its collision check clears, so calling it here is what makes the checked branch and the taken branch one string. Deriving a name from `<plan>` by reading it was the alternative, and it is what produced three strings for one plan across four dispatches on 2026-09-05.

A caller that supplied a task path, or supplied nothing at all, has no plan to hand the verb here, since resolving either is Step 1's work and Step 1 has not run. Invoke `canon:session-worktree` bare in both cases. That is the ladder unchanged rather than a regression, and it leaves the hole open: a dispatched worker reaching this step through a task path derives its name from a tier rather than from the plan the dispatcher checked.

## Step 1: read the plan

Resolve `<plan>` in this order, stopping at the first match:

1. **Caller-supplied task.** The invocation carried a path under `.canon/tasks/`. If it does not resolve to a file, stop: `❌ No task at <path>. Path was supplied, not derived, so check it and re-run.` Read that task's first `Plan:` line and take what it names as `<plan>`, per `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`.
2. **Caller-supplied plan.** The invocation carried something else. Accept it as a plan path or a bare slug, in the same position `session-worktree` tier 0 accepts its name. A bare slug resolves to `.canon/plans/feature-<slug>.md`, and a path is taken as given from the main worktree root. If it does not resolve to a file, stop: `❌ No plan at <path>. Path was supplied, not derived, so check it and re-run.`
3. **Derived.** `.canon/plans/feature-<slug>.md`, from the `<slug>` the Guards derived. If it does not exist, stop: `❌ No approved plan at .canon/plans/feature-<slug>.md, where <slug> was derived from the current branch, <branch>. The invocation carried no argument, so pass a plan or a task path, or run /plan-feature first.`

Only a path reaches tier 1, and a bare slug is read as a plan's throughout. The two would collide on any similar name, and a caller who means the task holds its path already, having read it off the board. One plan per task is what makes the tier 1 read unambiguous, so it takes the first `Plan:` line and never scans for a second.

Read the target out of the link's parentheses, and take the rest of the line when the line carries no link, since an older task writes the target as a plain path with nothing around it. Resolve a relative target against the directory holding the task file rather than against `.canon/tasks/`, and take a project-root target from the root. The archived task is what makes that base matter, since the standard points its line at `../../plans/archive/feature-<slug>.md` once the task sits a folder deeper, and reading that from `.canon/tasks/` lands on a repository-root `plans/archive/` that never exists.

### When a tier fails

Tier 1 stops on three failures, and each names a different repair:

- No `Plan:` line at all. Stop: `❌ <path> carries no Plan: line, so nothing there names a plan to run. Write the plan and point the task at it, or pass the plan path directly.` A row still awaiting a plan is the ordinary case, so the message names the missing pointer rather than the missing plan sections a reader would then go hunting for.
- The pointer resolves into a plans archive. Stop: `❌ <path> points at an archived plan, which describes work that already shipped. Reopen the task against a live plan, or pass that plan directly.` Test the resolved path rather than the task's outcomes or its `Pull request:` line, since a stale board gets its ticks wrong and the standard fixes where a shipped pointer lands.
- The pointer resolves to no file. Stop: `❌ <path> points at <target>, which does not exist. The citation is stale, so repoint the task or pass the plan path directly.`

An archive is `.canon/plans/archive/` and also the two older spellings `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` leaves in place for a project that archived plans before the folder nested, written from a task as `../plans-archive/` and `../.tmp/plans-archive/`. Test all three, since a shipped pointer in a project nobody migrated lands on the older two. Run the archive test ahead of the existence test, so a pointer into an archive that no longer holds the file still refuses as shipped work rather than as a stale citation.

Each tier fails for a different reason and says so. A supplied path resolving to nothing is a typo, a derived path resolving to nothing is a plan nobody wrote, and a task pointer resolving to nothing is a stale citation the board should have caught.

Test the shape of whatever `<plan>` resolved to before reading it as one. A file resolving under any tier can still be the wrong document, and tier 1 resolves through a pointer rather than from the caller, so the test runs after all three rather than guarding a supplied path alone.

Check for a `**Files to touch:**` or `## Files to touch` marker per `${CLAUDE_SKILL_DIR}/../../standards/plan.md`, the one section every plan carries structurally and a task never does, where `## Outcomes` and `## Findings` are the task's own. If neither form is present, stop: `❌ <path> carries no plan sections. A plan lives at .canon/plans/feature-<slug>.md, and a task reaches one through its Plan: line only from .canon/tasks/. Point autoship at either and re-run.`

Read `<plan>` at the main worktree root. This file is the scope for this run.

Its sections and its answer contract are fixed by `${CLAUDE_SKILL_DIR}/../../standards/plan.md`. A blank `- Answer:` accepts the `- Suggested:` line above it, so an unanswered question is a decision this run executes rather than a reason to stop. When this run decides against that suggestion, rewrite the `- Suggested:` line as `overridden at execution to <pick>,` plus the measurement, leaving the `- Answer:` slot blank, and put the same deviation in one line under the open task's `## Findings`, per `${CLAUDE_SKILL_DIR}/../../standards/plan.md`.

## Step 2: implement

Implement only what the plan describes. Do not expand scope. Do not refactor neighbors. Do not touch files outside the plan's "Files to touch" list without reason.

## Step 3: verify

Run the verify commands defined in `CLAUDE.md` (lint, typecheck, tests). On failure:

- Make **one** fix attempt targeting the reported errors
- Re-run only the failing command
- If it still fails, stop: `❌ Verify failed after one fix attempt. Review logs and retry manually.`

Do not loop. Do not bypass hooks.

## Step 4: test order

Run `canon gov test-order --json` from the worktree this chain is building in, which is the one tree holding the branch's own commits. The Guards send a `.canon/plans/` and a `.canon/review/` read to the main worktree root and this is not one of those: that checkout sits on the trunk on an ordinary run, so the range closes on itself there and every finding the branch carries reads as clean.

The verb reads git history rather than the working tree, so a branch with nothing committed yet reads as clean, and what it catches is a violation that already reached this branch's history in an earlier session or an earlier round of this chain. It reports and never gates, since nothing wires its exit into a push, so branch on the record's `kind` and its `findings` array rather than on the exit, which reads 2 on a finding and 1 on a refusal and which a shell function wrapping `canon` can flatten to zero either way.

- `kind: 'measured'`, `findings` empty. Nothing on the branch reached history ahead of its test. Continue to Step 5.
- `kind: 'measured'`, `findings` non-empty. Report each pair's `subject` and `reason` to the user and continue to Step 5. Do not stop the chain and do not attempt a fix: the commit already reached history, and rewriting it here rewrites what an earlier run shipped rather than what this run is building.
- `kind: 'unreadable'`. Report the `message` and continue to Step 5. A shallow clone or a repository with no trunk is an ordinary state this check cannot read, not a reason to stop shipping.

### When the verb is absent

The verb ships with the CLI and this body ships with the plugin, matching Step 6's own fallback for the classify verb. Report that the check did not run rather than reading a missing subcommand as clean, and continue to Step 5.

## Step 5: UI checklist (conditional)

If the diff touches UI files (JSX, TSX, Vue, Svelte, HTML, or CSS under `src/`), invoke `canon:ui-checklist`.

If `ui-checklist` produces a checklist, stop: `❌ UI requires visual verification. Checklist at .canon/tmp/handoff/ui-checklist/<slug>.md, which reaches the pull request once /git-ship runs. Verify manually, then run /git-ship.`

The stop is unchanged by that skill's shrink. The checklist is now the step's whole output rather than the visual remainder beside the tests it wrote, so the stop is the only thing that makes the operator look before `git-ship`.

If there is nothing to verify visually and nothing shipping untested, continue.

## Step 6: review

Classify the diff first. Take the union of `git diff --name-only <base>` and `git ls-files --others --exclude-standard`, resolving `<base>` per Diff baseline, then hand that set to the verb rather than reading it against the list below yourself:

```bash
canon autoship classify --json <path>...
```

The verb reads names only and touches git not at all, so the set stays the one this step already computed and no second baseline resolves to disagree with the first. Branch on the record's `decision` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

- `skip`. Every path reads as prose and none states agent behavior. Skip review entirely and continue to Step 8.
- `review`. Invoke `canon:review-branch`. The record names the `file` that decided it and the `test` it failed, `extension` for a path that is not prose and `behavior-path` for prose that states what an agent does.
- `refused`, carrying reason `no-changes`. The changed set was empty, so take the stop below.

Say in the run which of the two decided, the verb or the written fallback, since a reader otherwise cannot tell a classification from a judgment.

An empty list stops the chain: `❌ No changed files to classify. Re-run when the plan has yet to produce its output. When the output is gitignored by design, autoship cannot ship it, so take the work out of the chain.` An empty list satisfies the prose-only test vacuously, so reading it as prose-only routes the branch past review instead of through it.

The two causes want different responses. A plan that has yet to produce its output is a re-run once it has. A plan whose output is gitignored by design, such as a read pass writing to `.canon/tmp/`, is work the chain cannot carry at all, since `git-stage` finds nothing to commit six steps later. Never advise removing the output from `.gitignore`, which trades a stopped run for scratch committed into the repository.

### When the verb is absent

The verb ships with the CLI and this body ships with the plugin, so a target holding an older binary meets a missing subcommand. Apply the written test by hand there, and say the fallback decided it.

Never read an absent subcommand as a skip. Failing open is the exact defect the verb closes, and a shell that answers `command not found` reaching a body that skips on anything other than a `skip` record would ship every branch unreviewed.

The skip needs both tests to pass: every changed file matches `*.md` or `*.txt`, and no changed file sits under a behavior path. On a pass, skip review entirely and continue to Step 8. Otherwise invoke `canon:review-branch`.

Behavior paths carry two spellings, the one a surface authors at and the one it reaches a session at, so the rule reads the same in a toolkit and in a project that consumed one:

- `claude/skills/` and `.claude/skills/`
- `governance/rules/` and `.claude/rules/`
- `standards/`, which is the authoring root and reaches a reader by resolution rather than by an install, so it carries no `.claude/` spelling
- `snippets/`, which reaches a session through the `claude/snippets` symlink rather than an install, so it carries no `.claude/` spelling either
- `internal/` and `tooling/`, which hold the stack references and the seed documents a target is handed
- `CLAUDE.md` at the repository root, named as a file because a path prefix reaches nothing that sits in no folder

Markdown under one of them states what an agent does, so a change there is a behavior change wearing a prose extension. Everything outside them is informational, which keeps `docs/`, `README.md`, and `CHANGELOG.md` skipping without naming them. One behavior file sends the whole branch to review, since documentation shipped beside a behavior change does not cancel it.

Informational prose is already gated by `docs-sync`, `standards-audit`, and pre-push hooks. Running a code-style review on it burns tokens with no signal.

The list covers this toolkit's authoring layout and the layout it installs, which is not every layout. A project keeping executable prose where neither spelling reaches adds the path, and until it does every branch touching it skips review silently.

The verb reads the same set from `src/autoship/paths.ts`, so a path added here belongs there too and a path added there belongs here. Two copies is what the fallback costs, and it stands until a release retires the written half.

## Step 7: evaluate findings

Skip this step when Step 6 skipped review. Otherwise read `.canon/review/branch-<slug>.md` at the main worktree root. Split every finding by origin before parsing the summary line (`X critical, Y should-fix, Z minor`), since the stop exists for a defect the branch inherited rather than for one this run introduced.

- **This run caused it, at any severity.** Fix it, re-run the Step 3 verify commands, re-read the fixed file against what the finding claimed, and continue. Do not report it as a stop and do not offer the fix as a choice, which is the same stop wearing a proposal.
- **It predates this run, critical or should-fix.** Stop: `❌ Review found non-minor issues that predate this run. See .canon/review/branch-<slug>.md. Fix and run /git-ship.`
- **It predates this run, minor only.** Continue. The minor findings stay in the on-disk review receipt. Fold any a reviewer needs into the PR's `## Technical Context`. Do not add a separate review-notes section to the PR body.

Read origin as causation rather than authorship. Staleness this run induced in a file it never opened is a finding it caused, and the plan's "Files to touch" list scopes what the run builds rather than what it may repair.

Bound the repair at one pass, the way Step 3 bounds verify. When that re-read shows the finding still standing, stop: `❌ A self-introduced finding survived one fix pass. See .canon/review/branch-<slug>.md. Fix and run /git-ship.`

This chain owns the receipt's lifetime, which is what makes the Output block's citation resolve on a run that reaches it. `docs-fold` used to delete the current slug's receipt while running under Step 8 below, so the closing line named a file the same run had already removed. That sweep now reaches only reports whose branch is gone, which collects this one a branch later rather than during the run that wrote it. The cost is one `branch-<slug>.md` receipt per live branch left in `.canon/review/`, bounded by the branch count rather than by the lifetime of the checkout.

## Step 8: ship

Invoke `canon:git-ship`. That body owns the sequence, being the verify gate, memory capture, both doc syncs, staging, the commit grouping, the branch rename, the pull request, and the CI watch, along with the reason each step sits where it does. This step used to restate that list and the two drifted apart with nothing comparing them, so read the order there and never here.

One thing this chain adds. Mark the pull request as a draft as soon as `git-ship`'s pull request step returns, ahead of its CI watch, then read the flag back:

```bash
gh pr ready --undo <number>
gh pr view <number> --json isDraft
```

Name the number `git-ship`'s pull request step returned on both calls rather than leaving either to resolve by branch. `${CLAUDE_SKILL_DIR}/../git-pr/REQUIREMENT.md` states why: a lookup that resolves by branch alone can return a closed pull request sharing that head, so the number is resolved once and reused rather than re-derived.

Report what the read returned rather than what the command printed, since the exit says the call ran and says nothing about the state. A `true` reports a draft. A `false` reports the pull request as opened ready and unsupervised, and the chain stops there. Never re-issue the undo on a disagreeing read, which fights whoever readied it instead of guarding anything.

Placement is why the call sits ahead of the watch rather than after it. Marking afterwards leaves the pull request unmarked for the whole CI run, which is the stretch an unattended worker's branch is least supervised. What the mark buys is a reader learning the pull request has had no review yet. It buys no bound on that stretch: readying a pull request to merge lifts the mark, GitHub requires it before a merge, and the act belongs to the operator or to the controlling session that closed the review, whichever it is, taken directly on the pull request rather than delegated to a worker. `role-worker` states the mirroring refusal.

`git-ship` verifies again at its own gate, which repeats this chain's Step 3 on the run where nothing stopped. That cost is deliberate: four of the stop points in the table below hand the run straight back to that body, and a gate the chain skips for being redundant is a gate no resumed run ever meets.

## Output

Respond with up to four lines:

```plaintext
✅ Autoshipped (<state>): <PR url>
<N minor findings kept in .canon/review/branch-<slug>.md>
<N facts routed to context entries>
<N memories captured in .canon/memory/>
```

`<state>` is whatever the Step 8 read returned, being `draft` or `ready, unsupervised`, rather than the state the undo asked for. Writing the word `draft` there unconditionally is what this line used to do, and it named a state no step had read.

Omit the second line if there were no minor findings, and the third if nothing routed. Omit the fourth if `memory-capture` wrote no memory file this session. A run that routes every fact and writes none is the shape to expect, and it reports three lines.

This block replaces the one `git-ship` closes on rather than following it. The two carry the same two trailing lines and differ on the two above them, since the first names the state the read returned and the second reports the minor findings Step 7 kept, neither of which that body has a counterpart for. Emitting both reports one run twice and buries the state under a `✅ Shipped` that does not name it.

## Failure recovery

Every stop point leaves recoverable state. The user resumes manually from the appropriate step.

| Stop point                                 | Recovery                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| No plan (derived)                          | Run `/plan-feature` to create one                                                                                                               |
| No plan (caller-supplied)                  | Check the path or slug passed to autoship, then re-run                                                                                          |
| No task (caller-supplied)                  | Check the task path passed to autoship, then re-run                                                                                             |
| Task carries no `Plan:` line               | Write the plan, point the task's `Plan:` line at it, then re-run                                                                                |
| Task points at an archived plan            | The work already shipped. Reopen the task against a live plan, or pass that plan's path directly.                                               |
| Task's `Plan:` pointer resolves to nothing | Repoint the task's `Plan:` line at the plan that exists, then re-run                                                                            |
| Resolved file carries no plan shape        | Point autoship at a plan under `.canon/plans/feature-<slug>.md` or at a task under `.canon/tasks/`, then re-run                                 |
| No diff baseline                           | Fetch origin so a merge base resolves against `main`, then re-run autoship                                                                      |
| Empty changed-file list                    | Re-run once the plan produces tracked output. Ship gitignored output outside the chain, never by tracking it.                                   |
| Branch collision on worktree entry         | `session-worktree` Step 5 found `<slug>` already as a local branch. Resolve manually (rename or delete the stale branch), then re-run autoship. |
| Verify fails                               | Read logs, fix manually, run `/git-ship`                                                                                                        |
| UI checklist                               | Verify visually, run `/git-ship`                                                                                                                |
| Inherited review findings                  | Fix findings, run `/git-ship`                                                                                                                   |
| Self-introduced finding survived           | Read the receipt for what the one repair pass left open, fix it, run `/git-ship`                                                                |
| git-ship fails                             | Inspect hook or remote error, run again                                                                                                         |
