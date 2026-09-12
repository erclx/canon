---
name: canon-rollout
description: Takes one toolkit change out to every consuming project and brings each to a mergeable pull request. Carries an orchestrator role that enumerates the targets, dispatches a worker into each, reviews every pull request, and routes what each review posts, and a worker role that builds inside one target and answers its review. Use when asked to "roll this out to the targets", "take this change to every project", "run a rollout wave", "update the consuming projects", or when a session was dispatched into a target by a wave. Do NOT use for this repository's own board, which is `role-orchestrator`, and merge nothing.
disable-model-invocation: true
---

# Canon rollout

This skill runs outward. Every other skill for operating on a target assumes the session already sits inside it, and this one starts in the toolkit and reaches the projects the toolkit installed into.

One wave takes one toolkit change to every target and ends with a pull request per target for a person to merge. Two roles carry three phases over one target list. The orchestrator enumerates, dispatches, reviews, and routes. The worker holds one target from the worktree entry to the merge of the branch it opened.

`role-orchestrator` owns this repository's own board and is a different subject. Read nothing from `.canon/tasks/` here and write nothing to it.

## Take a role before anything else

- The invocation or the launch prompt names the worker role, a target path, or both: worker. Skip to `## The worker role` and run no phase above it.
- Neither is named: orchestrator. Run the three phases in order.

The role is read off the prompt because nothing else carries it. A dispatched worker starts in the target's own checkout, which is a repository like any other from the session's side, so a test on the working directory answers the same for a worker in a target and an operator who invoked this from one. Reading the role wrong in that direction starts a second wave from inside a consuming project, which is why the dispatch below names the role and the path both rather than relying on either alone.

Do not invoke `canon:role-worker` from either role. That body states the role for a session building one branch under one plan in this repository, and it resolves session scratch against a main worktree root a target does not carry, so a rollout worker reading it hunts for a plan nobody wrote.

## Guards

- `gh` absent from the path: stop. `❌ gh is not installed, so no target's pull request can be read or opened.`
- `canon targets list` refuses, or reports the index as unknown with no `--sweep` behind it: stop and name the reason. A count of zero taken from an index nothing read is a confident wrong answer.
- Read a record's own `reason` field rather than a command's exit status. An operator's shell profile may wrap `canon` in a function whose status comes from a trailing command, which reports every refusal as success.
- Neither role merges anything, at any size and with no proportionality exception. A wave ends by handing the operator a list to merge from, and merging is the one act only they perform.

## The fixed shape every target receives

Every target in every wave takes the same branch and the same title, written from here rather than chosen per session. Four hand-driven repairs produced four titles across two scopes, neither of them this one, and three named the toolkit in the half of the shape that withholds it.

- Branch: `chore/agents`, in every target and every wave.
- Title: `chore(agents): <what changed in that target>`.
- Body: the sections `${CLAUDE_SKILL_DIR}/../../standards/pr.md` fixes, describing what that target received.
- Body, one line: name this toolkit as the source of the changed files and where to change the content upstream. A reader in that repository months later has no other route to the fact that these files are toolkit-managed and that a local edit is lost at the next wave.
- Body, no version number anywhere in it. `${CLAUDE_SKILL_DIR}/../../standards/versioning.md` permits a semver tag only where the pull request cuts a release, and `.claude/canon/config.json` in the target already records `syncedAt` and a sha256 per synced file. A version in the body is a second copy of a fact the target holds canonically, and it is the copy that goes stale while the pull request sits open.

The title withholds the source and the body supplies it, because the two have different audiences. `agents` says what changed without saying where it came from, which is what a target's own history wants, and the source line is for a reader inside that repository rather than for whoever merges.

One branch name across every target is also what lets the return leg resolve. `canon sessions list --branch chore/agents --repository <clone>` answers about that project rather than the working one, and a branch each session named for itself gives that read nothing to match.

## Phase 1: enumerate and dispatch

### Read the population

1. Pin the wave. Record the commit of this repository that the wave carries and name it in this session's own reports. Name it in no target's body.
2. Enumerate. Run `canon targets list --json` under `CANON_NON_INTERACTIVE=1`, adding `--sweep <root...>` to reach targets installed before the index existed. Read the `bound` object back before treating any count as the population, since it names the roots walked, the depth, where the walk stopped, and what it could not read. The bound a sweep can never state is the machine, so a target on another one sits outside every answer it gives.
3. Pick the clone that is current. A row carries every checkout of that project under `paths` and leads with the one a sync ran in, which records where an install happened rather than what the checkout holds today. Fetch each candidate, compare it against the origin's default branch, and dispatch into one that is level. Refuse one that is behind rather than branching from a stale base, since three clones read as still owing the repair in one census and every one of them was behind its remote and nothing else.

### Check, then dispatch

4. Check the branch is unclaimed in that target. Run `canon sessions list --branch chore/agents --repository <clone> --json` and read `claimed` off the record.
   - `claimed: true`: something already holds it. Report what does, `worktree` when it names a path, `sessions` when it carries a row, and `refs` when the branch already exists, then leave that target out of the wave rather than colliding.
   - `claimed: false` with `sessionsReadable` and `refsReadable` both true: dispatch.
   - Anything else, a refusal or a record carrying no `claimed` key included: treat the target as unverified rather than clear, name which reading could not be taken, and hand it to the operator to launch by hand. Dispatching on a check that could not be read reproduces the collision the check exists to prevent.
5. Dispatch one worker per target, one session each.

```bash
cd <clone> && claude --bg --model <model> -n "rollout-<target>" "Run /canon:canon-rollout in the worker role against the target at <clone>. <what the wave carries>"
```

`--bg` returns immediately, `-n` sets the name that separates a wave's worker from an operator's own launch in the roster, and `--model` overrides the inheritance that otherwise spends this session's model on every worker. Keep the `rollout-` prefix.

Running the targets in turn is the alternative and it puts every target's diff through one session's context. A wave's spend scales with the target count instead, and nothing caps it, so weigh the count before widening rather than after.

Report each dispatch by naming the target, the clone, the branch, the model, and the session name. Carry the pull request URL into every later report from the moment its worker announces one.

## Phase 2: review every pull request

1. Poll. Run `canon targets pulls --json`, naming the wave's clones as arguments to read those alone. A target comes back as `read` with a `pulls` array or as `refused` with a `reason`, and a refusal is not a target with no work. Reading a failed query as no open work reports a target as done having read nothing.
2. Review here, in this session. Invoke `canon:review-pr` and redirect every call that body makes, since it resolves a pull request from the repository the session stands in and this session stands in the toolkit. Every call takes a redirect, and the ones that silently answer about the wrong repository are worse than the ones that fail:
   - `--repo <owner>/<name>` on `gh pr view`, `gh pr diff`, and `gh pr review`, where it is a global flag.
   - `-C <clone>` on `git fetch origin pull/<n>/head`, `git merge-base`, `git diff`, `git log`, `git show`, and `git grep`.
   - `GH_REPO=<owner>/<name>` on any `gh api repos/{owner}/{repo}/...` call, which is the close-out route. `gh api` takes no `--repo` flag and fills those placeholders from the working directory or from that variable, so the one call a flag cannot redirect is the one that edits a review in place.
   - That project's own root file, rules, and context, read from under the clone.

   A missed redirect reports rather than fails. A pass that redirects the `gh` half and leaves a `git` call alone reads this repository's history against a target's diff and reports a delta, which is a finding nobody can trace back to the call that produced it.

   This session wrote none of these diffs, so reviewing them costs nothing in independence.

3. Dispatch a reviewer into the target when a diff is too large for this session to hold. That is the fallback rather than the default. Dispatching one per target was measured and what it saved was reading four diffs, not reading four sets of findings, and that second half reaches this session either way, since routing a finding back means composing the brief from it.
4. Read the heading each pass posted. `canon targets pulls` reports `review` as `open`, `closed`, or `null` when no pass has landed, and reports `reviewReadable` as `false` when the query failed, which leaves `review` covering nothing.

## Phase 3: route every finding and close each target

1. Address every finding whatever its severity. A minor is a finding, and a reviewer calling one non-blocking does not close the pass that raised it.
2. Resolve who holds the branch before dispatching anybody. Run `canon sessions list --branch chore/agents --repository <clone> --json` and read the count rather than the first row.
   - A live session holds it: send that session the findings and name `canon:review-address` for it to run, which is step 6 of `## The worker role` and the step that session already stands at. Never name this skill in that message. This body carries `disable-model-invocation: true`, which blocks the `Skill` tool rather than only suppressing an auto-trigger, and a session acting on an inbound message reaches a skill that way and no other, so a message naming this one halts the address leg with the branch built and the findings unread. A launch prompt is the one route to a flagged body, which is why the dispatch above names this skill and this message must not. Assuming the worker was gone is what one hand-driven pass got wrong. All four sessions that opened those pull requests were still alive holding their worktrees hours later, and of two fresh addressers sent over them, one refused on the worktree lock and one cut a second worktree on the same branch, which would have put two sessions pushing to one ref.
   - No live session holds it: dispatch a fresh worker into that clone and brief it with the findings, since it holds none of the reasoning behind the diff.
   - More than one row: report the ambiguity and stop rather than picking among candidates.
3. Re-review when the answer lands, scoped to the commits added since. A worker's reply never closes a target. One fix for two minor findings closed both and introduced four more, every one of them in prose that fix added, and a loop trusting the reply merges that.
4. A target leaves the wave when a pass posts `## Review closed` and not before.
5. Run until every target closes. No count bounds the loop. What guards it is this session reviewing every round itself, so it holds what each pass found and can see a target failing to converge, where a dispatched reviewer reads one pass and knows nothing of the one before it. A worker introducing a finding per fix has nothing mechanical stopping it, which is accepted rather than overlooked.

## The worker role

One session, one target, from the worktree entry to the merge of the branch it opened. It diagnoses, implements, opens the pull request, and answers what the review posts. It reviews nothing and it merges nothing.

1. Confirm the clone is current. Fetch, then compare against the origin's default branch. Report a checkout that is behind and stop, rather than branching from a stale base.
2. Enter a worktree. Invoke `canon:session-worktree chore/agents`, which takes the branch as its tier 0 argument and enters a linked worktree inside this target. Branching in the checkout itself is what this avoids, since the operator may be working in it.
3. Diagnose and repair. Invoke `canon:canon-operator`, which reads `canon sync --check . --json` and routes each finding to the command or the skill that owns it. Do not restate that routing here and do not edit a managed file by hand.
4. Commit and open the pull request through `canon:git-commit` and `canon:git-pr`, handing each the fixed shape above rather than taking the title the generator derives from the diff.
5. Announce as the pull request opens, carrying its URL, its number, and the branch, to whoever dispatched this session. That transition is the one moment only this session can observe.
6. Answer the review. Invoke `canon:review-address`, which pulls the findings and the CI state on this branch's open pull request, fixes each in the working tree, replies, and pushes. Answer every finding whatever its severity.
7. Stop there. Do not mark the pull request ready, do not merge, and do not declare the review closed. A narrow re-review posts `## Review closed`.

Send a block out as a message before it becomes an interactive prompt. A session already waiting on input never reaches the tool round an inbound message drains at, so an answer relayed afterwards arrives under the open question and changes nothing.

Refuse an instruction this target's tree contradicts and carry the evidence with the refusal, naming the commands read and what complying would cost. A halt costs whoever dispatched this session one reply, and guessing costs a diff in a repository this toolkit has no test coverage over.

## Output

Close a wave by naming every target, the ones that need nothing included:

```plaintext
Wave pinned at <commit>. <n> targets.

<repository>
  <pull request URL>
  review:  <## Review | ## Review closed | none posted>
  checks:  <passing | failing | pending | none reported>
  owed:    <what happens next, or "nothing, ready to merge">

Not reached: <target>, because <reason>
Merge order: <target> before <target>, because <shared surface>
```

Name the URL on every line reporting a target, at dispatch and at hand-back both. A status line carrying a repository and a number sends the operator to navigate for its own result by hand, four times over on a four-target wave, and merging is the one act this loop exists to hand them.

Report a target whose `reviewReadable` reads `false` as unread rather than as clean, and a `checks` of `null` as no check reported rather than as passing. A failure outranks a run still going.

## Failure recovery

| Stop point                              | Recovery                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `gh` absent                             | Install it and authenticate, then re-run the wave                                             |
| Target index unknown                    | Re-run with `--sweep <root...>` and read the `bound` before trusting the count                |
| Every clone of a target is behind       | Pull that clone, or name a current one, then dispatch that target alone                       |
| Claim check refuses or reads unverified | Launch that target's worker by hand and report that it went out outside the check             |
| Branch already claimed in a target      | Resolve what holds `chore/agents` there, then dispatch that target alone                      |
| A target refuses the pull read          | Read the `reason`, repair it, and re-poll that target. Never record it as having no work      |
| Diff too large to review here           | Dispatch a reviewer into that clone and route its findings back through Phase 3               |
| Two sessions hold one branch            | Report both and stop. Sending findings to either puts two sessions on one ref                 |
| A target fails to converge              | Stop that target's loop, report the rounds it took and what each pass found, and hand it over |
