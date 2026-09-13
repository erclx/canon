---
title: Shared skill procedures
description: The CLI shell-out pattern every skill follows, the label map a project declares rather than the skill ships, the review classifier that became data a verb parses, the core.bare repair carried at two points, the dependency-check step's literal presence test and lockfile table, the branch worktree entry hands the ship chain, and the procedures defined once in standards and cited from each body
---

# Shared skill procedures

## The CLI shell-out pattern

Plugin skills that shell out to the CLI follow a consistent pattern: read the toolkit catalog via `canon <domain> list --json`, match against project context, then execute the CLI with `CANON_NON_INTERACTIVE=1` so it skips prompts. Claude Code's tool permission dialog is the single confirmation gate. Skills never reimplement CLI logic or hardcode rule, stack, or snippet names. `setup-gov` is the reference.

### Reading a report rather than rediscovering

`canon-operator` reads `canon sync --check --json` rather than walking the tree itself, and treats an absent report key as unread rather than as an empty answer. Reading an absent key as empty is the failure a report field introduces that a folder listing never had: the run exits zero, takes the nothing-to-report branch, and reports a clean target the CLI never actually measured. An absent key and an empty array are separate states, and a current CLI reporting an empty array has looked and found nothing.

That skew is the general shape rather than one skill's problem. A skill reaches a target through whichever CLI the machine has, while the skill itself loads live from the plugin, so a body written against a field can run against a binary predating it. `ARCHITECTURE.md` carries the two-speed release as a standing risk.

The fallback deliberately does not key on `historyUnavailable`, which was the shape borrowed from `seed-sync` when the change was planned. That field reports failed attribution on a domain or on `seeds`, and `unmigrated` is a filesystem read carrying no attribution at all, so keying on it would drop a correct detection whenever an unrelated half of the report could not be dated.

### Where the fallback stops being the safe answer

`migration-superseded` reads the `superseded` array off the same report and takes the opposite branch when the key is absent. It stops and names the CLI rather than degrading to a listing, because the two detections fail differently. `unmigrated` pairs against domain folders whose worst listing error is an unfiltered count, while `superseded` pairs against the seed subdirectory names and an uppercase stem is not the test.

A listing of `.claude/*.md` also reaches `ARCHITECTURE.md`, `REQUIREMENTS.md`, and `DESIGN.md`, each a single file the layout intends to stay one, so the fallback that costs a count on one skill costs three shredded documents on the other. A fallback is worth having when its failure is an imprecision and worth refusing when its failure is a proposal nobody can undo.

The destination standard is the second place the skill declines a route every sibling takes. `skill.md` has a body cite the plugin copy at `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, which is correct for a standard the skill follows itself. Here the standard is the project's own agreement about the shape of a folder, resolved by matching the replacement path against the `appliesTo` the standards catalog declares.

A proposal drawn from the plugin copy would hand back a shape the project never adopted, against content only the user can place, so an absent standard names itself and the install command and proposes nothing. Resolving through `appliesTo` rather than through the folder stem is what lets the four seed folders nobody has observed degrade by mechanism, since `.claude/hooks/` matches no entry and earns a decline rather than a guessed shape.

### Reading the report for a precondition rather than a detection

`migration-standards-drop` reads the same report for its `skew` object alone and detects from a directory read. Nothing in the report names an installed `.claude/standards/` tree: `src/sync/check.ts` registers governance alone and `ROOT_LAYOUTS` in `src/sync/layout.ts` is empty by decision, so there is no key to test for and no absent-key branch to get wrong. What the report answers instead is whether the sync the proposal names may run at all, since a binary behind the published version installs rules citing the path the move removes. The absent-key discipline above still applies to the field it does read, where an unread version reports as unknown and continues rather than as current.

### Configuration a project declares rather than a skill ships

`git-pr` labels a pull request from a `[domains]` table at `canon/config/pr-labels.toml`, keying a label name to the path prefixes that earn it. No domain name of this repository reaches the skill or its references, because a shipped label set is a guess about someone else's surfaces and a wrong default costs more than no label at all. A project declaring no map is labelled silently and never warned, which reads the absent-key discipline above the other way: an absent file here is an answer rather than a state to repair.

The scope derivation the intake proposed was measured and dropped. Across the 80 merged pull requests at `02da9e21` the conventional commit scope reaches 23 distinct values against seven labels, four of them shared, so keying on it needs a hand-maintained scope-to-domain table that is a second vocabulary to hold in step with the first. The changed paths need none, since the top level of the tree already is the domain set. The distinct count rose from 19 at 60 pull requests while the four-way overlap held, which is the shape that settles it.

`.github/` is the rejected home for the map. A skill reads the file and GitHub does not, so a maintainer opening that folder would find a TOML no workflow consumes. `actions/labeler` is the alternative that would earn the folder, and it would relabel on every push where this design does not, at the cost of a second glob syntax the skill cannot read and a label set derived from something other than the diff the body is written from.

Matching is prefix-anchored, so a row written for an authoring root reaches nothing under the consumed copy: `standards/` never matches `.claude/standards/`, and `claude/skills/` never matches `.claude/skills/`. That is correct for the surfaces this repository authors at the root and installs under `.claude/`, and every surface living only under a dotted folder needs its own prefix on the row that owns its subject. Between the map shipping and the `context` row landing, two pull requests merged carrying no label at all, one changing a single context entry and one changing a context entry beside the spelling dictionaries, and nothing reported either.

`canon labels audit` is what now names the third such branch before it merges, and the match it runs lives in `src/labels/` rather than in the skill body that used to state it. A second table, `[declined]`, moved out of the map's trailing comment for the same reason: the check has to separate a surface nobody covered from one somebody decided against, and prose could carry only the second to a reader rather than to a command. The reasoning behind the verb sits in `canon/context/cli/audits.md`.

What it cannot see is a row that has gone stale, which is the third state neither table holds. An entry naming a path that no longer exists still parses, still loads, and stops matching, so a branch moving a file the map enumerates literally leaves a dead row behind and the audit reports clean over it. The asset rows are where that bites, since fifteen of them name a `.png`, a `.stamp`, or an `.html` by name rather than by prefix, and the capture split renamed six of those and moved five more. Verify a rename by name against the moved tree rather than by a passing run. The record is what confirms it: every moved path shows up under `declined` against the row that caught it, where a dead entry appears in neither `declined` nor `uncovered`.

The skill calls it and keeps the stated rule as a fallback, which is the third shape the release split has produced here. A target whose installed `canon` predates the verb still labels correctly off the reference and reports no uncovered path, so the half that needs a release is the half a target loses rather than the whole step.

The fallback carries every refusal except `no-map`, rather than the absent record alone. A map with a typo in it still has rows a prefix match can reach, so reading that refusal as an absence would open the pull request unlabelled and say nothing, which is the surface merging bare the verb exists to name. `no-map` is the one reason that stops the step, since a project declaring no map has nothing to fall back to.

A census closed that set. Measured across the 138 commits between the map shipping and `190af80b`, the uncovered surfaces fell from 28 to 8 and the commits carrying no label from 54 to 53, every one of the 53 a release. Eleven rows carry 41 prefixes where nine carried twelve. The remaining 8 are recorded in the file itself rather than covered, being four paths a release moves and three a command rewrites, since a domain row over either gives a mechanical edit a subject it does not have. The eighth is `assets/captures/hero.html`, which is authored and declined on a different ground: it rides in the commit that regenerates the image beside it, so a row over `assets/` would label 18 commits with a surface none of them is about.

The census enumerated the tree rather than the merge history, which is what reached `.claude/internal/`. It is the consumed copy of a folder that same pass split across three rows, no merge had touched it in the span, and a walk over changed paths could not see it. History ranks what a gap has cost and never bounds what exists.

### Labelling runs at open and nowhere else

Labelling runs after the pull request resolves rather than as a flag on the create. `gh pr create --label` fails whole on a label the remote lacks, so a mistyped row opens no pull request at all and the branch is left pushed with nothing to review. One `gh pr edit --add-label` afterward degrades to a warning naming `gh label create`, and it covers both sides of the create-and-edit branch the final command carries, which would otherwise want two label flags and would leave every re-run unlabelled if only the create side got written. The warning earns a second output line, since the body otherwise permits one line and a refusal reaching nobody is the failure the fallback exists to prevent.

The step stays in `git-pr` alone, which makes the label set a description of the branch at the moment the pull request opened. `review-address` delegates its push to `git-followup`, which stages, commits, pushes, and refreshes the body without invoking `git-pr`, so no follow-up push reaches the labelling step whatever the branch touched.

How often that costs a label is derived from the map, never read off label events. Every domain label before `#934` was applied by hand once its pull request had merged, so a timeline read shows no growth on any of them and settles nothing. Applying the seven prefixes to the changed paths instead, split at each pull request's open time, 99 of the 200 merged pull requests at `fa2f0058` took commits afterward, 13 of those are rebase artifacts whose commits all post-date the open, and the set grew on 6 of the 86 that remain readable.

Roughly one branch in fourteen that pushes again therefore merges under-labelled, and the most recent 34 readable cases grew on none, which is the run a smaller sample mistakes for the rule. Moving the step into `git-followup` is the alternative and it loses on the price rather than on the rate, since one behavior in two skills on two cadences buys back that one in fourteen. A check is the other answer and it loses too, because nothing compares a label set against a diff after the fact without re-deriving the map on every push, which is the same step in a third place.

### What the map fails to cover

The map has a second consumer and it is a person. Nothing detects a top-level directory the table fails to cover, so a surface added later labels nothing until someone adds a row. That is the manifest-to-reference symmetry this repository already records as a gotcha, arriving in a new folder.

`.claude/` carried no row and that exclusion was reversed by the census. The reasoning behind it held that the tree spans context entries, two sets of generated mirrors, and internal skills rather than one domain, so a single row would label unrelated work alike and a row per subtree doubles the map. What overturned it is that a pull request touching that tree alone merged with no label at all, twice, and the doubling is the correct price: each subtree carries its prefix on the row owning its subject rather than on a row of its own, so `.claude/rules/` joins `governance` and `.claude/internal/snippets/` joins `snippets`. The map grew by two rows rather than by a row per subtree.

The row count is the measure worth watching here. Twenty-eight rows against nine would rebuild the unreadable map the exclusion was protecting against, which is why extending an existing row is the default and a new row waits for a subject no label carries. `snippets` and `repo` are the two that earned one.

### The review classifier is data the CLI parses rather than a list a body applies

`auto-ship` Step 5 decides whether `review-branch` runs, and it used to decide by asking the session to test every changed name against eight path prefixes written into the body. The set was correct in every recorded failure and the session did not apply it. A driven arm on 2026-08-30 staged `.claude/skills/deploy-check/SKILL.md`, which the list names outright, and the chain skipped review and opened a draft pull request anyway. That was the third such miss, and the two before it were each answered by rewriting the same prose.

`canon autoship classify` now returns the decision, the file that decided it, and which of the two tests that file failed, reading the prefixes from `src/autoship/paths.ts`. It is the second instance of the rule the quiz-order draw in `canon teach lesson` established, which `ARCHITECTURE.md` states as a rule a session can talk itself out of moving into a verb. What separates this instance from that one is the evidence behind it: the teach case reasoned from a defect in the surface it departed from, and this one has three failures of its own, one of them caught by an arm built to catch exactly it.

Being machine-parsed is what makes the set permanently exempt from any later design that folds a list back into the surface citing it, on the clause `ARCHITECTURE.md` already carries. The bar there is a list a parser reads, and this one is now read by `classifyChanges` rather than by a reader.

The verb takes the changed set as arguments and reads no git, which is not a convenience. `git-ship` and `review-branch` already share one diff baseline, and a classifier resolving its own range could disagree with the set the chain measured, which is the stale-baseline half a prior row closed. Handing the names over keeps one baseline for the whole chain.

What it costs is the fourth surface reached by the two-speed release. The verb ships with the CLI and Step 5 ships with the plugin, so a target on an older binary meets a missing subcommand, and the body keeps the written list as the fallback rather than refusing. The fallback may never be a skip: failing open is the defect the verb closes, so an absent subcommand that routed to a skip would ship every branch unreviewed. Two copies of the path set is the price, standing until a release retires the written half, and nothing compares them.

### The body check reads one section and grades one direction

`review-pr` Step 3 tested every ticked `## Testing` box against the head and read `## Key Changes` not at all, so a bullet describing a change nobody made survived the pass and became the squash commit message. `canon pr key-changes` now compares the paths that section claims against the pull request's own changed-file list, and the step files a claim the diff does not carry under the same `**PR body**` block the stale ticked box already takes, since what both corrupt is the merge record rather than a file in the diff.

Two design decisions carry the whole check and both were settled by measurement rather than by argument. The section is read alone, because `## Technical Context` names files a branch never touched by design. The claim region of a bullet ends at its first comma, because over the 23 merged pull requests here carrying the section a whole-bullet read reported 16 paths as claimed-but-untouched and every one was named for context, where the comma cut left 110 claims of 149 and took that to 2. A list of sixteen clause-opening words tried beside the comma removed nothing it had not, because this corpus punctuates every one of them.

That cut used to decide whether a path was collected at all, and the paths past the comma fell to the unnamed direction on the stated ground that it reports without grading. It graded anyway, one consumer removed: Step 3 read `unnamed` as a question to put to the branch author, so on 2026-09-01 the question went to three pull requests over bullets that had named the files all along and `#1329` gained bullets it did not need. The scan now reads the whole bullet and the cut decides `leading` instead, which is the same asymmetry `anchored` already carried on a different question, both marking evidence strong enough to credit a changed file and too weak to accuse one. Collecting the whole bullet as claims outright was the obvious repair and the corpus refused it: over the 40 most recent merged pull requests carrying the section it takes `unmet` from 10 to 19, and all nine additions are the context class the cut was tuned to exclude. Gated on `leading` the same 40 give claims 243 to 314 and unnamed 1124 to 1058 with `unmet` identical entry for entry.

A third rule arrived from the first body written after that corpus closed, which is the one real test the measurement could not run. `#1274` produced two findings and both were wrong. One was a bullet recording a change it declined, "Leave `x` untouched, since the decision keeps the receipt", where the path sits ahead of the first comma so no region cut reaches it. A no-change marker closed that class and voided no bullet in the 40-pull-request corpus at all. The set is three words after review took `alone` out of it: every corpus occurrence of that word sat past the first comma, where the cut already excludes it, and kept in the set it voided a restrictive comma-free bullet asserting a real edit. The other cites where something is defined while claiming an edit elsewhere, which needs the sentence parsed rather than cut, and it is named in the report instead of closed.

`#1276`'s own review found the fourth word restrictive rather than disclaiming: `alone` before a comma asserts an edit as often as it declines one, and it voided a real claim on a bullet the corpus never wrote. The drop cost nothing measured, since every real `alone` in the corpus sits past the comma the region cut already excludes. Three words carry the marker now: `untouched`, `unchanged`, and `as written`.

Only the claimed-but-untouched direction is graded. A changed file no bullet names is reported without a severity, since the class covers a real omission and equally a generated asset or a regenerated index, and grading it would fire on nearly every branch. A path written partially, or one past its bullet's first comma, can credit a changed file and never accuse one, on the ground that nothing separates a path written short from a path written wrong or a second claim from a file cited for context.

Each direction then splits again on whether the evidence is worth raising with a person, and what each split sets aside is still reported rather than dropped. A test beside its subject, a fixture, and a lockfile owe no bullet by Step 3's own standard, so they come out of `unnamed` into `incidental`: `#1331` reported seven entries of which four were exactly those, and a count mixing files that owe a bullet with files that never could cannot be acted on at any value. A generated asset and a regenerated index belong in that class and are deliberately absent, since neither has a spelling that holds outside one project and guessing at one would set aside a file that did owe a bullet. `docs/agents/key-changes.md` carries the span rules and the residual rate.

It composes on the body read `#1260` added at Step 4 rather than opening a second one, which is the constraint the row was planned under: two reads of one text at one head is two places for the head to be wrong.

### Repairing `core.bare`

`session-worktree` repairs `core.bare` at two points rather than one. Claude Code's entry tool writes the flag into the parent repository's shared config and its exit tool never restores it, which leaves every later command in the main worktree failing for want of a work tree while the files sit untouched on disk. The linked worktree keeps working, so the session that caused the damage is the one least likely to see it.

Repairing only after entry would still admit a repository broken by an earlier session, so the skill reads the flag in Step 1 beside the main-root resolution and repairs before entering, then repeats the repair in Step 5. Both writes are guarded on the flag actually being set, since the entry tool does not set it every time and an unconditional repair would rewrite the config on runs where nothing broke.

`scripts/core/repair-bare-flag.sh` carries the same repair as a second line of defense, sourced from `scripts/lib/worktree.sh` and run by `canon gate run` ahead of every stage because the flag breaks the git reads that scope the run. Nothing forces worktree entry through the skill, and one occurrence hit an operator whose session never entered a worktree at all. A git hook cannot serve here, because the corrupted command aborts before any hook runs.

Both call sites confirm the repository's common dir is named `.git` before writing, which separates the defect from a genuinely bare repository that keeps its objects at the root and would be broken by the repair. The skill states the upstream issue inline rather than pointing at `wiki/claude/claude-worktrees.md`, since a shipped skill runs where no `wiki/` path resolves and `check-skill-paths.sh` fails the build on one.

### Step 6's dependency check is a literal test, not a description

`session-worktree` Step 6 used to name the two output lines a Node presence check must produce without prescribing a command for producing either, so each entering session composed its own test. One such test, piping `ls node_modules` through `head -1` and branching on the pipe's exit status, reported installed unconditionally: `head` succeeds on empty input regardless of what `ls` found. Measured 2026-09-07 in a freshly entered `.claude/worktrees/bootstrap-arm-fixture/`: that composed check reported dependencies installed while `node_modules/` was absent, and `bun run check`'s format stage then failed on a missing `prettier-plugin-astro` until `bun install` ran by hand.

The step carries the test itself now. Node and python each read against a literal `[ -f ... ]` / `[ -d ... ]` pair, and the closing "no manifest" line takes its own direct test, run ahead of both rather than reached by falling through them unmatched. `<install>` resolves off a fixed four-row lockfile table, `bun.lock` or `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, then `package-lock.json`, checked in that order and falling back to `bun install` when none match. A literal shell test rather than a `canon` verb, since directory presence is not a judgment call and the body ships to a target that may hold no `canon` binary on PATH at all.

### The branch worktree entry hands to the ship chain

`session-worktree` renames the entered branch to `<type>/<name>` rather than to the bare `<name>`. Two consumers pull in opposite directions on that string. Slug derivation wants the plan's own slug, since `auto-ship` finds the plan from the branch and stops when the two spellings differ, and `git-pr` guards on `<type>/<description>` and refuses anything without a type.

The bare name satisfied the first and failed the second, mid-chain, with the work already done and uncommitted. `standards/slug.md` absorbed the difference by dropping a leading type segment before it replaces slashes, so one branch answers both and no consumer had to learn a second spelling.

That amendment repairs a break nothing had reported. `git-branch` renames to conventional format at the ship step, so every branch reaching `git-pr` was already typed and every slug derived after that point already carried a `feat-` the plan folder has never used. The chain survived it because `git-pr` reuses the plan filename a caller read earlier instead of re-deriving, which is a dodge rather than a fix.

Entering from a branch that is already conventional stops on the collision. The name derives back onto the branch the session came from, git refuses a second branch under it, and the type default cannot invent a distinct one. The bare-name rename this replaces carried the same collision to `git-branch`, which has no check of its own, so the stop moves the failure to the step that can still describe it.

Both collision tests sit in Step 2, ahead of the entry call, because the typed name turns a rare stop into a common one and a stop after entry leaves a worktree built with the session inside it. Neither read needs a worktree. The directory test earns its place beside the branch test rather than duplicating it: two branches differing only in type are distinct refs that collapse onto one slug, so `feat/foo` and `fix/foo` reach one `.claude/worktrees/foo/` and only the directory read sees it. That is the collision `standards/slug.md` records as the cost of dropping the type, and it now has the one guard that can catch it.

The branch test reads both ref spaces through `git for-each-ref`, matching `checkClaim` in `src/sessions/claim.ts`, so a name this skill clears and a branch a dispatcher cleared answer the same question. It read `git show-ref --verify` over the local head alone until the two readings landed on one branch and diverged, which left a branch pushed from elsewhere passing the test and colliding at its first push, and a tree the read could not open reporting as a free name.

Entry from the main worktree is the case `auto-ship` cannot reach. The cause is the order its own body puts two sections in: the guards derive the slug from the current branch and stop when `.canon/plans/feature-<slug>.md` is absent, while Step 0 is the section that enters the worktree giving the branch its name. On `main` the slug resolves to `main`, no plan is filed under that name, and the guard stops the chain before Step 0 runs.

That derivation is also what couples a plan filename to exactly one branch, since the two are one string by construction. `auto-ship` Step 1 now takes a caller-supplied plan, a path or a bare slug in the same position `session-worktree` tier 0 accepts its name, ahead of deriving `.canon/plans/feature-<slug>.md` from the branch. The branch-keyed slug that names the worktree, the review receipt, and the pull request is unchanged either way, since only the plan lookup moved and nothing downstream reads the plan's own filename. `orchestrator-dispatch.md` is the first caller to use it: it already resolves the row's plan to derive the candidate branch and used to discard that path once the branch was built, recovering it downstream by spelling the branch to match. The launch now passes the plan path it already holds instead. A plan named outside `feature-<slug>.md`, such as a phased row backing several branches from one file, still needs its own file per branch under this change, since naming the plan is not the same as letting one plan answer for more than one.

### Which document Step 1 resolved

A path resolving to a file says nothing about which document it names, and a task file resolves exactly as a plan does since both are markdown sitting at a path that exists. A path under `.canon/tasks/` now reaches a tier of its own, which reads the task's first `Plan:` line and takes what it names, so a caller holding the board's own pointer no longer meets a refusal.

Everything else meets the shape test, which checks the resolved file for the `**Files to touch:**` marker `standards/plan.md` requires structurally, or the `## Files to touch` heading form the same standard admits, since a task never carries either. That test runs after all three tiers rather than guarding the supplied one alone, because a branch slug matching an unrelated plan is the same wrong-file risk under the derived tier and a task's own pointer can name a non-plan under the first.

The task tier refuses three ways and each names a different repair, since one message covering all three sends the caller to the wrong file. A path under `.canon/tasks/` resolving to nothing is a typo, a task carrying no `Plan:` line is a row nobody has planned yet, and a pointer resolving to nothing is a stale citation the board should have caught. A bare slug stays a plan's under every tier, because a task slug and a plan slug collide on any similar name and a caller naming a task holds its path already.

The archive refusal is the one that is not obvious. `standards/tasks.md` points a shipped task's `Plan:` line into the plans archive, and an archived plan carries `**Files to touch:**` unchanged, so the tier would re-implement merged work without it. It tests the resolved path rather than the task's outcomes, since a stale board gets its ticks wrong while the standard fixes where a shipped pointer lands, and it covers the two older spellings an unmigrated project still holds beside `.canon/plans/archive/`.

What the pointer resolves against decides whether that refusal reaches anything. An archived task sits a folder deeper and the standard points its line at `../../plans/archive/feature-<slug>.md`, so a base fixed at `.canon/tasks/` lands on a repository-root `plans/archive/` that never exists, and the run answers a correct citation with the stale-citation message.

That message routes the caller to repoint a good link or pass the archived plan directly, and the plan tier carries no archive test, so a fixed base costs the archive refusal exactly the population it was built for. Resolving against the directory holding the task file is what closes it, and taking a bare path beside a link target is what reaches the older tasks writing the target as a plain project-root path. Measured 2026-08-28.

### Where a run from `main` stops

Supplying the plan also moves where a run from `main` stops, which the guard reading above no longer describes. The slug still resolves to `main` and no `feature-main.md` is ever filed, but the caller-supplied tier answers from the argument rather than from that path, so the chain proceeds into Step 0 instead of stopping ahead of it. Step 0 invokes `session-worktree` with no name and leaves derivation to the wrapper, and on `main` with more than one plan on the board that lands the wrapper on tier 3 and its instruction to ask the operator, which a chained run cannot answer. The caller holds the resolved plan by then, so it passes that plan's slug as tier 0 rather than letting the wrapper re-derive what Step 1 already settled. Measured 2026-08-28 running the chain from `main` against a supplied plan path with four plans on the board.

`session-worktree` handles entry from `main` and tiers through it, taking a caller-supplied name, then the single plan file, then the multiple-plan question, then an inference from session context. The two bodies therefore disagree about whether starting there is supported. Measured 2026-08-20 running the chain against a task file from `main`, where the plan was resolved from the task's subject rather than from the branch.

The caller-supplied tier is what a dispatched worker reaches, and it was added because every other tier answers from state the caller cannot set. A worker launched onto `main` misses the branch tier, a board carrying more than one plan puts the single-plan tier out of reach, and the multiple-plan tier then instructs it to ask a person who is not there. Naming the branch in the launch prompt closes none of that, since no tier reads the prompt, so the dispatch runbook calls `session-worktree` with the branch as its argument before `auto-ship` runs. A type spelled by the caller also wins over the one a plan's own lines grade to, which is the half that produced `fix/path-form-hook` against a worker taking `feat/path-form-hook`.

`git-followup` sits at the other end of the same entry. Its upstream guard read a missing tracking ref as a branch that had never been pushed, and a worktree branch has been measured carrying an open pull request without one, so the guard refused over a state the pull request disproves. The open-pull-request test is the guard now, and the push leg sets the ref with `git push -u origin HEAD` when none resolves. Refusing a branch with no pull request stays, since that is the split from `git-ship` rather than an accident of where the branch came from.

### Bundled references

`setup-plugins` bundles `references/plugin-catalog.md`, which holds install data alone. `canon/context/claude-plugin/skill-strategy.md` argues the install-versus-author decision and is not reachable from the shipped file by design. A `references/` file is read by a session running in a target project, where no `canon/context/` path resolves, so the pointer the catalog used to carry was already dead for the only consumer that reads it.

It is recorded here instead, on a surface that never ships, for the maintainer editing the catalog.

## Procedures defined once and cited

Two procedures run inside more than one skill and are defined once in `standards/`, cited from each body rather than restated in it. Each has a standard of its own, `publish.md` for the scan and `slug.md` for the transform. Neither sits inside a document-type standard, since `markdown.md` does not govern a scan and `skill.md` does not govern a slug transform.

The scan carries two checks under one citation, characters and phase labels, with the rules themselves held by `markdown.md` and `versioning.md` beside it. A skill citing the scan gets both without naming either file, which is what keeps a new check from costing an edit in every consuming body. The label check scopes by destination, so `draft-diagram` cites the same standard and takes the character half alone.

Both are stated generally, and neither names what enforces it here. An installed standard belongs to the project that installed it, so a standard citing this repository's audit hook, scratch paths, or output filenames goes wrong in a target that has none of them, with nothing reporting it. In this repository the scan covers text the hook never reaches, meaning `.canon/tmp/`, anything leaving through `gh`, and anything inside a fence, and that belongs here rather than in the file that ships. Each citing skill names its own gap for the same reason, since the gap is a fact about the skill.

They live in `standards/` and always did, since a procedure a skill executes mid-run was never the fan-out's case, that being format references a skill consults while holding still. The fan-out itself is retired now, its six sources moved to `standards/` beside these two, so every narrow-readership standard is reached the same way this pair always was.

A citation names one path, `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, the same as any standard a body reads. The plugin install dereferences the `claude/standards` symlink, so every plugin cache holds the whole corpus and that path resolves wherever the plugin does, which is what removed the installed-first branch these bodies used to spell. `slug.md` at 16 citations and `publish.md` at 7 are the two the collapse touched most, and neither has a home outside the corpus, so both are reached by citation alone.

The split between the two surfaces is what keeps the citation honest. The standard owns the procedure and the body owns the trigger, since both the moment a scan runs and the text it runs against vary per skill. The empty-branch case splits the same way, carrying three legitimate answers across the catalogue: fall back to `latest`, stop, or fall through to another source. A body that cites without stating its own case reads as if the default applied to it.

Nothing detects a body that restates a procedure instead of citing it. `assert_no_drift` covers generated copies and a hand-written restatement is not generated, so the guarantee is only that a single definition exists to correct.

## The routing handoff drains per session

The memory-routing handoff queue drains per session rather than accumulating unread, so a file sitting in it is evidence about one session rather than about the mechanism. The folder held four files at one reading and two of them were gone eighteen minutes later with no session touching them but the two locked worktrees carrying those exact names, which says each producing session ran `docs-fold` and folded its own. What was left is a two-file backlog months old, and that is the shape to expect: a handoff outlives its producer only when that producer never reached its own ship chain. Read an aged file as a session that stopped early rather than as a queue with no consumer, and check the modification time against the live worktree list before concluding the mechanism is unread.

### A main-root write names its route or the guard silently takes it

Eleven bodies write shared session scratch at the main worktree root, and Claude Code refuses any such write from a linked worktree, naming the worktree copy as the destination instead. The redirected write still succeeds, so a body stating only the destination reports success and loses the file, and no stage reports the miss. That is the whole defect: the instruction and the guard disagreed, the guard won, and nothing said so.

Each body now names the route beside the destination rather than the destination alone. Creating a whole file goes out as a plain single `Bash` command carrying a heredoc, with `mkdir -p` sent separately because the isolation refuses a compound command whose target it cannot statically verify. Changing a line inside an existing file goes through a `canon` verb, since the shell route for that case is the stream editor `CLAUDE.md` bans. `CLAUDE.md` and the seed state the split once and each guard names only what it writes, because eleven restatements of one mechanism is eleven places to correct and this rule has already been corrected once.

Two structured edits earned verbs, `canon tasks pull-request` and `canon tasks outcome`, chosen over a body instruction because the board is the write with a measured cost and a verb is the only part of this a test can reach. A structured edit no verb covers, such as `docs-fold` retargeting a `Plan:` line or `memory-review` flipping an item's emoji, reads the file and writes it back whole. That stays a body instruction until a second caller wants the same edit, which is the point a third verb would pay for itself.

The read sites were left alone. `Read` resolves against the main root normally, so the six bodies that only read were correct as written and rewriting them would have added diff with no behavior behind it.

## Ship-chain hazards

### The drift gate stages a file that mis-scopes the review

Two documented behaviors meet on any branch editing an authoring surface, and the result is a review of the wrong file set. The Consumed copies stage clears only on a staged regeneration, so a branch that edits `governance/rules/core/X.md` has to stage `.claude/rules/canon/core/X.md` before `bun run check` passes. <!-- audit-ignore-citations: .claude/rules/canon/core/X.md --> `review-branch` Step 2 then takes a non-empty `git diff --staged` as its diff scope, which is the generated mirror alone and none of the files carrying the change.

Nothing reports it, since the review runs, writes a receipt, and reads clean. On a branch before its first commit the branch pair is empty too, so `git diff HEAD` is the only read at correct scope and the staged-set rule has to be overridden by hand. Measured 2026-08-20, where the staged set held one file against four the branch had changed.

### The body that writes a receipt owns its lifetime

The ship chain used to delete the receipt its own closing line cites. `auto-ship` Step 6 leaves minor findings in `.canon/review/branch/review-<slug>.md` and its output block names that path, while Step 7 reaches `docs-fold` through `git-ship`, whose Reviews sweep took the same file as consumed scratch. Seven runs recorded the collision across two days and it read as an annoyance a session works around, until it reached a fixture on 2026-08-31: `scripts/sandbox/fixtures/claude/auto-ship/prose-executable/expect.toml` asserts that receipt exists, so the arm could pass only on a run Step 6 stopped early and a clean review reddened it every time.

`auto-ship` owns the lifetime now, because it writes the file, cites it in its own output, and is the one body that can read whether Step 6 still needs it, where `docs-fold` sweeps for whatever called it and cannot. Pinning the slug once at chain entry was the alternative, and it makes the deletion reliable rather than stopping it, closing the one accidental escape recorded here where a receipt survived only because `review-branch` derived its slug before `git-branch` renamed the branch and the sweep looked for a name the review had never written. What reaps the receipt instead is the second sweep in that same step, over reports whose branch no longer exists, which was already written and already correct and turns the collision into a delay rather than a leak. The cost is one receipt per live branch, bounded by the branch count where the sweep it replaces was bounded by nothing, and the durable record stays the pull request's `## Technical Context`, folded before `docs-fold` runs.

The collision closed on 2026-08-31. Driven against the merged fix, `prose-executable` reached Step 7 clean, its receipt surviving to the check that reads `paths` and `reply` both green. `canon sandbox check` confirmed it at 116 turns and $1.71, and the chain opened `erclx/aitk-sandbox#24` as a draft. `scripts/sandbox/fixtures/claude/auto-ship/prose-executable/expect.toml` carries the run's own account, so read it there rather than here for what changed.

### A slug-keyed sweep cannot reach what a later chain step writes

A sweep placed in one ship-chain skill collects nothing when the file it looks for is written further down the same chain. `git-ship` runs `docs-fold` second and `memory-review` ninth, which is the order `auto-ship` Step 7 now reaches by invoking it, so a memory receipt lands seven steps behind the sweep keyed on the current slug, and no later branch recovers it because a slug is unique per feature. The sweep runs, finds nothing, and reports a clean pass, which is the same silent shape as the drift gate above.

Scanning the folder is the fix that survives both this and the slug-derivation hazard two entries up. The memory receipt sweep therefore reads every `.canon/review/memory/memory-review-*.md` and tests each for pending items rather than the session's own file. A sweep keyed on a slug is only safe when the file is written before it in the chain, and nothing in the folder now meets that bar: the review receipt was the one case, and the entry above retired its slug-keyed sweep for a reason of its own.

### A citation count that reads one surface misses the other

The `docs-fold` plans sweep is retired, and the two hazards it carried outlived it. It swept every task on the board rather than the session's own, which once matched a task whose plan was live in a locked parallel worktree and growing mid-session, where archiving would have moved it out from under that session with no history to recover from. Settling a plan on the merge is what closed that, since a branch still building has not merged.

The second is live in `archiveTask` today. It decides whether a plan is still cited by scanning `Plan:` lines alone, so a table row in `.canon/tasks/priority.md` carrying a plan its task file never states leaves the count at zero and the row pointing at a moved file. `canon tasks validate` reports that pair as `plan-uncited` rather than the archive reading the row, which keeps the count on one surface and puts the disagreement in front of a person.

### A cross-cutting entry never refreshes from the diff

An entry describing a cross-cutting rule never refreshes from the diff. `docs-fold` picks entries whose prose references files the diff touched, so an entry referencing no path at all is skipped by construction. Seeding a development context entry made the claim in `canon/context/context-model.md` that new entries are not created automatically false, and the sweep would have shipped a rule the code no longer follows. Sort entries into the kind a diff refreshes and the kind the enforcing change is what invalidates, and edit the second by hand.

### A stub never refires when its real signal arrives late

The trigger this records is retired. `docs-fold` no longer carries a diagram sweep at all, so nothing keys on a signal arriving or a cited path leaving, and `.canon/diagrams/` is redrawn on demand by `draft-diagram` rather than watched on every ship. The defect is kept because the shape outlives the step: an uncovered-kinds trigger fires only when a diff adds a signal and no entry covers that kind, so an entry already drawn from something weaker was never told its real source now existed. `standards/diagrams.md` specifies the components diagram as drawn from `canon/ARCHITECTURE.md`, the entry predated that file and named a code scan instead, and the commit creating `canon/ARCHITECTURE.md` added exactly that signal while the sweep emitted nothing. Any later trigger keyed on a signal entering the tree inherits the same blind spot.

### Pull request detection hits a merged namesake

`gh pr view` resolves by head ref name and ignores state, so a branch name reused after its first pull request merged sends `git-pr`'s create-or-edit conditional down the edit arm and rewrites a merged record. It has fired three times against three different merged records. The push reports `* [new branch]` either way, so nothing in the output suggests a collision. Detect with `gh pr list --head <branch> --state open` and create with an explicit `--head`. Recovery takes the squash merge subject for the title and GraphQL `userContentEdits(last: 1)` for the body.

### The draft conversion lands and whoever closed the review lifts it afterwards

`gh pr ready --undo` writes the flag. An earlier reading here had the command printing its conversion line on a run that changed nothing, and two measurements disprove it: `#1265` recorded `convert_to_draft` and `ready_for_review` nine minutes apart with no session writing between them, and a third-party read on `#1307` caught the pull request ready before the undo ran and a draft minutes later. Four correlation passes eliminated every candidate inside the tree, leaving the operator or the controlling session that closed the review to ready the pull request directly, which GitHub requires and no guard should prevent. Read the flag back anyway, since it reverted after a later force-push, so a read is worth repeating whenever the branch is pushed again. `convertPullRequestToDraft` against the node id is the GraphQL fallback where the command is refused.

A third instance sits beside the two above and reads differently, since it is the defect this closing line left open rather than a confirmation of it. On 2026-09-07 a controlling session told a worker to run the undo instead of taking the act itself (`#1594`), and the worker complied and reported against the surface rather than the outcome. `role-worker` and `role-orchestrator` now carry the boundary the correlation passes never stated: the act is the operator's or the controlling session's, taken directly, and a worker refuses the instruction whoever sends it.

### A failed commit leaks into the next group

When a sequence of grouped commits runs unattended and one is rejected by a hook, its files stay staged and the next group's `git add` absorbs them, so the failure lands as a wrong commit rather than a missing one. A 74-character subject failed `header-max-length` and the 24 files it carried committed under the following group's message, while the run reported a passing final `git log` because the commit count was the only thing short.

### A format change strands the predicates routing on it

When a format a skill parses changes shape, every predicate routing on the old shape has to move with it. Converting the task `Plan:` line to a markdown link taught both `docs-fold` Step 8 and `task-board` Archive Step 2 to read the target out of the parentheses while their routing bullets still named `.canon/plans/`, so a link-form task matched no bullet and fell to the final warn-and-skip, which archives nothing.

### A ported condition keeps the test its source could afford

Lifting a conditional from another skill copies the clause rather than what it tests. `docs-fold` calls a diff baseline unusable when it came from local `main` and equals HEAD, which misses `origin/main` resolving a merge base equal to HEAD, the shape of every feature branch before its first commit. It never pays for the gap because it unions the committed, working, and untracked sets, and ported verbatim into four skills reading the committed half alone it would have blinded them.

### Adding a shipped skill trips two gates the sync checklist now names

A new folder under `claude/skills/` fails `bun run check` twice before anything about the skill itself is wrong. `src/claude/cases/all.test.ts` asserts every shipped skill carries at least one routing case, so the suite fails until the new name gets an entry in one of the `src/claude/cases/*.ts` files, and the failure names the skill rather than the checklist step that was missed. The Hero gate stage then fails, because the captured frame prints the shipped skill count and the count moved, which wants `assets/captures/hero.html` regenerated and re-rendered through `canon capture` with all three of the markup, the image, and the stamp committed. The `internal-claude` sync checklist names the folder, the catalog decision, the sandbox scenario, and both of these, pointing back here for the reasoning behind each rather than restating it.
