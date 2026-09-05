---
title: Orchestrator dispatch runbook
description: The plan-answer gate, the collision check before a self-dispatch, the file-set disjointness gate, the branch and model the launch names, the planning and handback dispatch shapes, and the loop's stopping condition
---

Run this at loop step 4, for a `## Run now` row whose plan is verified, in place of handing the worktree to a human. The disjointness gate below is where that row's file set is tested against every track in flight.

## Derive the candidate

Resolve `<slug>` from `<plan>`, the row's plan file, the way `claude-worktree` Step 2 resolves a plan-matched name, per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Resolve `<type>` off that plan's `## Summary` and `**Files to touch:**` lines, per `${CLAUDE_SKILL_DIR}/../../standards/branch.md`, defaulting to `feat` when the lines settle nothing. The candidate branch is `<type>/<slug>`.

This is the branch the worker takes, not a guess at one it will derive for itself. Carry the exact string into the launch below. Both halves of that derivation have already disagreed in production: one run checked `docs/remaining-skill-verdicts` against a worker that took `docs/skill-verdicts-decide`, and a later one checked `fix/path-form-hook` against a worker that took `feat/path-form-hook`. A check against a branch nobody uses verifies nothing, and a slug mismatch no longer fails the run downstream on its own, since `claude-autoship` now takes `<plan>` directly rather than resolving it from the worker's own branch. The check above is what has to catch a wrong candidate now.

## Check the plan waits on nobody

Run `canon tasks plan-answers <plan> --json` and read `launchable` off the record.

- `launchable: true`: the plan answers itself, so proceed to the branch check.
- `launchable: false`: the row is not dispatchable. Report every entry in `open`, each carrying the question label and the reason its suggestion gave for needing a person, and hand the row to the human-launch line below. Never fill the slot on the operator's behalf, which is the one move the plan standard forbids outright.
- `reason: archived`: the row's plan sits in `.canon/plans/archive/` and describes work that already shipped. Repoint the row at a live plan rather than dispatching, since `claude-autoship` Step 1 refuses the same file and the worker would meet that refusal after the launch spent.
- The command refuses for any other reason, or the record carries no `launchable` key: treat the row as unverified rather than clear, name what could not be read, and fall back to the human. A gate that reads nothing and proceeds is the gate not running.

Branch on `launchable` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero and so read a held row as a clear one.

This gate runs ahead of the two collision checks because it is the cheapest reading of the three, needing no roster and no ref, and because it is the only one asking about the row itself rather than about what else is in flight. A row nobody can launch does not need testing against the tracks already out.

It also reads the plan rather than a cell describing one, which is the input the gate below it does not have. The disjointness gate compares the sets a dispatcher wrote into the constraints and the Touches column, so a cell omitting a file clears a check the tree would fail. That happened on 2026-08-31, when two rows were cleared against each other with one constraints block leaving out the context entry both were about to write, and what caught it was a worker sending a message rather than any check.

A blank `- Answer:` is not an unanswered question. `${CLAUDE_SKILL_DIR}/../../standards/plan.md` fixes an empty slot as accepting the `- Suggested:` line above it, which is what makes a plan decision-ready in one pass. The narrow case this reads is `- Suggested: needs your call, <why>` and its two demonstrated paraphrases, `needs operator's call` and `needs the operator's call`, over an empty slot, the form that same standard writes where the answer turns on preference rather than on a technical default. A gate reading every blank slot as open would refuse every plan in the folder.

What it prevents is a halt nobody is watching for. `claude-worker` instructs a session to stop on a question written as needing the operator's call, correctly and by its own body, so a dispatch that never reads the plan lands a worker in a wait for a person who does not know it is waiting. The worker's halt is not the defect, and the dispatch that made it necessary is.

## Check the branch is unclaimed

Run `canon sessions list --branch <type>/<slug> --json` and read `claimed` off the record.

- `claimed: true`: the row is not free. Report what holds it, `worktree` when it names a path, `sessions` when it carries a row, and `refs` when the branch already exists. Move to the next candidate rather than colliding.
- `claimed: false`, `sessionsReadable: true`, and `refsReadable: true`: proceed to the disjointness gate.
- `claimed: false` with either flag false, or the command refuses, or the record carries no `claimed` key (`reason` reads `no-registry` or `no-repository`): treat the candidate as unverified rather than clear. Report which reading could not be taken and fall back to the human-launch line below. Dispatching on a check that could not be read reproduces the exact collision this exists to prevent.

Reading `claimed` off the record is what keeps this a check rather than a rule a session can talk itself out of. The field is already the composed answer across the worktree listing, the live session roster, and the refs that name the branch, so nothing here re-derives the OR.

`refs` is the reading that catches a shipped row. A branch behind a merged pull request has no worktree and no session, so the check answered clear on one until a worker refused the instruction and named the consequences: a second pull request against a head GitHub already shows merged, a row whose pull-request line points at two numbers, and the `ambiguous` refusal `canon tasks archive` documents.

What the ref read cannot see is a branch pushed from another machine since the last fetch, because it reads the remote-tracking ref rather than the remote. Nobody has hit that, and a `git ls-remote` per dispatch costs 0.438s against 0.001s, so the gap is recorded rather than closed.

## Hold what this pass already launched

A worker registers with `branch: main` and the main worktree as its `cwd` until `claude-autoship` Step 0 moves it, which took several seconds on both measured runs. Neither the roster nor the refs name the candidate during that window, so a second check inside it reads clear.

Keep the branch of every row this pass has launched and treat a candidate matching one as claimed, without re-running the check. That closes the window for this dispatcher and only for it. A second dispatcher in another session reads git and the roster alone, sees none of this record, and can still take the same row. Say so when reporting, rather than implying the window is shut.

## Check the file sets are disjoint

No count binds this. List the files the candidate's plan touches, from its `**Files to touch:**` lines, against the file set of every track already in flight, read off the Touches column of each row on the board. Dispatch when the sets are disjoint and hold the row otherwise.

The board is not the whole set. A track a person launched by hand carries no row, so that column cannot see it, which is the ordinary shape whenever the operator is launching rather than dispatching. Read `canon sessions list --json` for the branches in flight, and take the file set of any branch no row names from the plan that branch is building. A candidate cleared against the board alone is cleared against a partial reading.

Take the comparison at the file path rather than at a folder above it. `canon tasks validate` compares the paths each row wrote, so a collision it reports on a folder means a row's Touches cell claimed that folder rather than the verb widening anything. On 2026-08-28 it called two rows colliding on `src` because one cell named the bare folder while the other wrote `src/markdown/structure.ts`, which this paragraph once misread as the verb comparing path segments too coarsely.

The finding names which row contributed the containing path, and a bare-folder cell reports as a claim of its own beside the findings. Read that output as a candidate list, settle each pair by file, and narrow the cell that over-claimed rather than discounting the collision it caused.

Disjointness is necessary and not sufficient, so hold a candidate whose sets do not touch when a stated reason serializes it, and write the reason on the hold. One row creating a skill and another auditing that catalog and counting it write nothing in common, measured 2026-08-27, and dispatching both still leaves the audit counting a denominator that moves underneath it. Nothing verifies that a reason was written, so the rule holds only while the dispatcher applies it.

What binds past that is review attention rather than a count, and `## Parallelism` in the skill body states it along with the cap an operator can set for a session. The one number this skill carries is the review fallback's count of three in `## Parallelism`, which moves a review rather than binding a track, and this runbook carries none.

## Pick the model

A `claude --bg` session inherits the model of whatever launched it rather than reading the machine's configured default. That was measured on 2026-08-27, with `~/.claude/settings.json` set to `sonnet` while both dispatched workers ran `claude-opus-5`. An orchestrator on the larger model therefore spends it on every worker it launches, and the operator who set the default never sees the override.

Name `<model>` on the launch, and pick it against the task rather than copying whatever this session happens to run. Sizing the model to the row is the dispatcher's call, the same call it already makes on the branch. A mechanical row moving files under a written plan is not the row that needs the largest model, and one whose plan carries an open judgment is.

## Dispatch

```bash
claude --bg --model <model> -n "worker-<project>-<slug>" "/canon:claude-autoship <plan>
Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the pull request opens, carrying the number, the branch, the head sha, the CI state, and every point you departed from the plan on, and message it again if you stop on a question."
```

`--bg, --background` starts the session as a background agent and returns immediately, `-n, --name` sets the display name that tells a self-dispatched worker from an operator's own launch in `canon sessions list`, and `--model` overrides the inheritance the section above measured. Pass `-n` on every dispatch rather than letting the client derive one. A launch that omits it leaves the session named for a fragment of its own identifier, which is both its address on the send channel and the whole of what the operator sees for it in agent view.

The prefix reads `worker-` because that is the role it marks. It read `orchestrator-` until 2026-08-31, and no controlling session ever carried it, so a worker filtering the roster for that string found a sibling or itself on every row. Nothing matches the prefix programmatically, which is what kept the rename down to three strings.

`<project>` is the basename of the main worktree root, not of wherever the dispatcher happens to be running. Resolve the main root first, the way `claude-worktree` Step 1 does, since a bare `git rev-parse --show-toplevel` inside a linked worktree returns the worktree path rather than the project's.

`claude agents` lists every session on the machine with no path column and no per-project filter, so `<project>` in the name is the only thing left telling two fleets apart, and a session named off the worktree path instead would carry the branch folder rather than the project. Two projects each dispatching a bare `worker-page-driver` used to read as one row in that view.

Read `<dispatcher-id>` with `canon sessions list --self --json` and interpolate the `sessionId` that row carries. Carry the id rather than the name. A name is derived from whatever the session turned out to be doing, and across the 181 records stamping both fields, nine were renamed after launch at a median of 5.4 minutes and a maximum of 509. Three landed more than ten minutes in, which is inside the window a worker announces its pull request in, so a name written into the prompt is aimed at a send that happens after it goes stale.

Where the installed CLI answers `--self` with an unknown option, that flag is newer than the release the target holds. Read the `sessionId` from the record the client writes for this session under its configuration directory, and say which route answered so the reader knows whether the id was read or inferred.

The worker resolves that id back to a name through `canon sessions list --json`, which carries `sessionId` per row, rather than through the agent listing, which prints a name and a short ref and no id at all. A worker reaching for the listing first therefore finds no lookup and can conclude there is none. That failure is silent in both directions: the session has nothing useful to do with the message it owes and goes idle holding it, and nothing on this side reports the quiet, so the loss surfaces as a missing worktree or a pull request that never opens rather than as anything watching for it.

The template carries no worktree call. `claude-autoship` Step 0 invokes `canon:claude-worker` and then `canon:claude-worktree` itself, and neither carries the flag, so both are reachable through the `Skill` tool regardless of where a call to them would sit in a prompt. The autoship call carries `<plan>`, the same file this runbook already read to derive the branch, so its Step 1 takes it as the caller-supplied plan rather than re-deriving one from the slug the worker's branch happens to carry.

Dropping the argument does not hand `claude-worktree` a formal one in its place. A worker launched onto `main` cannot match tier 1, a board carrying more than one plan puts tier 2 out of reach, and tier 3 tells it to ask a person who is not there, so the ladder alone still closes nothing.

What closes it is the same inference four workers already took before this template existed: the session already holds `<plan>` and derives `claude-worktree`'s name from it directly, rather than waiting on a tier to supply one. That is a judgment rather than a contract, and it is the same judgment both live disagreements came from, so read it as the residual risk this template still carries rather than as solved.

### Expansion needs position zero and a clean delimiter, not leading order alone

The client expands a slash command at position zero of a launch prompt as a
user invocation, which is the route `disable-model-invocation: true` permits
and gates. Everything that reaches the session as prose instead falls to the
model, which invokes it through the `Skill` tool, and that route answers a
flagged skill inconsistently. `claude-autoship` has carried the flag since early in its life, and seven other
shipped skills carry it too.

Three launches on 2026-08-31 and 2026-09-02 bound what makes a command take
that route. Observation A is the first refused worker, launched as `Run
/canon:claude-worktree ..., then /canon:claude-autoship ...`, which expanded
nothing. Observation B is a re-dispatch launched as `/canon:claude-autoship
<plan>` with a space before the path, which expanded and shipped.

Observation C is a planning dispatch launched as `/canon:claude-planner, then
/canon:claude-feature <task>` with a comma glued to the command name at
position zero, which expanded nothing and reached both bodies through the
`Skill` tool instead. A rules out leading order alone, C rules out position
zero on its own, and the only visible difference between B and C is the
delimiter after the command token: a space in B, a comma in C.

Read that delimiter reading as a candidate with a falsifier rather than as
settled. The cheapest test is one dispatch leading with a bare command whose
name is followed directly by a period, and the next real dispatch can carry it
at no extra cost. Until it fails, the operational rule is the conjunction the
three observations support: put the flagged command at position zero, followed
by a space and its argument, with nothing before it.

Four sessions made the same tool call against the same plugin cache on
2026-08-31. Two were answered with the body and shipped, and two were refused
with `Skill canon:claude-autoship cannot be used with Skill tool due to
disable-model-invocation`. Prefixing separated nothing, since three of the
four carried the namespace and those three landed on both answers, so nothing
a dispatcher writes predicts which answer a launch through the tool gets.

Read that as a route a dispatch may not depend on rather than one that usually
works. The refusal closes the fallback in the same message, telling the
session not to replicate the workflow by other means, so a refused worker has
no route left and stops with a clean worktree. Both failed dispatches produced
nothing rather than a degraded run, which is the correct outcome and not a
thing to soften.

Recovery belongs to whoever writes the next prompt, since a blocked session
cannot replay its own launch. The refusal is sticky inside a session rather
than something a retry clears, measured when one refused worker repeated the
identical prefixed call and got the byte-identical error back. Re-dispatch
onto the same branch with the build template above, which already leads with
the one command that needs the expansion route.

The review shape and the planning shape below depend on no expansion at all.
None of `claude-worker`, `claude-address-review`, `claude-planner`, or
`claude-feature` carries the flag, so both correctly keep their leading word
regardless of the delimiter or the position it sits at.

The same collapse reaches a human relay rather than a `claude --bg` string. A
controller that hands an operator two chained blocks to paste as separate
messages risks both landing as one, where everything after the first
command's name is read as that command's own argument and the second command
never fires, measured four times out of four on 2026-09-02.
A slash command expands as a user invocation only at position zero of a
prompt, and a later one in the same text reaches the session as prose instead.
The fix is what the template above already takes: one message, one command,
at position zero.

### What the brief may carry

The prompt carries pointers and standing context, and stops there. The branch and the plan stay arguments, because a skill resolves an argument through a documented ladder and reads no prose at all. What the prose reaches is the worker's judgment, so it holds only what a session has to weigh:

- Name the addressee and what it is owed, which the two message clauses above already do.
- Carry standing context this session holds that a cold one cannot derive, such as a constraint settled in conversation that never reached the plan.
- Leave out anything scope-shaped. A file list, a naming convention, or a check to run belongs in the plan, where the review reads it back against the diff.

The last bullet is the one under pressure, since the dispatch that first proved unattended work possible sent a prompt naming the task file, the likely files, the conventions, and the check to run. It shipped in 874 seconds and touched four files its task never named. Scope that arrives as prose is scope nothing verifies afterward.

Report the dispatch as loudly as the human-launch line it replaces: name the branch, the model, the task, and the session name, so a person reading the transcript can follow what fired without watching it happen.

## Dispatch to address a review

`claude-address-review` is a single pass, not a chain, so a launch naming it
alone reaches no `claude-worker` and takes no role, which owes no message
either. A replacement session was launched that way once, onto the branch a
review had already posted findings against, and it answered by posting a
thread reply and telling its controller nothing. Reach the role directly on
this launch instead of wrapping a second chain around one skill that has none
of its own.

The branch already exists here, opened by whatever built it, so this shape
skips the plan-derived name the build shape resolves above. Take `<branch>`
off the pull request's own head ref. Enter the worktree the original build
left on disk, `.claude/worktrees/<slug>/`, with `EnterWorktree`'s `path` form
when it is still there, or `git worktree add .claude/worktrees/<slug>/
<branch>` when it was cleaned up, so `<slug>` is that directory name either
way.

`EnterWorktree` refuses that path in the ordinary case, because the original
build session stays registered against its own worktree after going idle and
holds a harness-level lock the roster does not report. Work in the folder
directly with `Bash`, `Read`, and `Edit` instead of retrying the tool, which
is the route two workers already took today on two different branches.

```bash
claude --bg --model <model> -n "worker-<project>-<slug>" "Enter the worktree for <branch> at .claude/worktrees/<slug>/, creating it from that branch if the folder is gone. Run /canon:claude-worker, then /canon:claude-address-review. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the address pass finishes, carrying what was addressed and the PR's CI state, and message it again if you stop on a question."
```

`<dispatcher-id>`, `<model>`, and `<project>` resolve the same way the build
shape resolves them above.

Take this shape wherever a review needs answering and no live session already
holds the branch. Where one does, message it to run `claude-address-review`
instead, per the loop's own step 6, since a session already there needs no
second one dispatched onto the same branch.

That check is blind to a session working through the direct-path fallback
above, since a session that never runs `EnterWorktree` never moves its
registered branch off `main`, so `canon sessions list --branch` reports nothing
holding it. A dispatch landing on a branch worked that way collides with
nothing the check can see.

## Dispatch to plan a row

`claude-feature` is a procedure rather than a role, so a launch naming it alone
reaches no `claude-planner` and takes no role, which owes no message either.
Both trials on 2026-08-31 ran on prose the controller retyped into each launch,
which held every obligation those sessions took and is where the first one's
in-flight read went wrong. Reach the role directly on this launch, the way the
build shape above reaches `claude-worker`.

No branch and no worktree exist here and none is created. A planner writes one
gitignored file at the main worktree root, so this shape names the row's task
file rather than a branch and opens with the role instead of a worktree call.
That write meets the isolation guard the same way a linked worktree's
main-root write does, with no worktree here to redirect it to, so
`claude-planner` sends it as a `Bash` heredoc rather than through `Write`.

```bash
claude --bg --model <model> -n "planner-<project>-<slug>" "Run /canon:claude-planner, then /canon:claude-feature <task>. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the plan lands, carrying the path and what the task file got wrong, and message it again if you stop on a question."
```

`<task>` is the row's task file path and `<slug>` the slug its plan will take,
resolved off the row the way the build shape resolves one off a plan.
`<dispatcher-id>`, `<model>`, and `<project>` resolve the same way they do
above. The prefix reads `planner-` for the reason the worker's reads `worker-`,
which is that it marks the role of the session it names rather than the one
that launched it.

None of the three checks above binds this shape. The branch check has no
candidate to read, and the disjointness gate has nothing to compare, since a
planner writes one file no track in flight can hold. The plan-answer gate
reaches no plan at all, because the planner is dispatched to write the file a
build would later read, so running it here would refuse every planning dispatch
over a plan nobody has written yet.

What a planning dispatch owes instead is the reverse reading, because the plan
it produces carries a constraint per track in flight and a row planned during a
wave is planned against a tree that wave is changing. `claude-planner` composes
the session roster with the pull request list for that read rather than reading
pull requests alone, which is why the brief carries no branch list for it: the
planner takes this reading itself either way.

One row per dispatch. A session reused across a batch pays the context load once
and ages its picture of the tree while it works, which is what puts the in-flight
read on the task rather than on the batch, and one that compacts mid-batch loses
the reasoning behind its earlier plans with nothing reporting it. Cap a reused
session where the saving is worth it and say what the cap was.

## Fall back to the human

Hand the row to the human-launch line in step 4 instead of dispatching when any of these hold, and name which one: the plan still waits on the operator, the plan-answer read could not be taken, the collision check refused, the row's file set overlaps a track already out, or a stated reason holds the row behind one.

The first of those five is the one that reaches a person rather than the board. A row held for a collision or for a serialize reason waits on the wave clearing, where a row held on its plan waits on an answer only the operator can give, so hand that one over with the question label and its stated reason attached rather than as a name and a refusal.

Hand the person one command: `/canon:claude-autoship <plan>`, naming the row, the plan path, and the branch together, with no worktree call ahead of it. A leading worktree call adds nothing beyond what `claude-autoship` Step 0 already reaches for itself, by the same judgment the template above calls a residual risk rather than a settled contract. A second command also risks a client folding two commands into one message, which reads everything after the first command's name as its own argument and drops the second: that happened in four dispatches out of four before the fix became one message carrying the autoship call alone.

Suggest, as one line to the operator, that they rename their own session to the row's id, so a process listing shows what the session is for without a cross-reference to the board.

## Stop the loop

Wrapped in `/loop`, re-run the check against `## Run now` on each wake. Stop rather than firing again once the group is empty or every row in it reads `claimed: true`. Report that once, on the wake that finds it, and let the loop end rather than continuing to poll a board nobody is clearing. `orchestrator-poll.md` already carries this reasoning for the review trigger, and it binds a dispatcher the same way.
