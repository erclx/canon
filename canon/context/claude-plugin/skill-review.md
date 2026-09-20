---
title: Skill review paths
description: The version-sequencing surface that was gated and then retired, the two-pass model a pull request review posts under, the rebase stage the worker's return leg carries, and the worker role holding its own half of the channel
---

# Skill review paths

## Cross-version sequencing

No version-sequencing surface exists. `role-orchestrator` and `review-pr` each read `.canon/tasks/priority.md`'s `Waiting on` cell for why a row sits where it does, one line per row, rather than a roadmap version file, so reasoning spanning several rows has no dedicated home and reaches a later session only through whoever remembers it.

`standards/requirements.md`'s Lifecycle section states that later scope arrives as a new section and that nothing sequences either list into versions.

## Asserting a routing decision

A router is reviewable only through what it says. Almost every `canon-operator` route ends in a handoff or a report rather than a file, so a review reads a body claiming a route and cannot tell on its own whether the route fires.

The `reply` expectation closes it. It reads `result` off the envelope `max_turns` already reads, so scoring a route costs nothing beyond the run, and the token worth pinning is the name of the skill or command the route hands to. `claude/target-setup/fresh` is one arm using it this way.

Pinning phrasing is the cost, and it is why every route pin is paired. A reply naming a skill in a sentence declining to route still passes a substring check, so each arm carries a `manual` entry stating the negative a substring cannot express, and the arms whose skills may execute nothing assert the tree as well: the root layout is still at the root and nothing appeared under `.claude/`.

Where a handoff may legitimately continue into the skill it names, as a fresh target's does into `target-setup`, no tree assertion is declared at all, since none separates the router doing the work from the router routing to something that does it. The arms themselves are catalogued in `canon/context/sandbox/coverage.md`.

## The review two-pass model

`review-pr` posts twice over a pull request's life, a first pass and a close-out. The body path carries the head commit, `body-<number>-<short-sha>.md`, since keying on the pull request number alone would let two sessions reviewing different pull requests collide, and says nothing about one session posting twice.

A name the caller has to choose is a name the caller gets wrong in practice, so the second segment is derived rather than picked.

### When the head repeats

Deriving from the head leaves a later pass with no legal name whenever the head stops moving, which is an ordinary state rather than an error. A fix landing in gitignored records produces no commit, since the return leg delegates its push to `git-followup` and that skill stops on an unchanged tree, and a finding the worker accepts as recorded produces no change at all. The close-out is still owed on both routes, because the newest heading is what an operator reads to decide whether the branch is blocked.

So a repeated head takes a third segment off the `## Review response` comment the pass answers: the thread's id, a real object rather than a suffix someone picked, with the head still leading the name so the second body sorts beside the first. A pass index was the other candidate and it loses, because nothing in the thread carries one, so a session would have to count prior comments to pick the next, which is the hand-chosen suffix the rule forbids.

The number sits only in the comment `url`. `gh pr view --json comments` returns a GraphQL node id under `id`, which names the same comment in a form the thread does not show, and extracting it needs a null guard, since the jq that splits the url aborts on an empty selection.

Selecting the response is scoped by the prior pass's `submittedAt` rather than by the heading alone, since a heading match alone takes the newest response in the thread whatever its age, which resolves the id a close-out already used on a re-run and rebuilds the collision the third segment exists to prevent. Testing whether the derived name is already on disk was the other candidate, and it is weaker: the scratch folder is gitignored, so a second machine holds none of it and the test passes exactly where the record it consults is missing.

An empty derivation is a head repeating with no response behind it, so the pass has nothing to add and stops rather than writing a second body over one commit. Where a response or a rebase report sits there, it is the entire read: the equality that triggers the naming case makes Step 2's range empty, so the comment rather than the delta is what says whether a prior finding landed.

A late finding is the one exception, since the read also opens the file the comment names, covered next.

### Where the stop had to sit

A check placed only inside the filename derivation reaches only the path that composes a body, so a pass reading the head as unchanged and taking no other action skips it entirely. Step 2 instead runs the same response query the moment the ancestor test reports an unchanged head, ahead of the diff read and ahead of Step 3's review, and stops there when it comes back empty. That is the earliest point every path through the skill crosses, so a pass with nothing to add cannot reach a `gh pr review --comment` call.

Step 4 still derives the third filename segment for a pass that does proceed, off the comment id Step 2 already resolved, since collision avoidance in the name is still owed once posting is decided.

Deriving it also decides what a close-out reads. The last comment the skill posted names the commit the prior pass covered, so the close-out reads that range to the head rather than the whole change. That same field settles the rebase case without a second mechanism: after a force-push the prior commit no longer reaches the head, `git merge-base --is-ancestor` exits non-zero, and the skill pays for a full pass and states that in the body. Scoping by the prior review's timestamp instead would have needed its own rebase test, since a commit's author date can predate the push that put it on the branch.

The equality test matches `## Review response`, `## Post-review findings`, and `## Rebase` as one family rather than `## Review response` alone. `## Post-review findings` is a reply carrying no commit behind it, which is exactly the shape the stop is meant to let through, so testing it separately would refuse a late finding the way it refuses an ordinary rerun. `## Rebase` needs no separate handling, since a rebase moves the head and the pass takes the non-ancestor path before this test ever runs. The filename segment Step 4 derives reads off the same resolution.

Step 2 splits on the heading: a response or a rebase report skips straight to composing the body, and a late finding gets the file it names read at `<headRefOid>` first, the same confirmation Step 3 runs against a stale ticked box.

### A close-out repeating the standing one

The unchanged-head stop tests an empty range, so a pass whose head moved passes it whatever the thread already says. A pass telling the author a change is their own call, followed by the author making it, leaves the next pass's delta with nothing left to say by construction, so a correct pass over real commits can still arrive carrying nothing and post a close-out that repeats the standing one.

The guard therefore turns on the standing verdict rather than on the range. Step 2 widens its existing query to return the last family review's first line beside its commit, one read answering both, and Step 4 rewrites the standing close-out through `gh api -X PUT` instead of posting beside it. `PUT` keeps the timestamp and the position in the thread, so the verdict stays where a reader last found it, and a submitted review cannot be deleted anyway.

Suppressing the pass was one alternative and it fails twice: a reader scanning the thread would see a close-out naming an older commit with no way to tell whether the newer one was covered or skipped, and a test broad enough to suppress early would swallow a pass that raised a real finding.

A further heading was the other alternative, and the closed set `poll.sh` matches against closes it outright: the script matches a fixed set in jq and reports anything else as `UNMATCHED`, so a new heading invented here without a matching change to that set would break the classification it was meant to clarify. `## Evidence` joined the set on that same condition, shipping together with `canon pr evidence` and the `poll.sh` exclusion rather than one heading arriving ahead of the other.

`poll.sh`'s `SEEN` branch fires when `prior` equals the head. Since `FINAL` writes the head the run observed back to the baseline every tick and the report gates on `old_head`, `head != old_head` fires once per head move regardless of what `prior` says, rather than repeatedly on every later tick that finds the same unmoved head.

The read-time marker covered next closes the rest: `PUT` replaces the body and the marker rides in it, but `PUT` cannot move `submittedAt`, so a rewritten close-out still ages from when it first landed, which is the reading the poll's age test wants.

The guard fires on `## Review closed` alone. Two open passes carry different findings and both are worth reading, so a repeated `## Review` stays an ordinary post.

### The commit a pass records

GitHub stamps a review with `commit.oid` and `submittedAt` when it is submitted, and neither describes what the reviewing session read. A push landing in the compose window moves both onto a commit the pass never opened, so the next reader scopes its delta past that work and reports it covered, which is a genuine fix silently skipped rather than a false alarm.

The pass writes its own record instead. Step 1 captures the instant ahead of every read it makes, and Step 4 ends every body with `<!-- review-pr: commit=<sha> read-at=<iso8601> -->`, an HTML comment a reader of the thread never meets. Both halves of the marker come from the top of the pass rather than from the post, so the window belongs to the next reader rather than being claimed by this one.

The reader takes the last non-empty line and searches nowhere else. Searching for the last match anywhere would read a marker a body was displaying rather than claiming, since a fenced block showing the format on its own line trims to exactly the pattern, and whole-line anchoring alone does not separate the two, since it only defeats the inline form where backticks leave the trimmed line unmatchable. Position costs nothing, since Step 4 already writes the marker last in every body.

`canon pr review-state`, and `src/pr/review-scope.ts` behind it, is the only parser of that marker. Two readers would put one format in a shipped skill body and a shipped bash script that ship on different cadences, which is the drift `poll.sh`'s own header already warns about for the five posted headings. The record carries `source`, reading `marker` for a pass that wrote one, `fallback` for one posted before this shipped, and `none` for a thread with no pass, so a caller can tell a read-time answer from a stamped one rather than trusting every commit alike.

The stamps stay live for the question each is right about. The poll's age and its `STALLED` branch read `submittedAt`, since how long a comment has waited on a human is a fact about the submission, and the pass instant that scopes a reply query reads `readAt // submittedAt`, since what a pass had read is a fact about the read.

What it costs is a release of silence and a round trip. A target whose CLI predates the verb meets a missing subcommand, and both the skill body and `poll.sh` carry a written fallback that reads the stamps and reproduces the defect rather than failing, so the fix reaches a project only once a release does. The poll also spends a third `gh` read per open pull request per tick, on top of the payload and `canon pr head`.

### The heading contract

The heading is the half a reader sees without opening anything, so it reports state rather than pass number. `## Review` covers a pass carrying a finding at any severity and `## Review closed` covers a pass carrying none, so the state comes off the most recent comment rather than off a label on a kind of pass. A close-out does not close the pull request, which is why the rule reads the latest heading rather than promising the closed one is last.

Coupling the heading to the pass number instead reads wrong whenever a later pass reopens what an earlier one closed: `review-address` nests `## Review response` under the first close-out it answers, so a thread reads as opened, answered, still open, closed, and a pass-numbered heading cannot express that.

Sharing a prefix across that family is why the detection matches the first line for equality rather than testing a prefix. A prefix test also accepts `## Review response`, and it is safe only because `review-address` posts through `gh pr comment`, which lands in `.comments` and never in `.reviews`. An equality test costs the same and owes nothing to a sibling's choice of command.

A finding withdrawn on a reply's argument leaves that count too, so a pass withdrawing every finding it carried reads as a close-out while still owing a body the short close-out line cannot carry, since that line credits a fix nobody made. `canon/context/claude-internal/orchestration.md` holds why a reply reaches the thread at all and which class of reply stays off it.

### The full set, stated once

Five headings route through `poll.sh`: `## Review`, `## Review closed`, `## Review response`, `## Rebase`, and `## Post-review findings`. `## Post-review findings` gets the same routing `## Review response` does, since a worker with something to report after a close-out needs a heading of its own: `poll.sh` reports it as a reply and sends a fresh pass.

Which headings exist, which family each belongs to, and who posts each is stated once in `review-pr`, beside the threshold that skill already states once, so `review-address` and the poll cite it rather than carry their own copy.

A comment posted under a heading outside the five is reported as unmatched rather than passed over. Silence and a match read alike otherwise, so the poll surfaces an invented heading as a state a person reads rather than absorbing it silently.

### The closing comment folds into the reply, not a sixth heading

`review-address` Step 7 appends its CI confirmation to the `## Review response` reply and edits it in place, rather than posting a second comment carrying no heading. A heading-free comment passes over the poll the way ordinary chatter does: `JQ_UNMATCHED_STATE` opens with `select(startswith("## "))`, so only a comment whose first line already carries a heading prefix reaches the known-set test at all.

The confirmation states nothing the reply posted moments earlier does not already carry, so a second comment would reach no reader on either side of the channel.

### One threshold under the heading and the dispatch

One threshold governs both the heading and the dispatch: a pass carrying anything, at any severity, posts the open heading and sends the session holding the branch, and the closed heading is reserved for a pass carrying nothing at all.

A heading gated at should-fix and a dispatch gated at any finding, or the reverse, disagree on a minors-only pass: one rule reads it as open with nobody told to act, or reads it as closed while real work is owed. Grading every minor as visibility-only does not hold either, since some minors are defects a worker goes on to fix, so the grade cannot decide on its own who gets sent. The ladder now names the lowest grade and lets the single threshold decide the dispatch, rather than the grade carrying a claim about who acts.

The cost is that a reader can no longer take the merge decision from the heading alone, and reads it off the counts on the summary line instead. What it buys is the invariant the poll's stalled state already assumes: one threshold governing both the heading and the dispatch.

`review-pr` states the rule once, and every other surface cites that skill by name rather than restating it, since the surfaces ship separately and none of them can import anything. A citation buys one edit for the next move rather than one per surface, but it buys no check: `poll.sh` and the `pr-review` sandbox scenario both pin heading strings the skill owns, and nothing compares either against the body that states the rule, so a skill edit missing one leaves an arm scoring green against a rule nothing follows. Building that check was declined rather than deferred, since comparing a script's literals against prose is a parser over prose, a larger question than the threshold it would guard.

A minor the dispatched worker declines goes to the `## Findings` section of the task the branch closes, which the queue-refill sweep already names as the destination for a finding that changes another task. That routing does not follow the threshold, since a declined minor needs a surface surviving the merge whatever heading the pass carried.

Whether a finding is new in the diff or pre-existing and out of it is a real difference behind the two handlings, and it stays off the thread. It is a second axis on a ladder already graded imprecisely, and the single threshold closes the gap without needing it.

`poll.sh` carries the detection, because a rule firing only when a session reads it produces the inconsistency the split threshold had. A jq filter takes the last family review's first line rather than its commit, and a `STALLED` state names a pull request whose open pass covers the head with nothing following it.

Reporting a standing condition rather than a transition would fire on every later run, so the classification writes a marker into the baseline field it derives and reports once per entry.

The heading alone cannot decide staleness, which the marker hides rather than fixes: one threshold under the heading and the dispatch means an open pass is a dispatch owed and made, so the healthy thread is a worker still working, and a signal firing on that path is one an operator learns to skip.

The same filter emits the pass's age beside its heading, computed in jq because `date -d` is GNU-only, and the state adds a floor of two hours, several times a review-to-follow-up cycle and well short of a thread left overnight. A project whose workers run longer raises the constant. A review carrying no timestamp reads as age zero and classifies nothing, matching the answer a pull request the run could not read already gets.

Keying on elapsed time rather than on two consecutive quiet polls also drops history the state would otherwise need. A baseline written before the field exists reads as not yet reported, so the first run after an upgrade names a thread already past the floor instead of waiting a poll to confirm what it can already see. The prose half still cannot be dropped, since the script reports and never instructs, and the state catches only a thread already in the wrong shape.

Unifying the heading with the dispatch widened what the state reaches to every stalled dispatch, since a pass carrying anything posts the open heading this reads: a stalled minor now reports on the same terms as a stalled blocking finding. The state stays a heading test, so it pins nothing on the summary line's counts, a separate string `review-pr` owns.

## The rebase stage

`review-address` runs a rebase stage between the doc refresh and the push, since a branch that answers every finding can still fail to merge once a sibling lands first. The orchestrator's poll reports `CONFLICT` on that transition, which is what lets the stage skip building its own detection.

The stage sits after the fixes rather than before them, so one force-push carries both and the reviewer reads a single delta. It tests with `git fetch origin main` followed by `git merge-tree --write-tree`, chosen over `gh pr view --json mergeable`, since that field returns `UNKNOWN` exactly when a poll asks.

### The no-findings path

The test runs ahead of the no-findings guard rather than inside the fix path. A guard gated on the finding count alone stops before the stage on a pull request carrying no comments, which is exactly the shape a stale branch produces when `main` moves rather than the review saying anything, so the guard decides on the rebase test instead and a run carrying no findings skips straight to it.

The reply, the terminal confirmation, and the output line each need a rebase-only form once that path opens, since all three otherwise assume at least one finding. The reply takes a `## Rebase` heading rather than `## Review response`, since the second claims a review the run never read and would sit under a `## Review` that does not exist. The heading also stays outside that family so the close-out's first-line equality test cannot match it.

### Two runs of the test

It also runs twice. `git merge-tree` reads committed history and the fixes are uncommitted at step 5, so a branch that merges clean as committed, whose fixes touch lines `main` moved, passes the first test and reaches the remote unmergeable. The second run sits after `git-followup` commits, and it costs an extra force-push only in that narrow case.

The fixes are uncommitted by then, so the stage stashes before the rebase and pops after, and the resolution rules cover hunks from both. Both halves are conditional on a dirty tree, since a run answering every finding as a conscious-accept leaves nothing to stash and an unconditional pop would restore an unrelated entry from an earlier session. That same run has no commit for `git-followup` to carry either, which is why the push leg names a direct force-push for it.

### Conflict resolution

The rules are stated where the stage runs, which is what makes it safe. A wholesale `--ours` or `--theirs` drops one side silently and passes every check, since both sides are valid content, and a generated file merged by hand produces a diff the next regen discards. A generated file needs its own rule for that reason, and an authored file needing a count or an index updated needs judgment an orchestrator does not have, which is why the worker owns this stage rather than the orchestrator.

No comment channel exists for a conflict. Both sides of every hunk sit in the conflict itself, `main` is what the operator approved, and `git log origin/main` names what landed, so a per-conflict comment would only restate the diff and add a surface the worker waits on. A hunk the tree does not settle stops instead and reaches the operator as an ordinary finding on the next pass, which holds only because the stage forbids guessing rather than leaving it to judgment.

`git-followup` absorbs the consequence at its push, forcing under a lease when the tracking branch no longer reaches the head, since a plain `git push` is rejected on a rewritten branch. The close-out's ancestry test already covers the re-read this produces, falling back to a full pass on exactly this branch shape.

## The worker's own half

`role-worker` exists because the return leg the rebase stage above depends on was documented only on the side that does not perform it. Worker behavior spreads across `session-worktree`, `auto-ship`, and `review-address`, each owning a step, and none of the three names the role or the channel on its own.

`auto-ship` Step 0 invokes it, in the position that already invokes `session-worktree`. That reaches a dispatched worker and a hand-launched one on one path and needs no change to the launch command, at the cost that a session doing something other than the ship chain never asserts the role.

The body stays thin by construction, since it has three readers who need different things from it. A dispatched worker reads it as its whole operating contract with nobody watching, a hand-launched one reads it beside a person who can correct it, and the orchestrator reads it to know what it may assume. A rule written for the first can be wrong for the second, so the body carries the role, the boundaries, the three obligations, the refusal right, and the lifetime, and points at the three step-owning skills for everything else.

### The channel splits by who sends

Each half is stated where its sender reads it. The worker's obligations sit in `role-worker` and the orchestrator's handback stays in `orchestrator-poll.md`. One shared section would put a worker's duties in a file no worker loads, which is the defect the split avoids. The orchestrator's step 6 points at the worker skill rather than holding its own copy.

Three messages are owed and no more. One announces the pull request when it opens, carrying the number, the branch, and the task it closes. One announces when an address-review pass finishes, carrying what was addressed and the pull request's new CI state. One reports a block before it becomes an interactive prompt.

That ordering matters: a queued message drains at the next tool round, and a session already waiting on input never reaches one, so an answer relayed to an open prompt renders beneath the question and changes nothing. Nothing is sent on progress, since a worker reporting progress rebuilds the poll on the other side of the channel.

A launch naming `review-address` alone reaches no `role-worker` and takes no role either, which risks a worker addressing a posted review and telling its controller nothing. `orchestrator-dispatch.md` carries a second launch shape reaching the role directly for that case rather than reusing the plan-build shape's chain, carrying the same `<dispatcher-id>` resolution the build shape already documents.

Refusing stays a first-class move rather than a failure mode: a worker arguing back with evidence rather than complying has reached corrections a report-upward-only body would suppress.

### A gap two declined shapes left open

`role-worker` and `role-planner` each state a channel, and each assumes a message-sending tool carries what they compose. A standalone skill for the session holding neither role never fires, because nothing routes a session to a skill matching no request and reaching for no artifact of its own.

Moving the protocol inline into each role body was the other alternative, and it trades the firing problem for a duplication one: two bodies stating one protocol is the shared-surface case `canon/ARCHITECTURE.md` already decided against, since a later fix reaching one copy and not the other diverges silently.

`session-relay` is the shape that keeps both. The firing condition survives because the pointer sits inside `## The channel`, a section both role bodies already read at session start rather than one reached by request match alone, and what remains duplicated across the two bodies is two sentences naming one skill rather than the protocol itself. A pointer drifting from its target fails loudly, since the skill it names either resolves or does not, where two copies of one protocol drift from each other in silence.

### The third case, reached by widening rather than by a third shape

A session holding neither role has no `## The channel` section to carry the pointer, so a relay scoped to the two roles read neither ladder and never learned the skill existed. `canon-rollout`'s worker role is the concrete instance, structurally barred from `role-worker` since that body resolves session scratch against a main worktree root a target does not carry, and it met the gap by restating the block-before-prompt line inline rather than by finding a surface to read it from.

The relay now serves that session directly. Both guards came off, the one refusing a caller holding neither role and the one refusing a caller holding a send tool, and the description fires on any relay rather than on a missing tool. What the skill holds is the mechanical half of the send: naming the sender, turning a `sessionId` or a branch into an address, and putting the text through whichever route exists. Each role keeps only who it addresses and its own last-rung inference, which a worker and a thinking session resolve differently because a worker holds a feature branch and neither of the others does.

`core/091-channel.md` states the addressing and timing once, for a session that reaches it directly. A skill body may not depend on that arrival, since a plugin skill reaches a target the moment it merges while a governance rule reaches one only through a separate install nothing forces alongside it. The relay restates block-before-prompt for that reason, which is the target holding the plugin and not governance rather than the roleless session as such.

Three copies of that line now stand: the relay, the shipped rule, and `canon-rollout`. The rule is the one that reads oddest, since it governs a session holding neither role and then sends it to check against the two roles it does not hold, and it names the relay nowhere, so the one surface a roleless session loads on a glob match cannot reach the skill that now serves it. A board row covers all three together rather than each body naming a fix it does not hold.

The routing eval is the only check that the widened description still fires, since nothing else tests what a roleless session reaches.

### What the announcement bought and what it did not

The poll's condition is an open pull request alone rather than an open pull request or a dispatched worker, since the script reads pull requests and a building worker has none. The announcement covers exactly the gap that leaves open, because the transition from building to reviewable is the one moment only the worker knows.

The dispatched-worker condition survives as a fallback rather than as a trigger, applied to any dispatch still out after thirty minutes with no announcement, so a silent failure does not leave a finished worker unnoticed.

`scripts/watch.sh` covers the same window at lower cost and ships beside `poll.sh` rather than living in one session's temporary directory. It reads the open pull request list and the session roster together every sixty seconds, and coverage is the point: a worker that finishes goes idle and one that crashes vanishes, so a trigger matching only the pull request stays silent through the second. It resolves the repository from git rather than hardcoding a path, and it counts every session on a branch other than the base one as a worker rather than matching an `orchestrator-` name prefix, which reads a dispatched worker and misses every hand-launched one.

The output contract carries a state between the two it already had, since a session holding several running workers belongs under neither `Ready to build` nor `In review`. The launch section no longer recommends a plan a worker is already building, since the plan file sits in place for the whole build.

## The origin split at Step 6

`auto-ship` Step 6 splits findings by origin before it reads severity. A critical or should-fix finding the branch inherited stops the chain, and one this run caused is repaired in place at any severity, bounded at a single pass the way Step 3 bounds verify. Severity alone is not enough to decide this, since a self-inflicted finding at any severity is worth fixing on the spot rather than reporting as a stop that hands the work back to the same session that created it.

Origin is causation rather than authorship, which is the half that decides the hard cases. Staleness a run induces in a file it never opened is its own. The plan's file list is not the boundary either: it scopes what a run builds, and reading it as a review boundary is scope discipline applied to the wrong question.

An offer to fix is a stop however it is worded. Naming a finding self-inflicted in the report and closing on a menu of resolutions leaves the operator holding the work, so the step forbids presenting the repair as a choice and the receipt records the fix as landed.

## A question that reads the description rather than the diff

Step 3 carries a fourth lens that reads the pull request body's `## Testing` section against what the repository can drive. It reads the claim the author made about verifying the change, which is the one part of a description a reviewing session can falsify: the branch author cannot see what a sibling branch drove the same day.

It asks rather than grades, so it stays out of the finding counts. Whether a human is genuinely required is a reading the author may hold a reason for, so the question carries no severity and enters no count.

A question riding on a close-out would land on a thread reporting nothing owed, the dispatch would never fire, and the one party who can answer would never see it, so the lens sits under the same unified threshold as everything else: the threshold reads anything owed rather than any finding, which covers a bare question alongside a graded finding without separating them, and the summary line names the question count beside the three that stay zero.

What it tests against is `standards/pr.md`, which says what makes a human required: a capability the agent lacks, never the cost of the run. A refusal the author actually met counts and names itself, and a refusal predicted and never met does not. `review-pr` reads that file off the plugin root through the fallback citation form, the same route every skill citing it takes.

A fifth check reads the opposite half of the same section: a ticked box rather than an unchecked one. A box stays true only as long as what it names does, and a fix commit landing after review is what breaks that, so a box naming a test a later commit replaced can reach the merge record with nothing positioned to catch it.

The check is bounded to a box naming a file or a command, since a claim carrying no artifact has nothing this lens can confirm, and it tests that the named artifact still exists rather than re-running what the box claims, which keeps the check from turning a review into a test run. Unlike the Testing question, a stale ticked box carries severity and enters the count, since it is a factual claim the body still makes rather than a judgment call the author is owed a chance to defend.

Confirming a file's existence keys off `<headRefOid>` rather than local `HEAD`. `review-pr` never checks out the branch it reviews: Step 2 reads the diff and file contents through `gh pr diff`, `gh api`, and `git fetch -q origin pull/<number>/head`, resolving the branch tip rather than reading a checkout. A read against `HEAD` would resolve the reviewing session's own branch instead of the pull request, a silent wrong answer rather than a missing one, since `HEAD` always resolves to something.

That resolution comes off `canon pr head --json`, taking the record's `tip`, rather than off a pull request object's own field, which can trail the branch ref by up to a minute after a push with nothing on it saying so. Step 1 still reads `number`, `headRefName`, `title`, and `body` in one `gh` call and takes the head from the verb instead, which costs one extra remote round trip. The `<short-sha>` naming the Step 4 body file is drawn from the same tip, so a body file and the ancestor test beside it name one commit rather than two.

## A request that reads the section rather than the body

`standards/pr.md` defines `## For the reviewer` as what the reviewer should confirm, one bullet per request, and `review-pr`'s fifth lens reads that section.

Reading the whole body was considered and declined: the Summary and Technical Context sections carry the author's argument for the change, and a reviewing pass reading that argument while judging the change is most of what an independent vantage exists to avoid. Step 3's fourth lens already draws its bound at `## Testing`, so the fifth lens draws its bound at `## For the reviewer` and stops there, reading neither the sections around it nor the rest of the body.

Answering a request takes the Testing question's shape rather than new machinery, since the two match on the surface: an item that is not a finding still has to survive to a reader, still has to avoid the merge-blocking counts, and still has to keep the thread open until it is settled. The output block sits beside the Testing block in Step 4 for the same reason the lens sits beside the Testing lens in Step 3.

Owed narrows to a bullet the pass could not answer, matching the plan's own suggested wording, rather than every bullet a pull request carries. Treating every bullet as owed the moment the pass carries one would force the open heading and a dispatch on every pull request carrying the section, whether or not anything is left for the author to do, since a reviewer request is normally discharged by the same pass that reads it, unlike a Testing question, which stays owed until the author answers on a later pass.

A pass whose bullets are all answered takes the closed heading with the block standing in for the canned line, the same shape a withdrawn finding already takes.

`standards/pr.md` names the reader as the reviewing session rather than leaving `the reviewer` ambiguous between a person and a session.

## A submitted review cannot be deleted

A submitted pull request review is editable and never deletable. `DELETE /repos/{owner}/{repo}/pulls/{n}/reviews/{id}` returns 422 with `Can not delete a non-pending pull request review`, and dismissal covers approvals and change requests rather than comments, so a mistimed or malformed comment is repaired with `PUT` to the same path, which replaces the body and keeps its timestamp and position in the thread. When the repair leaves a comment that should no longer anchor the review state, strip its heading, since `review-pr` scopes a later narrow pass by matching a comment's first line against `## Review` and `## Review closed` and would otherwise point the next pass at the wrong commit.
