---
title: Skill review paths
description: The version-sequencing surface that was gated and then retired, the two-pass model a pull request review posts under, the rebase stage the worker's return leg carries, and the worker role holding its own half of the channel
---

# Skill review paths

## The version-sequencing surface, gated and then retired

`role-orchestrator` asserted an active version from a roadmap this repository never had. The file was specified by a bundled standard, written by a `claude-roadmap` skill, and read by `role-orchestrator` and `review-pr`, and it never existed here. Every read path skips a missing file by instruction, so nothing failed loudly and the `Active: vX.Y` output line was unsourced on every run since the skill shipped.

Drafting the file was the obvious fix and its own standard forbade it. All eight MVP features in `.claude/REQUIREMENTS.md` have shipped, and the standard's Lifecycle section said the scope is exhausted once the last version ships, with later work arriving as discrete items. A table of the current maintenance labels would have satisfied the format and broken the lifecycle rule in the same file.

So the claim was stripped rather than sourced, and a gate was added to the writer so invoking it directly could not draft over an exhausted scope either. Both were repairs to a surface whose own lifecycle rule ends its usefulness at the last MVP version, which is what the retirement then acted on: the skill, the standard, the scenario, and every read of the file are gone, and the two consumers report the board instead.

### What the retirement left open

Cross-version sequencing rationale now has no home. A row's `Waiting on` cell in `.canon/tasks/priority.md` carries why that row sits where it does, one line per row, and reasoning spanning several rows reaches a later session only through whoever remembers it. Both skills already ran correctly against a missing file, so nothing broke, and stating the gap is the honest end state rather than inventing a second document that would be the retired surface under another name.

`standards/requirements.md` keeps its Lifecycle section, which now says that later scope arrives as a new section and that nothing sequences either list into versions. The gate it fed is gone with the writer, so the section is read by a person rather than by a guard, and the `## Distribution` carve-out that kept a greenfield project from tripping that guard went with it.

## Asserting a routing decision

A router is reviewable only through what it says. Almost every `canon-operator` route ends in a handoff or a report rather than a file, so the local pass and the pull request pass both read a body claiming a route and neither can tell whether the route fires. The drift report it reads shipped with three sandbox arms and was confirmed against six real targets, while the router consuming that report had never been executed by anything, and the ship report still read as though the update path were proven.

The `reply` expectation is what closes it. It reads `result` off the envelope `max_turns` already reads, so scoring a route costs nothing beyond the run, and the token worth pinning is the name of the skill or command the route hands to. Five arms were using it before the router shipped, `claude/setup-init/fresh` among them, so the mechanism was in place and the arms written for the report asserted only the file it produced.

Pinning phrasing is the cost, and it is why every route pin is paired. A reply naming a skill in a sentence declining to route still passes a substring check, so each arm carries a `manual` entry stating the negative a substring cannot express, and the arms whose skills may execute nothing assert the tree as well: the root layout is still at the root and nothing appeared under `.claude/`.

Where a handoff may legitimately continue into the skill it names, as a fresh target's does into `setup-init`, no tree assertion is declared at all, since none separates the router doing the work from the router routing to something that does it. The arms themselves are catalogued in `.claude/context/sandbox/coverage.md`.

## The review two-pass model

`review-pr` read that same path and asserted nothing from it, so it carried no defect to fix there. Its read informed a review comment, and the body sat inside a rewrite's file set where an edit would have bought a rebase for no behavior change. The retirement pointed it at `.canon/tasks/priority.md` instead, which is a read of the same kind against a file that exists.

That rewrite landed as a second pass the skill had never described. `review-pr` posts twice over a pull request's life, a first pass and a close-out, and `role-orchestrator` step 6 assumed the second one while the skill body defined only the first. The body path carries the head commit now, `body-<number>-<short-sha>.md`, because keying on the pull request number alone stops two sessions reviewing different pull requests from colliding and says nothing about one session posting twice.

Callers invented five spellings for the second file across roughly twenty-five scratch files, and the sessions that had already written the defect down overwrote their first-pass body anyway. A name the caller has to choose is a name the caller gets wrong, so the fix is that the second segment is derived.

### When the head repeats

Deriving from the head leaves a later pass with no legal name whenever the head stops moving, which is an ordinary state rather than an error. A fix landing in gitignored records produces no commit, since the return leg delegates its push to `git-followup` and that skill stops on an unchanged tree, and a finding the worker accepts as recorded produces no change at all. The close-out is still owed on both routes, because the newest heading is what an operator reads to decide whether the branch is blocked.

So a repeated head takes a third segment off the `## Review response` comment the pass answers. The thread is what moved, the id is a real object rather than a suffix someone picked, and the head still leads the name, so the second body sorts beside the first. Both prohibitions survive intact instead of gaining an exception. A pass index was the other candidate and it loses because nothing in the thread carries it, so a session would count prior comments to pick the next one, which is the hand-chosen suffix the rule already forbids.

The number sits only in the comment `url`. `gh pr view --json comments` returns a GraphQL node id under `id`, which names the same comment in a form the thread does not show. Extracting it needs a null guard, since the jq that splits the url aborts on an empty selection and an aborted command reads as an error rather than as the empty result the stop is written against.

Selecting the response also has to be scoped by the prior pass's `submittedAt` rather than by the heading alone. A heading match alone takes the newest response in the thread whatever its age, so a re-run after a close-out resolves the id that close-out already used and rebuilds the collision the third segment exists to prevent. Nothing about that run is anomalous, since the skill is invocable by hand, so the unscoped read fails on an ordinary path rather than at an edge. Testing whether the derived name is already on disk was the other candidate and it is weaker, because the scratch folder is gitignored and a second machine holds none of it, so the test passes exactly where the record it consults is missing.

An empty derivation is a head repeating with no response behind it, so the pass has nothing to add and stops rather than writing a second body over one commit. Where a response or a rebase report sits there, it is the entire read: the equality that triggers the naming case makes Step 2's range empty, so the comment rather than the delta is what says whether a prior finding landed. A late finding is the one exception, since the read also opens the file the comment names, covered in the next section.

### Where the stop had to sit

The stop shipped inside Step 4's filename derivation and a duplicate close-out landed six days later anyway, four minutes after the one it repeated at the same commit. The rule was correct and the pass that produced the duplicate still reached `gh pr review`, because the derivation only runs on the path that composes a body. A pass reading the head as unchanged has nothing left to add, and nothing forced it through the one step that checked for that.

The fix moved the check itself rather than restating it: Step 2 now runs the same response query the moment the ancestor test reports an unchanged head, ahead of the diff read and ahead of Step 3's review, and stops there when it comes back empty. That is the earliest point every path through the skill crosses, so a pass with nothing to add can no longer reach a `gh pr review --comment` call by skipping the step that used to catch it. Step 4 keeps deriving the third filename segment for a pass that does proceed, off the comment id Step 2 already resolved, since collision avoidance in the name is still owed once posting is decided.

Deriving it also decides what a close-out reads. The last comment the skill posted names the commit the prior pass covered, so the close-out reads that range to the head rather than the whole change, and which field carries that commit is the next section's subject. Whichever it is, it settles the rebase case without a second mechanism: after a force-push the prior commit no longer reaches the head, `git merge-base --is-ancestor` exits non-zero, and the skill pays for a full pass and states that in the body. Scoping by the prior review's timestamp instead would have needed its own rebase test, since a commit's author date can predate the push that put it on the branch.

The relocation copied the equality test verbatim, and the test matched `## Review response` alone against the three headings the poll already treats as one family. `## Post-review findings` reaches the same test as a reply carrying no commit behind it, which is exactly the shape the relocated stop exists to let through, so a pass dispatched for a late finding met the stop built for an ordinary rerun and refused instead of posting. `## Rebase` needed no widening to reach it, since a rebase moves the head and the pass takes the non-ancestor path before this test ever runs. The query now matches the whole reply family, and the filename segment Step 4 derives off the same resolution widens with it rather than staying keyed to one heading. Measured 2026-08-26.

Widening the query surfaced a second gap the same shift exposed: a `## Review response` is an answer to a finding this skill already argued, so reading it and skipping the diff and file reads costs nothing, but a `## Post-review findings` reply asserts a defect nobody has checked, and the first arm run proved it. The pass read the worker's claim, never opened the file it named, and posted a should-fix sourced from that claim alone, which is the reviewing session repeating an assertion rather than checking one. Step 2 now splits on the heading: a response or a rebase report still skips straight to composing the body, and a late finding gets the file it names read at `<headRefOid>` first, the same confirmation Step 3 already runs against a stale ticked box. Measured 2026-08-27.

### A close-out repeating the standing one

The unchanged-head stop tests an empty range, so a pass whose head moved passes it whatever the thread already says. `#1201` ran three passes on 2026-08-28, `## Review` at `1d128ce` and `## Review closed` at both `1d51b0d` and `9666bb8`, and the two close-outs read alike. Every step was individually correct, which is why nothing reported the pair and the operator found it by reading the thread.

The shape that produces it is narrow enough to name. A pass tells the author a change is their own call, the author makes it, and the delta the next pass reads has nothing left to say by construction, so a correct pass over real commits arrives carrying nothing.

The guard therefore turns on the standing verdict rather than on the range. Step 2 widens its existing query to return the last family review's first line beside its commit, one read answering both, and Step 4 rewrites the standing close-out through `gh api -X PUT` instead of posting beside it. `PUT` keeps the timestamp and the position in the thread, so the verdict stays where a reader last found it, and a submitted review cannot be deleted anyway.

Suppressing the pass was the first alternative and it fails twice. A reader scanning the thread would see a close-out naming an older commit with no way to tell whether the newer one was covered or skipped, and a test broad enough to suppress early would swallow a pass that raised a real finding. That second cost is why the guard sits after Step 3 rather than beside the stop it reads next to.

A sixth heading was the other alternative, and the five-heading set closes it outright. `poll.sh` matches those five in jq and reports anything else as `UNMATCHED`, so a `## Superseded` would break the classification it would be invented to clarify.

The rewrite used to cost the review's `commit.oid`, which `PUT` leaves at the commit the standing close-out was first submitted against. Step 2's prior commit and the one `poll.sh` derives both read that field, so the next pass read a range wider than its delta, and repairing it needed a second mechanism carrying the covered head outside the field GitHub pins.

`poll.sh`'s `SEEN` branch was the sharper half and it was measured rather than assumed. That branch fires on `prior` equalling the head, which a pinned `commit.oid` never reaches, so an out-of-band pass over this pull request reported as `MOVED` for the rest of its life. It was one wasted dispatch per head move and not a repeating one: `FINAL` writes the head the run observed back to the baseline every tick and the report gates on `old_head`, so `head != old_head` fires once per move whatever `prior` says. A review pass read it as a loop posting every three minutes, which the baseline write rules out.

The second mechanism arrived as the read-time marker below and closed both without touching the rewrite, since `PUT` replaces the body and the marker rides in it. What `PUT` still cannot move is `submittedAt`, so a rewritten close-out ages from when it first landed, which is the reading the poll's age test wants.

The guard fires on `## Review closed` alone. Two open passes carry different findings and both are worth reading, so a repeated `## Review` stays an ordinary post. Measured 2026-08-28.

### The commit a pass records

GitHub stamps a review with `commit.oid` and `submittedAt` when it is submitted, and neither describes what the reviewing session read. A push landing in the compose window moves both onto a commit the pass never opened, so the next reader scopes its delta past that work and reports it covered. It fired on a pull request here on 2026-09-07: a pass read one commit, the branch pushed another while the comment was composed, the posted review carried the second, and the poll reported it as `SEEN`. What that skipped was a genuine fix, and a reader comparing the sha in the report against the sha in the pass caught it rather than any check.

The pass now writes its own record. Step 1 captures the instant ahead of every read it makes, and Step 4 ends every body with `<!-- review-pr: commit=<sha> read-at=<iso8601> -->`, an HTML comment a reader of the thread never meets. Both halves of the marker come from the top of the pass rather than from the post, so the window belongs to the next reader rather than being claimed by this one.

The reader takes the last non-empty line and searches nowhere else, which a review pass on the branch that built it caught. Searching for the last match anywhere reads a marker a body was displaying rather than claiming, since a fenced block showing the format on its own line trims to exactly the pattern, so a pass illustrating the convention and carrying no marker of its own would hand the next reader a commit off an illustration. Whole-line anchoring alone does not separate the two, because it only defeats the inline form where backticks leave the trimmed line unmatchable. Position costs nothing, since Step 4 already writes the marker last in every body.

`canon pr review-state` is the only parser of that marker, and `src/pr/review-scope.ts` behind it. Two readers were the alternative and it puts one format in a shipped skill body and a shipped bash script that ship on different cadences, which is the drift `poll.sh`'s own header already warns about for the five posted headings. The record carries `source`, reading `marker` for a pass that wrote one, `fallback` for one posted before this shipped, and `none` for a thread with no pass, so a caller can tell a read-time answer from a stamped one rather than trusting every commit alike.

The stamps stay live for the question each is right about. The poll's age and its `STALLED` branch read `submittedAt`, since how long a comment has waited on a human is a fact about the submission, and the pass instant that scopes a reply query reads `readAt // submittedAt`, since what a pass had read is a fact about the read.

What it costs is a release of silence and a round trip. A target whose CLI predates the verb meets a missing subcommand, and both the skill body and `poll.sh` carry a written fallback that reads the stamps and reproduces the defect rather than failing, so the fix reaches a project only once a release does. The poll also spends a third `gh` read per open pull request per tick, on top of the payload and `canon pr head`. Measured 2026-09-08.

### The heading contract

The heading is the half a reader sees without opening anything, so it reports state rather than pass number. `## Review` covers a pass carrying a finding at any severity and `## Review closed` covers a pass carrying none, so the state comes off the most recent comment rather than off a label on a kind of pass. A close-out does not close the pull request, which is why the rule reads the latest heading rather than promising the closed one is last.

Coupling it to the pass number instead was measured wrong on two reviews in five, since twenty-one of fifty-three close-outs reported an open finding under a heading asserting closure. `review-address` nests `## Review response` under the first of those, so a thread reads as opened, answered, still open, closed.

Sharing a prefix across that family is why the detection matches the first line for equality rather than testing a prefix. A prefix test also accepts `## Review response`, and it happened to be safe only because `review-address` posts through `gh pr comment`, which lands in `.comments` and never in `.reviews`. Nothing recorded that dependency, so the close-out would have started scoping to the worker's reply the day that skill switched to posting a review. An equality test costs the same and owes nothing to a sibling's choice of command.

A finding withdrawn on a reply's argument leaves that count too, so a pass withdrawing every finding it carried reads as a close-out while still owing a body the short close-out line cannot carry, since that line credits a fix nobody made. `.claude/context/claude-internal/orchestration.md` holds why a reply reaches the thread at all and which class of reply stays off it.

### The full set, stated once

Four headings shipped and only two reached `poll.sh`: the script matched `## Review response` and `## Rebase`, so a worker posting under anything else was invisible to it. A reply landed under `## Post-review findings` twelve seconds after a close-out and sat unread until the operator asked whether it had been, because no rule routed it and no state reported the miss as anything but no movement. Measured 2026-08-21.

The fix names `## Post-review findings` as a fifth heading rather than leaving it invented, since a worker with something to report after a close-out already needed one and had none, and gives it the same routing `## Review response` gets: `poll.sh` reports it as a reply and sends a fresh pass. Which headings exist, which family each belongs to, and who posts each is stated once in `review-pr`, beside the threshold that skill already states once, so `review-address` and the poll cite it rather than carry their own copy.

A comment posted under a heading outside the five is reported as unmatched rather than passed over. Silence and a match read alike otherwise, which is the shape of the miss this closes, so the poll now surfaces an invented heading as a state a person reads rather than absorbing it the way the fifth one was absorbed before it had a name.

### The closing comment folds into the reply, not a sixth heading

`review-address` Step 7 posted its CI confirmation as a sixth comment shape, carrying no heading at all, and a task was filed reading that comment as reaching the poll's `UNMATCHED` state. It does not: `JQ_UNMATCHED_STATE` opens with `select(startswith("## "))`, so only a comment whose first line already carries a heading prefix reaches the five-way test at all. Driven against both posted confirmation strings, the filter returns `0 none`, and a control case carrying an unknown `## ` heading returns `1` and names it. The heading-free confirmation passes over exactly the way ordinary human chatter does, which is the filter working as built rather than the defect the task was filed against.

What survives is smaller. The confirmation states nothing the `## Review response` reply posted moments earlier does not already carry, so the write reaches no reader on either side of the channel. Step 7 now appends the confirmation to that reply and edits it in place rather than posting a second comment, which is the same call the corpus already made once against a sixth heading, above.

Measured 2026-09-04.

### One threshold under the heading and the dispatch

The threshold moved four times on 2026-08-14, and the defect this section records is the cost of each move rather than any one value it took. It ran as a heading on any finding with a dispatch floored at should-fix, then both at should-fix, then a heading at should-fix with a dispatch on any finding, and it now sits with both on any finding.

The first arrangement left a minors-only pass between two rules that disagreed, so such a pass read as open while no rule told anyone to act on it. The same situation was handled two ways within one hour, one thread closing with the item named in prose and a zero count and the other staying open on a count of one. Unifying both at should-fix answered that and held for hours, until a live minors-only pass closed cleanly and dispatched nobody and the work sat until the operator ran the address skill by hand.

Taking the dispatch floor off rather than the heading rule was the third arrangement, and it rests on the measurement that made the grade load-bearing: across 8 findings on an archived pass, 3 were posted as minor and 2 of those were defects a worker fixed rather than recorded. A grade running that low cannot decide whether anyone is sent. What it left behind is a thread reading closed while work was owed on it, which the operator met in practice and reversed the same day. The ladder itself went on glossing a minor as visibility only through both arrangements, which is a claim about who acts rather than a definition of the grade, so it now names the lowest grade and says the ranking decides nothing about the dispatch.

So the heading came down to the dispatch rather than the dispatch going back up to the heading. A pass carrying anything posts the open heading and sends the session holding the branch, and the closed heading is reserved for a pass carrying nothing at all, which makes it the marker worth scanning for. The summary line stops reporting the merge as clear under either heading, since a thread reading open cannot also report that nothing blocks it.

The cost is that a reader can no longer take the merge decision from the heading alone and reads it off the counts on the summary line instead. That cost was stated when the option was offered and accepted with it. What it buys is one threshold governing both again, which is the invariant the poll's stalled state already assumed.

Restating the threshold is what made each move expensive. Eight files carried 32 statements of it, measured at `69c6213e`, and one surface contradicted itself on main: the orchestrate skill's dispatch step said any severity while the bullet under it named a floor the line above had removed. `review-pr` now states the rule once and every other surface cites that skill by name. A citation is the whole mechanism available, since the surfaces ship separately and none of them can import anything, so what this buys is one edit for the next move rather than eight.

What a citation does not buy is a check. `poll.sh` and the `pr-review` sandbox scenario both pin heading strings the skill owns, and nothing compares either against the body that states the rule, so a skill edit missing one leaves an arm scoring green against a rule nothing follows. Building that check was declined rather than deferred: comparing a script's literals against prose is a parser over prose, which is a larger question than the threshold it would guard. The gap is recorded here instead, and it is the reason a change to the rule reads every pinning surface by hand.

A minor the dispatched worker declines goes to the `## Findings` section of the task the branch closes, which the queue-refill sweep already names as the destination for a finding that changes another task. That routing does not follow the threshold, since a declined minor needs a surface surviving the merge whatever heading the pass carried.

Whether a finding is new in the diff or pre-existing and out of it is the real difference behind the two handlings, and it stays off the thread. It is a second axis on a ladder already called imprecisely, and the single threshold closes the gap without it.

`poll.sh` carries the detection, because a rule firing only when a session reads it is what produced the inconsistency. A third jq filter takes the last family review's first line rather than its commit, and a `STALLED` state names a pull request whose open pass covers the head with nothing following it. Reporting a standing condition rather than a transition would fire on every later run and the board would never read `No movement.`, so the classification writes a marker into the baseline field it derives and reports once per entry.

The heading alone cannot decide it, which the marker hides rather than fixes. One threshold under the heading and the dispatch means an open pass is a dispatch owed and made, so the healthy thread is a worker still working and every dispatched pull request would be named minutes into the work it was sent to do. A signal firing on the healthy path is one an operator learns to skip, which is the always-on failure the runbook already records from the other direction. The same filter therefore emits the pass's age beside its heading, computed in jq because `date -d` is GNU-only, and the state adds a floor of two hours. That is several times a review-to-follow-up cycle and well short of a thread left overnight, and a project whose workers run longer raises the constant. A review carrying no timestamp reads as age zero and classifies nothing, matching the answer a pull request the run could not read already gets.

Keying on elapsed time rather than on two consecutive quiet polls also drops the history the state needed. A baseline written before the field exists reads as not yet reported, which is what it is, so the first run after an upgrade names a thread already past the floor instead of waiting a poll to confirm what it can already see. The prose half still cannot be dropped, since the script reports and never instructs and the state catches only a thread already in the wrong shape.

Unifying the heading with the dispatch widened what the state reaches back to every stalled dispatch, since a pass carrying anything posts the open heading this reads. A stalled minor now reports on the same terms as a stalled blocking finding, where the split arrangement left it invisible. The state stays a heading test either way, so nothing here pins the summary line's counts, which is a second string from `review-pr` that this script would have to track through every edit.

## The rebase stage

`review-address` gained a stage between the doc refresh and the push, because a branch that answered every finding still stopped merging once a sibling landed first. No worker skill mentioned rebasing at all, so the return leg closed the review and handed back a branch nobody could merge. Detection needed no new surface, since the orchestrator's poll already reports `CONFLICT` on the transition rather than only when the head moves.

The stage sits after the fixes rather than before them so one force-push carries both, which is also what keeps the reviewer reading a single delta. It tests with `git fetch origin main` followed by `git merge-tree --write-tree`, chosen over `gh pr view --json mergeable` because that field returns `UNKNOWN` exactly when a poll asks.

### The no-findings path

The test runs ahead of the no-findings guard rather than inside the fix path. Placing it at step 5 alone put it behind a guard that stops with a pass when the pull request carries no comments, and a branch goes stale from `main` moving rather than from anything the review said, so the case the stage exists for was the one shape it could not reach. The guard now decides on the test rather than on the finding count, and a run carrying no findings skips to the rebase.

Opening that path meant the three steps behind it stopped being true. The reply maps each finding to what changed, the terminal confirmation says every finding was addressed, and the output line counts them, all against a pull request carrying none. Each gets a rebase-only form rather than an empty list, and the reply takes a `## Rebase` heading rather than `## Review response`, since the second claims a review the run never read and would sit under a `## Review` that does not exist. The heading also stays outside that family so the close-out's first-line equality test cannot match it.

### Two runs of the test

It also runs twice. `git merge-tree` reads committed history and the fixes are uncommitted at step 5, so a branch that merges clean as committed, whose fixes touch lines `main` moved, passes the first test and reaches the remote unmergeable. The second run sits after `git-followup` commits, and it costs an extra force-push only in that narrow case.

The fixes are uncommitted by then, so the stage stashes before the rebase and pops after, and the resolution rules cover hunks from both. Both halves are conditional on a dirty tree, since a run answering every finding as a conscious-accept leaves nothing to stash and an unconditional pop would restore an unrelated entry from an earlier session. That same run has no commit for `git-followup` to carry either, which is why the push leg names a direct force-push for it.

### Conflict resolution

The rules are stated where the stage runs, which is what makes it safe. A wholesale `--ours` or `--theirs` drops one side silently and passes every check, since both sides are valid content, and a generated file merged by hand produces a diff the next regen discards. Half of the live case was exactly that, two `index.md` files carrying no `auto: false`. The other half was authoring rather than merging, an entry that opens by counting what follows and now had to count three, which is why the worker owns this and the orchestrator cannot.

No comment channel was built for it. Both sides of every hunk sit in the conflict, `main` is what the operator approved, and `git log origin/main` names what landed, so a per-conflict comment would restate the diff and add a surface the worker waits on. A hunk the tree does not settle stops instead and reaches the operator as an ordinary finding on the next pass, which holds only because the stage forbids guessing rather than leaving it to judgment.

`git-followup` absorbed the consequence at its push, forcing under a lease when the tracking branch no longer reaches the head. Its plain `git push` was rejected on a rewritten branch, so the stage would have dead-ended one step past the resolution it exists to perform. The re-read is already covered above, since the close-out's ancestry test falls back to a full pass on exactly this branch shape.

## The worker's own half

`role-worker` exists because the return leg the rebase stage above depends on was documented entirely on the side that does not perform it. One shipped body asserted a session role and it was the orchestrator, while worker behavior spread across `session-worktree`, `auto-ship`, and `review-address`, each owning a step and none naming the role or the channel. The handback worked because a session reading plain text tends to follow it, which held while a person launched every worker and stopped on 2026-08-27, when the first self-dispatched worker ran with nobody watching.

`auto-ship` Step 0 invokes it, in the position that already invokes `session-worktree`. That reaches a dispatched worker and a hand-launched one on one path and needs no change to the launch command, at the cost that a session doing something other than the ship chain never asserts the role.

The body stays thin by construction, since it has three readers who need different things from it. A dispatched worker reads it as its whole operating contract with nobody watching, a hand-launched one reads it beside a person who can correct it, and the orchestrator reads it to know what it may assume. A rule written for the first can be wrong for the second, so the body carries the role, the boundaries, the three obligations, the refusal right, and the lifetime, and points at the three step-owning skills for everything else.

### The channel splits by who sends

Each half is stated where its sender reads it. The worker's obligations sit in `role-worker` and the orchestrator's handback stays in `orchestrator-poll.md`, and the alternative of one shared section puts a worker's duties in a file no worker loads, which is the whole defect. The orchestrator's step 6 now points at the worker skill rather than holding the only copy.

Three messages are owed and no more. One announces the pull request when it opens, carrying the number, the branch, and the task it closes. One announces when an address-review pass finishes, carrying what was addressed and the pull request's new CI state. One reports a block before it becomes an interactive prompt, which is the ordering that matters: a queued message drains at the next tool round and a session already waiting on input never reaches one, so an answer relayed to an open prompt renders beneath the question and changes nothing. Nothing is sent on progress, since a worker reporting progress rebuilds the poll on the other side of the channel.

A launch naming `review-address` alone reaches no `role-worker` and takes no role either, which is what let a replacement worker on `#1251` address a posted review by answering on the thread and telling its controller nothing, measured 2026-08-30. `orchestrator-dispatch.md` gained a second launch shape reaching the role directly for that case rather than reusing the plan-build shape's chain, carrying the same `<dispatcher-id>` resolution the build shape already documents.

Refusing stays a first-class move rather than a failure mode. Four measured halts across two days were each correct and each cost the dispatcher one reply, and the correction that mattered most reached the right place because a worker argued back with evidence rather than complying, which a body written only as report-upward would suppress.

### A gap two declined shapes left open

`role-worker` and `role-planner` each state a channel and each assumes a message-sending tool carries what they compose. A standalone skill was proposed for the session holding none and it never fired, because nothing routes a session to a skill matching no request and reaching for no artifact of its own. The firing condition was the part that mattered, and the standalone shape carried none.

A first draft kept the firing condition and lost it back to duplication instead. It moved the protocol inline, once into each role body, and the operator overrode that call the same day: two bodies stating one protocol is the shared-surface case `.claude/ARCHITECTURE.md` already decided against, since a later fix reaching one copy and not the other diverges silently.

`session-relay` is the shape that keeps both. The firing condition survives because the pointer sits inside `## The channel`, a section both role bodies already read at session start rather than one reached by request match alone, and what remains duplicated across the two bodies is two sentences naming one skill rather than the protocol itself. A pointer drifting from its target fails loudly, since the skill it names either resolves or does not, where two copies of one protocol drift from each other in silence, which is the failure the standalone skill and the inline draft each carried in a different shape.

### A third case neither shape reaches

A session holding neither role has no `## The channel` section to carry the pointer, so it reads neither `role-worker`'s nor `role-planner`'s ladder and never learns `session-relay` exists to compose through. `canon-rollout`'s worker role is the concrete instance, structurally barred from `role-worker` since that body resolves session scratch against a main worktree root a target does not carry, and it met the gap by restating the block-before-prompt line inline rather than by finding a surface to read it from.

`core/091-channel.md` states the addressing and timing once, for a session that reaches it directly. A skill body may not depend on that arrival, since a plugin skill reaches a target the moment it merges while a governance rule reaches one only through a separate install nothing forces alongside it. `session-relay`'s own new guard, and `canon-rollout`'s, each restate the fact plainly rather than citing the rule's path, so a target holding the plugin without governance is refused with something to act on rather than pointed at a file that is not there. `session-relay`'s guard checks role membership first regardless: the incident behind this row hit the tool-availability guard first and read "you have a tool" as the whole reason, never learning steps 2 and 3 were unreachable regardless of the tool. Checking the role guard ahead of it surfaces the deeper reason instead of the shallow one.

### What the announcement bought and what it did not

The poll's condition narrowed from an open pull request or a dispatched worker to an open pull request alone. The script reads pull requests and a building worker has none, so five consecutive runs reported no movement across roughly fifteen minutes while one worker built, and the announcement covers exactly that interval because the transition from building to reviewable is the one moment only the worker knows.

The narrowing and the announcement shipped together, which removes a trigger before its replacement has ever run. The dispatched-worker condition survives as a fallback rather than as a trigger, applied to any dispatch still out after thirty minutes with no announcement, so a silent failure does not leave a finished worker unnoticed the way one already sat idle for eighteen minutes.

`scripts/watch.sh` covers the same window at lower cost and ships beside `poll.sh` rather than living in one session's temporary directory. It reads the open pull request list and the session roster together every sixty seconds, and coverage is the point: a worker that finishes goes idle and one that crashes vanishes, so a trigger matching only the pull request stays silent through the second. The shipped version resolves the repository from git rather than hardcoding a path, and it counts every session on a branch other than the base one as a worker rather than matching the `orchestrator-` prefix the prototype used, which reads a dispatched worker and misses every hand-launched one.

The output contract gained the state between the two it already carried. A session holding four running workers reported them under neither `Ready to build` nor `In review` and invented a shape per report, which the same section forbids while offering no term to use, and the launch section kept recommending a plan a worker was already building because the plan file sits in place for the whole build.

## The origin split at Step 6

`auto-ship` Step 6 splits findings by origin before it reads severity. A critical or should-fix finding the branch inherited stops the chain, and one this run caused is repaired in place at any severity, bounded at a single pass the way Step 3 bounds verify. Severity alone was the original test and it read "Do not auto-fix findings", which is the sentence twelve recorded runs stopped on while holding defects nobody else had shipped. Each cost a round trip to hand back work the same session had created moments earlier.

Origin is causation rather than authorship, which is the half that decides the hard cases. Staleness a run induces in a file it never opened is its own, so the test reaches a sibling skill body left wrong by a change to the origin-key set. The plan's file list is not the boundary either. It scopes what a run builds, and reading it as a review boundary is scope discipline applied to the wrong question, which is how one run gated a fix on the file it landed in rather than on who caused it.

An offer to fix is a stop however it is worded. Naming a finding self-inflicted in the report and closing on a menu of resolutions leaves the operator holding the work, so the step forbids presenting the repair as a choice and the receipt records the fix as landed.

## A question that reads the description rather than the diff

Step 3 gained a fourth lens that reads the pull request body's `## Testing` section against what the repository can drive. The three before it read the change, and this one reads the claim the author made about verifying it, which is the one part of a description a reviewing session can falsify: the branch author cannot see what a sibling branch drove the same day, and one wave had two branches tick every box while a third left two unchecked as needing a live session against an arm it had itself added.

It asks rather than grades, and that is why it stays out of the finding counts. Whether a human is genuinely required is a reading the author may hold a reason for, so the question carries no severity and enters no count.

Sitting outside the heading and the dispatch as well was the first shape and it was wrong. That is the split this file already records as rejected, reached from the other side: a question riding on a close-out lands on a thread reporting nothing owed, the dispatch never fires, and the one party who can answer never sees it. The lens produces nothing end to end that way, since its output is a correction only the author can make. The threshold now reads anything owed rather than any finding, which covers both without separating them, and the summary line names the question count beside the three that stay zero.

What it tests against is `standards/pr.md`, which narrowed in the same change to say what makes a human required: a capability the agent lacks, never the cost of the run. A refusal the author actually met counts and names itself, and a refusal predicted and never met does not. `review-pr` reads that file off the plugin root through the fallback citation form, the same route every skill citing it takes now that the fan-out and its `consumers` field are retired.

The lens later gained a fifth check reading the opposite half of the same section: a ticked box rather than an unchecked one. A box stays true only as long as what it names does, and a fix commit landing after review is what breaks that, so a box naming a test a later commit replaced reached the merge record with nothing positioned to catch it.

Bounded to a box naming a file or a command, since a claim carrying no artifact has nothing this lens can confirm, and testing that the named artifact still exists rather than re-running what the box claims, which keeps the check from turning a review into a test run. Unlike the Testing question above, a stale ticked box carries severity and enters the count, since it is a factual claim the body still makes rather than a judgment call the author is owed a chance to defend.

Confirming a file's existence has to key off `<headRefOid>` rather than local `HEAD`. `review-pr` never checks out the branch it reviews: Step 2 reads the diff and file contents through `gh pr diff`, `gh api`, and `git fetch -q origin pull/<number>/head`, resolving the branch tip rather than reading a checkout. A read against `HEAD` resolves the reviewing session's own branch instead of the pull request, which is a silent wrong answer rather than a missing one, since `HEAD` always resolves to something.

That resolution came off `gh pr view --json headRefOid` and now comes off `canon pr head --json`, taking the record's `tip`. The field it left reads a pull request object that trails the branch ref by up to a minute after a push with nothing on it saying so, which is how a pass on `#1341` posted a `should-fix` calling a pushed commit unpushed on 2026-09-01. Step 1 still reads `number`, `headRefName`, `title`, and `body` in one `gh` call and takes the head from the second, so the resolution costs one remote round trip the step did not spend before. The `<short-sha>` naming the Step 4 body file is drawn from the tip too, which means a body file and the ancestor test below it name one commit rather than two.

## A request that reads the section rather than the body

`standards/pr.md` defines `## For the reviewer` as what the reviewer should confirm, one bullet per request, and `review-pr` read no section by that name. A request written there reached no reviewing session, measured across the eight most recent feature pull requests at the time: they carried 28 bullets between them and none reached a reviewing pass.

Reading the whole body was the obvious fix and it was declined. The Summary and the Technical Context sections carry the author's argument for the change, and a reviewing pass reading that argument while judging the change is most of what an independent vantage exists to avoid. Step 3's fourth lens already drew this same bound at `## Testing`, so the fifth lens draws it at `## For the reviewer` and stops there, reading neither the sections around it nor the rest of the body.

Answering a request took the Testing question's shape rather than new machinery, since the two problems match on the surface: an item that is not a finding still has to survive to a reader, still has to avoid the merge-blocking counts, and still has to keep the thread open until it is settled. The output block sits beside the Testing block in Step 4 for the same reason the lens sits beside the Testing lens in Step 3: one part of the body a reviewing session is positioned to answer, next to another it already was.

The first pass at this treated any `## For the reviewer` bullet as owed the moment the pass carried one, and it broke on who answers rather than on the shape. A Testing question is raised by the pass and stays owed until the author answers it on a later pass. A reviewer request is raised by the author and is normally discharged by the same pass that reads it, so counting every bullet as owed forces the open heading and a dispatch on every pull request carrying the section, whether or not anything is left for the author to do.

Owed narrowed to a bullet the pass could not answer, matching the plan's own suggested wording. A pass whose bullets are all answered takes the closed heading with the block standing in for the canned line, the same shape a withdrawn finding already takes.

`standards/pr.md` named the reader as `the reviewer` without saying which one, so a person and a reviewing session both read the same sentence as naming them. It now names the reviewing session, closing the sentence the disagreement traced back to.

## A submitted review cannot be deleted

A submitted pull request review is editable and never deletable. `DELETE /repos/{owner}/{repo}/pulls/{n}/reviews/{id}` returns 422 with `Can not delete a non-pending pull request review`, and dismissal covers approvals and change requests rather than comments, so a mistimed or malformed comment is repaired with `PUT` to the same path, which replaces the body and keeps its timestamp and position in the thread. When the repair leaves a comment that should no longer anchor the review state, strip its heading, since `review-pr` scopes a later narrow pass by matching a comment's first line against `## Review` and `## Review closed` and would otherwise point the next pass at the wrong commit.
