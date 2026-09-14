---
title: Coverage
description: Coverage report, the blast-radius rule for which skills earn an arm, and the per-skill census
---

# Coverage

`canon sandbox coverage` reports which scenarios declare expectations and which only provision a state. It reads the fixture tree rather than running anything, so it costs nothing and needs no provisioned sandbox.

```bash
canon sandbox coverage           # framed report on stderr
canon sandbox coverage --json    # machine copy on stdout
canon sandbox coverage --strict  # exit 1 while any scenario declares nothing
```

Scenarios and arms count separately, and the report prints both rather than picking the flattering one. Several arms can share one scenario, so dividing arms by scenarios always produces the higher figure and the scenario percentage is the honest rollout number. Read the current pair off `canon sandbox coverage --json`, which carries `totalScenarios`, `armedScenarios`, and `armedArms`. A figure frozen into this paragraph goes stale again the moment another scenario lands, which is why the rule sits here and the numbers do not.

Both percentages floor rather than round. A ratio falling between two whole numbers reports the lower one, so a percentage that looks a point under a hand-worked division is the measure working rather than an entry left stale. `coveragePercent` states the reason.

Neither number weighs an arm by what it asserts. An arm can carry a single assertion over its own provisioning, such as `standards/skill.md` being absent, which is a claim about the fixture rather than about the skill under test. The count reads as scenarios reached rather than behavior covered, since nothing in it separates that arm from one asserting eleven things about a run, so a reader taking either percentage as skill coverage is reading past what the declarations say plainly.

The scenarios declaring an injection flag were recorded on 2026-08-21 as the first candidates for arming, on the grounds that moving to the real installers narrowed what they receive from all 38 source rules to the 20 in `base` and nothing would detect a scenario depending on a rule outside it. That reads stronger than it is. The flag is a boolean naming no rule, so which scenario depends on which rule resolves by reading the skill bodies rather than by paying for an arm each, and the rule below selects on damage instead. Only `SANDBOX_INJECT_GOV` remains, the standards injection having gone with the install channel. The overlap against the armed arms is still empty and no existing assertion is affected.

The date opening that paragraph is load-bearing rather than tidying, so a later pass rephrasing it has to keep one. That clause puts the quantifier `all` straight against a figure of 38 and then the catalog noun, which is the shape `canon gov counts` reads, so the figure lands as a whole-catalog claim against a tree holding 69 and only the date reads it past. Correcting the figure instead is the wrong repair, since 38 is what the tree held when the candidates were recorded and the sentence states the grounds of that decision rather than the tree today.

A scenario enumerates from its script under `scripts/sandbox/<category>/`, not from the fixture tree. An unarmed scenario has no fixture directory to find, so counting fixtures would hide exactly the arms the report exists to surface. A declaration sitting at the command root belongs to the unnamed arm and reports as `(default)`.

## What earns a declaration

Arm a skill when a wrong run is silent and the damage lands in a target project rather than in the sandbox. Blast radius decides rather than a coverage percentage. A percentage names no particular skill and counts an arm asserting one provisioning fact the same as one asserting eleven things about a run, so it rewards whichever arm is cheapest to write next.

The rule explains the arms already written as well as the next ones. Every skill armed before it was stated mutates a tree with no reader watching, so it describes existing practice rather than only constraining what comes next. `seed-sync` and `setup-init` are the two it selects that the harness can reach.

### The task board arms

`claude/task-board.sh` carries two arms, split because create and archive have disjoint preconditions and one arm running both would assert the second against a tree the first mutated. Both stage the board rather than inheriting one, since `SANDBOX_INJECT_SEEDS` drops `.canon/tasks/` and fills it with nothing but the seeded `index.md`.

The two arms cover different things, and the split follows what already has a test. `canon tasks archive` is a typed verb whose refusals `src/tasks/archive.test.ts` covers at 27 tests, so the archive arm stages a board that satisfies every gate and asserts the successful move. An arm asserting that the command refuses an open outcome would re-test a unit test through a model session at a dollar a run. The create path has no CLI verb at all, so the skill writes the file from `standards/tasks.md` and the whole of that arm is prose with nothing underneath it.

Three fixture properties are load-bearing:

- The create board runs three consecutive versions with no gaps, which is what forces the next one and puts the proposed label under an assertion. The slug stays free, so the arm pins the label through a `.canon/tasks/` reply fragment carrying the forced version and leaves the rest to the run.
- The archive task carries a `Pull request:` line and its `Plan:` line points at a live plan no other task cites. The first satisfies the skill's work-reached-main check without staging a remote, and the second is what puts the plan move under assertion, since a line already pointing into the archive would leave the verb nothing to carry. A `paths` entry over either source file still holds when the run refuses, because nothing moved.
- `priority.md` puts the archived task's row first and the control's second. An `absent` entry cannot express a removed table row, so the arm pins the separator line and the row that follows it, and a run that left the row in place pushes the control down and fails the match.

Neither arm asserts `.canon/tasks/index.md`. A hook regenerates it, so an assertion there would read hook behavior rather than the skill's. Both leave the main-worktree-root guard in `manual`: a standalone sandbox repository has no linked worktree, so `pwd` and the main root are one path and no run distinguishes them.

### The intake arms

`claude/plan-intake.sh` is the clearest case the blast-radius rule selects. The folder it writes is gitignored in every target, so no check in this repository or in a consuming one ever reads its shape, and a run that files a dump into the wrong numbering leaves a record cited for weeks with nothing reporting the drift.

The `file` arm pins the slug through the invocation rather than letting the run derive it. `paths` and `content` both match an exact path, so a slug taken from the dump's wording would leave every assertion naming a folder that may not exist. What that gives up is one line of the body against the whole of the folder shape, and the numbering still gets asserted, since the index links its cluster files and the pattern requires a two-digit number and a domain name in each link.

The `route` arm asserts a refusal instead of an artifact. Its three `absent` entries name the three folders a wrong turn would create, which is what separates a decline from a run that quietly opened a groundwork track, and the reply pin catches a stop that refuses without naming where the question goes. Whether the refusal turned on the question needing measurement or on the prompt being short is the part no assertion reaches, so it sits in `manual`.

### The routing arms

`claude:canon-operator/unmigrated`, `claude:canon-operator/installed`, and the whole of `claude/migration-standards.sh` are retired along with `canon snippets install`/`sync` and the `migration-standards` skill. `ROOT_LAYOUTS` in `src/sync/layout.ts` now permanently reports no unmigrated domain, so the routing those two arms scored can never fire again.

`claude/canon-operator.sh` drives a skill whose subject is a decision rather than an artifact. Almost everything the operator routes ends in a handoff or a report, so a rule selecting on what a wrong run leaves behind exempts nearly all of it, and the damage is real either way: a target sent to the seed reconciler instead of the installer, or to a domain sync for a domain that has nothing installed to sync. The ignore-only route is the exception, since it runs `canon tooling inject --gitignore` itself and the file it merges into is the artifact.

`reply` is what lets a routing decision be asserted at all. An arm pins the skill or command each route names, paired with a `manual` entry naming the negative a substring cannot carry. Most such arms also assert over the tree in the direction a correct run must leave it alone: the staged root layout stays where it was staged, nothing appears under `.claude/`, and a staged entry or plan survives a pass that only measures.

The `gitignore` arm instead pins what the write produced, the managed entries back in the file and the install stamp left as the inject wrote it, which separates the narrow mode from a full inject running under its name. The `fresh` arm carries no such pin, because a handoff to `setup-init` may legitimately continue into that skill and write the whole scaffold, and no path assertion separates the router doing the work from the router routing to something that does it, which leaves `fresh` reachable only from a real run rather than a standalone `canon sandbox check`.

`unclaimed` is the arm whose reply names no skill and no command: the reverse walk reports a folder the toolkit stopped shipping and offers nothing, so the token that has to survive is the attribution rather than a route. Provisioning refuses a CLI whose report attributes no unclaimed folder at all, which is the two-speed release risk `ARCHITECTURE.md` records arriving in the harness rather than in a target. Reading attribution rather than the bare key is what makes the guard prove the walk reached the staged folder instead of proving only that the field exists, and a guard reading attribution still cannot separate a binary predating the walk from a walk that ran and reached nothing, which is why the refusal message names both causes rather than a version to install.

Every section of the report, the reverse walk included, is gated on `isManagedTarget`. The fixture stages a `package.json` and a dropped folder, and, since an arm inheriting its premise from dev-skill injection holds only while the branch changes that skill, a short `CLAUDE.md` as the one marker `isManagedTarget` needs from it. Short is load-bearing, since a file past the 250-line checkpoint adds a `migration-claude-md` candidate and the arm would score two decisions in one reply.

The declaration also pins the folder name beside the verdict, against the general rule that a name history decides does not belong in a pin, because the second guard fails provisioning the moment that root comes back and a reader sees the fragility where it is rather than inside a declaration going quietly vacuous.

### The rollout arm is the first whose subject writes into another repository

`claude/canon-rollout.sh` is the strongest case the blast-radius rule selects, since the skill it covers is the only one in the catalog that enters a worktree in a project this repository has no test coverage over and pushes a branch there. What the arm can reach is a fixture rather than a real target, so it covers the decision taken before any dispatch rather than the dispatch itself.

The fixture is three repositories rather than a directory tree. A clone's currency is a fact about its history against a remote, so the arm builds a bare origin and two clones after the outer commit, on the gitlink-avoiding pattern `infra:gov`'s `test-order` arm already runs. `kestrel-b` moves the remote forward and `kestrel-a` is left one commit behind and sorts first, which makes the wrong answer the one a run picking by listing order reaches.

Two properties are load-bearing. Both clones are taken before the divergence, so currency is the single thing separating them and no other property can carry a correct pick by accident. The narration fixes the two-line format the decision is written in, the way the intake `file` arm pins its slug through the invocation, because `reply` cannot separate the two picks from each other: a correct answer names both clones and so does a wrong one, and only an anchored pattern on the dispatch line reads which was chosen.

The arm asserts a decision and forbids a build, which leaves the same tree behind for a wrong pick as for a right one on every assertion but those two content blocks. That is why the pair is there rather than a reply pin alone.

The fetch is forced by the fixture, and that came out of provisioning the arm rather than designing it. Nothing fetches in `kestrel-a` after the clone, so its own `origin/main` stays where the clone left it and both checkouts read level until a run goes to the remote, with `kestrel-a` reading one commit behind only afterwards. A run reading the pair as it sits cannot separate them at all, so a run answering without a fetch answered by guessing between two clones that looked identical.

The fetch is what turns that from a `manual` line into an assertion. `FETCH_HEAD` appears in both clones only if something fetched during the run, and `git clone` writes none on its own, so a `paths` entry over it proves the fetch outright rather than leaving an arm that cannot observe its own precondition.

`write_scope` admits what a fetch touches and keeps out what it never does: `FETCH_HEAD` in both clones, the remote-tracking ref, the log behind it, and the objects the fetch pulls, but no working-tree path, nothing under `targets/origin.git/` so a push to the shared remote still fails, and no `refs/heads/**` so a run cutting a branch fails the scope as well as the `absent` entry. Remote-tracking refs move on a fetch and local heads do not, which is what makes that the right place to cut.

The arm's measured turn ceiling is 15, with room above a passing run's own cost. Both remaining `manual` entries are judgments over free text rather than gaps a fixture could close.

Two arms cannot share one sandbox. `resolve_sandbox_dir` and `sandboxTree` mint a fresh tree per run rather than sharing one default, which is what `canon/context/sandbox/running.md` covers, so read a whole-tree escape list or a failure count far past the declaration as a tree collision before reading it as a finding either way: a stale `canon` still sharing the old default, or two commands pinned to the same hand-set `CANON_SANDBOX_DIR`.

The population is given in the narration rather than read. `canon targets list` answers from the machine-level index, so a run left to enumerate for itself inside a sandbox reaches the operator's real consuming projects, and no fixture can scope a machine-wide record. The narration bounds the run to the sandbox and the arm asserts nothing outside it.

### What the arm's escape scope proves and what it does not

The arm declares `escape_scope = []`, the first declaration of that key in the catalog, and `canon/context/sandbox/overview.md` states the mechanism. What follows is what a reader takes from a pass or a fail once the arm actually runs.

A pass says the run touched none of the eight destinations `escape_roots` and `ESCAPE_SCRATCH_DIRS` name, which is the property the declared narration already asks for, now checked by the harness rather than trusted from the reply. A fail names an unbounded write against a scope this arm has no legitimate reason to leave, since its only tested path is the refusal.

Neither reaches the write a real dispatch would make. The declared scope is empty because no run in this catalog drives the dispatch, so a pass proves the refusal path stayed clean and says nothing about what a worker's own worktree entry, commit, or session record would touch once one does. It also proves nothing about a destination `escape_roots` never watches at all, being a home directory, a sibling worktree, or the machine-level target and session registries a live `claude --bg` genuinely reaches, and nothing about whether a write it did catch was this run's rather than a concurrent session's.

`sessions_concurrent` names a session the registry carried on both sides of the run as evidence attached to that question, never a resolution of it: a witness explains a write without proving whose it was, and a run with no witness in the registry, or a concurrent write from something the registry never tracked, still leaves the question open on both sides of the scope.

The limitation holds under a real miss rather than only a hypothetical one. A run invoked with the arm's bare `/canon:canon-rollout` prompt, without the narration the fixture's own log tells an operator to say first, can dispatch a real `claude --bg` worker, and `escape_scope` still reports `no escape during this run`, correctly, since the dispatch never touches the eight watched destinations. A wrong run and a right one read identical to this scope, because the failure it exists to catch is not the failure a missing narration causes.

### The audits arm failed twice before the section had a route

`audits` failed on the same two reply pins by two different paths before the report gained a route for them. One reply described the audit categories in prose without naming either `canon context audit` or `canon records validate`. Another took the scaffold handoff on a report showing missing seeds and no installed domain and never reached the audits at all.

The first failure ran wider than its count reported. The fixture stages a target carrying two of the four audit surfaces and the reply offered all four as measurable, the withheld comment density included, which is the condition the arm exists to score. The checker passes that, because the withheld offer is asserted as a negative substring and any rephrasing satisfies it, which the arm's first `manual` entry names in advance. Read `asserted` as the denominator rather than as the coverage, since several of its assertions come back unchecked rather than passed.

The second failure's cause was structural rather than a wandering session. `## Route` maps an intent or a diagnostic finding to one lifecycle phase, and the audit offers sat in a subsection below it with no row of their own, so the table had no way to reach them when a fixture's target fires a lifecycle row and audit conditions at once. It now carries a measurement row, and the preamble above the table ranks a lifecycle row ahead of the offers, since the ranking has to sit there rather than inside the section it ranks: a session acting on the lifecycle row never opens that section, and is exactly the reader the rule is for.

The arm pins `setup-init` beside the two audit commands, which scores that ranking rather than assuming it, and the order between the handoff and the offers stays in `manual` because a substring set is unordered.

### The audits arm passes on the repaired route

A passing run names the scaffold handoff first, then offers the two staged audits, withholds the comment scan with a reason, and names `plans` as the only record kind, with all five manual entries holding on reading. Reading is not scoring, so the two figures belong beside each other rather than one under the other.

The ceiling holds at 12, with room for a reply that runs longer without the skill having changed, provisional against a small sample.

What a pass does not reach is whether the ranking holds on a target shaped differently. The fixture stages one shape, with nothing installed, so another target could rank the scaffold and audit rows the other way with no assertion here seeing it.

### The superseded arm and the guard that fixed the skill

`claude/migration-superseded.sh` stages three retired `.claude/` files against the folders that replaced them, and its assertions run in the two directions the proposal shape demands. Three `paths` entries and three `content` pins hold the retired files byte-identical, since the content is project-authored and a run that produced a correct split and then applied it fails nowhere else.

Three `absent` entries name the destination folders, and `.claude/hooks` carries the extra weight: no standard declares `appliesTo` over it, so a run proposing a shape there had to invent one, which the absence catches whether or not the reply admitted to it. The reply pins name the standard each entry resolved to rather than the destination folder, because the folder comes free off the report while the standard separates a shape read from the project's installed copy from one the run made up.

A driven run passes, scoring higher than the standalone figure: the three `reply` pins score only against an envelope, so the standalone figure describes ten no-write claims holding on a tree the skill never touched. The cap stays at the default against that one observation, which is a floor on what a correct run costs rather than a bound on it.

Only the three `reply` pins separate a correct proposal from a session that did nothing. An arm whose tree assertions are all negative earns that note rather than the count it prints, which generalizes past this one: a proposal-only skill cannot be covered by tree assertions alone.

Provisioning is what corrected the skill rather than the run. The fixture asserts its own premise, that the staged file is tracked and ignored at once, and the guard failed against a tree that was correct. `git check-ignore` consults the index and reports a tracked path as not ignored, so the flagless form returns nothing in exactly the state the step exists to find. Both the skill and the guard read `--no-index` now.

An arm that staged the state without asserting it would have shipped a step that reports every tracked-while-ignored file as clean, and no reply pin could have seen it, since the skill would have said nothing about a file it believed was fine.

### The orchestrate arm scores a routing decision on three reply pins

`claude/role-orchestrator.sh` drives a skill that reads a board and reports state, so it is proposal-only and inherits what the superseded arm generalized. Three `reply` pins carry the verdict and two `absent` entries carry the tree, and nothing asserts that the staged board is still staged, since a pin over provisioning counts the same as a real one and is what makes a coverage number lie.

The pins split the skill's one routing decision. `.canon/plans/feature-log-entry.md` proves the run opened the plans folder rather than reporting the task board alone, and `auto-ship` is the route a task with a plan earns. That route is spelled without a leading slash, because a session invoking through the plugin writes `/canon:auto-ship`, which carries the bare name and not the slashed one. `Next:` asserts the output contract's last slot and neither the singleness the scenario expects nor the route it names, which are the fourth and fifth of seven `manual` entries.

The fixture gained a second task row to make that split reachable. Its board staged one task and that task had a plan, so the needs-a-plan branch could never fire, and the first run failed the `plan-feature` pin against a session that had read the board correctly. A feature no task carries is not on the ready list at all, so the row is what the expectation was always describing.

Reading `unchecked` beside `asserted` rather than under it matters here: several `manual` entries cover what no substring reaches, a scenario expectation, the qualification on the `Next:` pin (which reaches its slot rather than the singleness behind it), and the bound on what the two absences can claim, so the arm adds to the `asserted` count while covering one decision.

The `plan-feature` pin lives in `manual` under `Judgment:` rather than as an assertion, since two runs against one unchanged fixture disagreed on that entry alone, the fixture staging nothing naming the route and the token being one the run chooses rather than one provisioning fixes. Repeated runs after the move agree, which reads as three runs agreeing rather than as a determinism property the arm now holds. The cap stays at the default against runs costing a fraction of it, since a proposal-only skill pays for however it reads the tree.

A run against a copy of the skill carrying one rewritten routing line failed that pin and held the other five, demonstrating the arm can fail on the behavior it was written for as well as pass on it. A rewrite to the ready-to-build row's route still passed, though, because the skill names the route again on the `Next:` line, a part of its body the rewrite never touched, so the pin reads the token anywhere in the reply rather than on the row it is written about. The three pins that remain are therefore demonstrated to pass and demonstrated to fail on nothing, and the discrimination the arm was credited with left with the pin that moved.

Anchoring the pin is not available. `reply` matches plain substrings by the decision one section up, and a regex tying the token to its row goes red on any rewording of a block the skill is free to phrase. What the declaration does instead is name the row in `manual`, which records the limit without inflating the count, and the honest reading is that this arm scores that the run produced a board report naming the right plan and the right route somewhere in it.

An escape naming a file another session was editing while the run went on, rather than one the sandbox wrote, is read against what the machine was doing at the time before it counts as a finding, which is why the scenario is driven while the board is quiet.

### The groundwork arms assert nothing and refuse the bare prompt

`scripts/sandbox/fixtures/claude/plan-groundwork/` does not exist, so every `claude:plan-groundwork` arm returns `state: unchecked` with nothing asserted and a verdict from it confirms only that the session completed.

What the three arms reach is narrower than the skill. `open`, `resume`, and `decline` cover creating a track, continuing one, and refusing one, and none of them runs a spike or produces an artifact, so the write-scope rule sending evidence to `evidence/` inside a track and an input to the fixtures path has no arm that exercises it. A branch changing that rule ships with a green run behind it that never reached the behavior.

The scenario also cannot be driven by the bare `/canon:plan-groundwork` prompt the ship-time check specifies. The skill's first guard refuses a missing topic and returns in under four seconds without creating a folder, so the run reports success having exercised nothing past the guard. Each arm names its intended prompt on its own `Action:` line and has to be driven with that topic to reach the creation path. A scenario whose skill guards on an argument is the general case this names, and the check's no-argument rule is what a caller has to override for it.

### The standards read arm covers a command rather than a skill

`infra:standards read` is the first arm whose subject is a resolve order. `src/standards/read.ts` searches two roots and the second is the package corpus, which is the only one a target has now that no standard installs into a project. Nothing exercised it outside `src/standards/read.test.ts` until this arm, and that test passes its own roots in, so what stayed unmeasured was the command running from a working directory outside the toolkit checkout, where `PROJECT_ROOT` comes off the module's own location rather than off `pwd`.

The arm runs `canon standards skill` from `install/`, a clean target holding no standards folder, and captures the frame to `install/read-frame.log` and the document to `install/read-body.md`. Both streams go to disk because `canon sandbox check` reads the tree and nothing else, and splitting them is what lets the resolve be asserted separately from the read. Running from `install/` rather than from the sandbox root is deliberate: the root carries `authored/standards/`, and a reader checking the premise by eye would have to know the resolve never walks upward to tell the two apart.

`<canon>` is the whole of what the arm scores. `standardRoots` spells the other root as `standards`, relative to a root a report could join, so the prefix is the one label no project path produces. The two `absent` entries carry the other half, since a resolve that answered from a project copy returns the same document and a content pin on the body alone passes either way: staging a copy and re-running flips the verdict on the prefix and the absence while the body pin passes on both runs. `.claude/standards` stays in that list, since a target left holding one must not resolve through it.

The arm carries no `max_turns`, for the reason `infra:wiki init` carries none. It runs the CLI with no agent driving it, so no envelope is produced and a ceiling would sit permanently skipped.

What it does not reach is the published layout. `PROJECT_ROOT` derives from `import.meta.url` and the arm runs `bun "$PROJECT_ROOT/src/cli.ts"`, so the package root here is this checkout's own `standards/` rather than the installed package directory a target resolves. The arm therefore scores the resolve order and says nothing about whether `package.json` ships the corpus that order reaches. That second half carries the whole weight for a target, since nothing installs a copy any other target could fall back to, and it is still measured nowhere.

The other thing it does not reach is the catalog. No shipped skill body invokes this verb, so the arm asserts the command and nothing that calls it. The route 38 of the plugin bodies take is the plugin root, where `claude/standards` is a symlink carrying the whole corpus, and a body citing that path never reaches `src/standards/read.ts` at all. An arm driving one of those would pass while the route it claims to cover stayed unmeasured, which is why this one drives the command instead and records the split here rather than growing to span both.

### The port-offset arm scores a number the skill reads rather than states

`claude:session-worktree/port-offset` is the first armed arm on a scenario that carried five manual ones, so `session-worktree` moves to `asserted` while four of its arms score nothing. Read the verdict as covering the one arm rather than the skill.

The arm stages the web layer's port helper into the target and pins the reply to `Port offset 27`, which is the cksum of the worktree folder name modulo the band of 50, plus one. Pinning the number rather than its shape is what separates a session that read the helper from one that printed a plausible integer, and the arm can pin it because the folder name is derived from the plan the branch matches rather than chosen by the run. The dependency line above it lands on the last of Step 6's four bullets, since the arm seeds no manifest inside the worktree and no other arm reaches that bullet.

An escape naming scratch a concurrent session in another worktree wrote during the run's own window is a limit of reading escapes by mtime rather than a finding against the arm.

What the arm cannot reach is the refusal branch the same change added to the skill body. Step 4 registers whatever it creates, so a fresh entry always lands on a worktree the helper answers for, and no staging puts the entry itself onto a leftover folder. The scenario seeds one as a sibling so a reader can drive the helper against it by hand, and the arm says as much in a `manual` entry rather than claiming coverage. The branch is covered instead by `src/worktree-port.test.ts`, which drives the helper directly across the directory shapes.

### The repeat-close-out arm scores a thread shape no assertion kind reads

`claude/review-pr.sh`'s `repeat-close-out` arm seeds a `## Review`, then a `## Review closed`, then one commit that raises nothing, which is the state a pass has to meet without posting a second close-out. Seven assertions run locally and four sit in `manual`, because the outcome the arm exists to score is the shape of a remote thread and no assertion kind reads one.

What the local file proves is that a body was written under `## Review closed` naming what this pass covered. Whether a second close-out was posted beside the standing one is invisible to it, which is the whole defect, so the asserted count here is narrower than the behavior verified and a reader should take it that way.

The four manual entries are confirmed by hand through the pull request's own review API, the read the arm cannot make for itself: the thread carries one `## Review` and one `## Review closed` with no reply-family comment, and the close-out's `commit_id` still names the commit it was first submitted against while its rewritten body names the newer one.

That last pair is the most useful reading the run produced and the half no assertion covers. A `PUT` rewrite moves a review's body and leaves its `commit_id` pinned, so the field `review-pr` Step 2 and `poll.sh` both derive a prior commit from goes stale the moment the guard fires. `canon/context/claude-plugin/skill-review.md` holds why that cost was accepted rather than repaired.

### The standards-drop arm scores a three-way split against the catalog

`claude/migration-standards-drop.sh` stages four files under `.claude/standards/` across the three verdicts the skill reaches, plus a runtime reader and three citing surfaces. Its two toolkit copies come out of `canon standards list --json` rather than out of this repository's own `standards/`, because the skill compares an installed file against that catalog's `content` field while `canon standards <name>` strips frontmatter on its way to stdout. A fixture staged through the verb reads as drifted against a corpus it came from, and the unchanged branch of the split would never run.

Repeated runs against the same fixture read the same arm: the split comes back one unchanged, one drifted, and two matching no standard every time. Four of the six manual entries are confirmed by reading the reply: the sync is named ahead of the drop, the project-local skill repoints to `canon standards slug` rather than to the plugin-root form, `prose` lands under `You supply` rather than taking a one-to-one repoint, and `slug` and `branch` sort into the right buckets. The other two are unwired, needing an arm that stages a stale binary and one that leaves the tree out of the index.

The cap stays at the default against a wide turn spread across identical assertions, which is what a variable path looks like: the low end of the spread is one route through the reads rather than a floor.

### The prompt sets the working directory, and two arms over one tree is what that buys

The runner takes the prompt as a free argument and a session's `Bash` working directory persists across calls, so a prompt opening with `cd vendor` puts every git read the skill makes inside the submodule. `claude:session-worktree` uses that: `submodule` runs from inside the submodule and asserts the guard, `submodule-root` runs from the superproject root over the same staged tree and asserts that the guard stays silent.

This was first written the other way, as an arm whose guard no headless run could reach, and the reason given was that the runner starts every session at the sandbox root. That half is true and the conclusion did not follow, since the default is not a refusal. Nothing was tried before the note was written, and a review asking whether it had been is what separated the two. Read a claim that the harness cannot drive something as owing one attempt.

What the split does cost is a coupling nothing checks. `Expectation` in `src/sandbox/expect.ts` carries no prompt field, so an arm's assertions are written against a prompt the caller supplies and the two are joined by nothing. Crossing the prompts here swaps both verdicts and the run reports ordinary failures. Each header names the prompt it assumes, which is a convention rather than a check.

A scenario staging a subdirectory read inside its own script is the other mechanism and stays distinct. `infra:standards read` runs `canon standards skill` from `install/` because the scenario body invokes the command there. The prompt route reaches the skill session's own directory, which no scenario body can set.

### The gap the rule names

The rule selects `git-stage` and `git-split` ahead of everything else and the harness cannot assert either, which is the sixth standing limit in `canon/context/sandbox/overview.md`. A rule that selects what nothing can check is working correctly. It names the gap instead of hiding it behind a skill nobody nominated.

## The skill census

`--skills` adds a per-skill verdict beside the scenario view. It answers what the scenario count cannot, which is whether anything can fail a given skill.

```bash
canon sandbox coverage --skills  # per-skill census, scenario view kept
```

A skill reports one of three verdicts. `asserted` means an arm paired to it declares a mechanical assertion. `should-be-asserted` is the honest default rather than a work queue, and the rule above decides which of them earns an arm. `exempt` means no arm should be written, and it holds only with a reason.

The denominators disagree on purpose. Fewer skills are asserted than scenarios are armed, because `infra:wiki`, `infra:drift`, and `infra:gov` are each armed and drive a CLI domain rather than a skill, and `--skills` carries `totalSkills` and `asserted` for whoever wants the current pair. Both numbers print, since replacing the scenario view would lose the rollout `--strict` is written against. The gap widens whenever a command surface earns an arm ahead of the skill that reads it, which is the ordinary order once a skill routes on what the command reports.

### Pairing a scenario to a skill

Pairing tries two spellings, `<category>-<command>` first and bare `<command>` second. The fallback is what pairs `claude/setup-init.sh` to `setup-init` rather than to a `claude-setup-init` that does not exist. The rule lives in `skillForScenario`, and this paragraph describes code rather than substituting for it.

The census counts `claude/skills/`, not `.claude/skills/`. The second holds toolkit-internal skills that reach no target, and folding them in would inflate a denominator meant to describe what ships.

### The ship-time audit

The ship-time pairing audit reads it. `internal-sandbox-check` resolves the skill here first, taking the `scenarios` entry as the pairing and the verdict as the report, rather than falling back to its own `<category>/<rest>.sh` split whenever that split finds no file, which would answer with a per-run label that reaches nothing and asks the same question again on the next branch touching the same skill.

The census reaches skills alone, so the audit's script mapping keeps a prompt of its own and `scripts/core/` is the domain that meets it on every branch. No `infra/core.sh` exists and none should: those scripts are the check runner and the guards it calls, exercised by every `bun run check` rather than by a provisioned target. The standing answer is `none`, and it is recorded here because the prompt has no census row to read it from and would otherwise be re-decided each time.

The prompt survives where evidence of a scenario outlives both spellings. Eleven skills are carried with no scenario, and two of them have a file at `infra/<rest>.sh`: `setup-gov` and `setup-indexes`. The audit offers that path and records neither answer on its own, because the file proves a scenario exists rather than proving it exercises the skill.

`setup-gov` against `infra/gov.sh` is a real pairing. `setup-indexes` against `infra/indexes.sh` is the other, and it settles what the file alone cannot, since the scenario declares a `bootstrap` arm whose own log line names the skill it seeds for. Neither spelling reaches either one, because no `setup` category exists and both sit under `infra/`.

A file at `infra/<rest>.sh` can also be a vacuous offer: a scenario staging trees a CLI walks can exercise nothing the skill it is offered against actually decides, so the correct pairing is the scenario that exercises the skill's decision rather than the first file the prompt turns up. An internal skill draws no prompt at all, being absent from the denominator above by construction rather than unknown.

### Exemptions

An exemption lives in `scripts/sandbox/exempt.toml`, keyed by skill with a `reason`. It cannot live in the arm's `manual` array, the other home for prose a checker cannot assert: `resolveVerdict` fails any declaration carrying zero mechanical assertions, so an `expect.toml` holding only an exempt reason goes red the moment it is written.

An exempt skill has no assertion to pair the prose with, which is what makes it exempt, so the two cases cannot share a home. Two reasons qualify and nothing else does, a harness limit the checker cannot reach past and a skill that writes no artifact. "Nobody has written one yet" is `should-be-asserted`.

A verdict decays in one direction, so an armed arm outranks an exemption rather than the reverse. Two kinds of wrong exemption print as errors and exit 1 without `--strict`, since a claim nobody can check is worse than no claim. One names a skill the tree no longer carries. The other names a skill an arm now asserts, which is the case the armed-wins rule creates rather than one the tree arrives with, and reporting the verdict while dropping the entry would leave committed data nobody is told to delete.

An arm reports as `<category>:<command>/<arm>` rather than bare. A skill two scenarios drive can hold two arms of the same name, and `(default)` twice in one list reads as a repeat. Deduplicating instead would report one arm where two assert, which understates in the direction this measure exists to keep honest.

Losing an exemption is invisible in the counts, because the skill reclassifies to `should-be-asserted` and rejoins a queue someone already ruled it out of. So the parser throws on a file that does not parse and on a table carrying no usable `reason`, rather than reporting the smaller set that survived. `runCoverage` catches both and frames them, for the reason `resolveVerdict` catches its own parse: a typo in a declaration reads the way a pattern that does not compile does rather than as a stack trace.

`canon sandbox check` takes `--strict` as well, which turns a single `unchecked` verdict into a non-zero exit. Both flags stay opt-in so the undeclared majority keeps running.

## Gotchas

### A scope that admits everything asserts nothing

A bounding key whose only passing value admits the whole tree asserts nothing. The `claude:setup-init` `fresh` arm runs the real installer with `bun install` behind it, so the narrowest `write_scope` glob admitting a correct run was `**`, and the first pass reported 7772 in-scope `node_modules` paths and 0 failures, a green count no wrong run could have moved. Dropping the key left ten assertions that can each fail. Before declaring a bounding key, name the wrong run it would catch. Where none falls outside it, the honest form is its absence plus a stated reason and a `manual` entry keeping the gap in the unchecked count.

### A declaration can bind to the wrong scope and still count as armed

TOML binds a bare key under a `[[table]]` header to that table, so a misplaced key asserts nothing while existence-only coverage counts the file as armed. `claude/ui-test`'s `expect.toml` carried `max_turns` and all five `manual` entries below its last `[[content]]` block, so the turn ceiling never asserted, the entries never reached the unchecked count, and `canon sandbox coverage` read the arm as armed throughout, because it tests only for the file's existence. Place every top-level key above the first `[[table]]` header and reject unknown keys inside the table so a misplacement fails loudly. A coverage number built on file existence measures declarations present, never declarations that work.

### Two families report `no scenario` for opposite reasons

`internal-sandbox-check` Step 2a splits a skill name on its first `-`, so `internal-claude` resolves to `scripts/sandbox/internal/claude.sh` and no `internal/` category exists. `scripts/sandbox/` holds only plugin-skill prefixes, internal skills carry the reserved `internal-` prefix, and the missing file is correct by design, so answer `none` and do not invent the category.

The `canon-` plugin family splits the same way and is rescued rather than stranded. Rule 1 sends `canon-operator` to a `scripts/sandbox/canon/` category that does not exist, and rule 2 then reads the census pairing and records `scripts/sandbox/claude/canon-operator.sh`. `skillForScenario` reaches it on its bare-`<command>` fallback, since the `<category>-<command>` spelling would be `claude-canon-operator`. The ordering is what makes this safe: a split that resolves to nothing costs a wasted test rather than a wrong pairing, so rule 1 running first is harmless for every name whose prefix is not a real category.

The `create-*` family is the opposite case: all four of `create-rule`, `create-skill`, `create-snippet`, and `create-standard` report `no scenario` and `scripts/sandbox/exempt.toml` carries none of them, so the coverage surface calls them should-be-asserted rather than exempt. One branch took a `none` opt-out on both of its changed skills and shipped them unverified. Answer `none` when the ship is not the place to write a scenario, but record the gap rather than reading `NONE` as settled coverage.

### A rename outlives its pairing

A skill rename that leaves its scenario file's name behind breaks pairing silently. `draft-docs`, `draft-context`, `draft-wireframes`, and `draft-readme` each carry a real scenario under `scripts/sandbox/docs/`, provisioning the state its skill needs and printing an `Expect:` line per guard branch, but `docs/draft.sh` pairs `docs-draft` on the `<category>-<command>` spelling rather than the skill's current verb-first name, and the bare-`<command>` fallback misses too, since the bare command is `draft` rather than the compound skill name. `canon sandbox coverage --skills --json` reports all four `should-be-asserted` with an empty `scenarios` array, unable to see a scenario that exists under a name the pairing rule no longer reaches. Renaming a skill moves it, and renaming its scenario file and fixture folder to match is a second, separate step these four are still waiting on.

Nothing in `bun run check` catches the drop on its own, since the `Sandbox coverage` gate stage counts scenarios that declare an expectation rather than skills a scenario reaches, and the two numbers can move independently: a wave of renames across many skills can silently drop many pairings while that gate stays green throughout, with only the skills whose bare command happens to still equal their arm name surviving on the fallback. `SANDBOX_ASSERTED_FLOOR` in `src/gate/measures.ts` pins the asserted-skill count, so a rename dropping a pairing fails the push it ships on rather than passing one silently.

A citation sweep looking for scenario references after such a rename has to grep for two shapes, not one: a regex anchored on `claude/<name>(\.sh|/)` or `claude:<name>` misses a `stage_fixtures claude <name> <arm> <stage>` call, which is a space-separated positional argument rather than either anchored form, and misses prose that names a scenario bare, with no path or colon in front of it. Both forms carry a real citation.

The first breaks an arm's fixture staging at run time when the fixture folder underneath it moves and the call site does not follow. The second leaves a reader-facing sentence naming a scenario that no longer resolves, with no run-time break to surface it. A rename's sweep has to grep for both shapes and re-read the narrative surrounding any hit, since the two anchored patterns alone miss both.
