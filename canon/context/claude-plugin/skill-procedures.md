---
title: Shared skill procedures
description: The CLI shell-out pattern every skill follows, the label map a project declares rather than the skill ships, the review classifier that became data a verb parses, the core.bare repair carried at two points, the dependency-check step's literal presence test and lockfile table, the branch worktree entry hands the ship chain, and the procedures defined once in standards and cited from each body
---

# Shared skill procedures

## The CLI shell-out pattern

Plugin skills that shell out to the CLI follow a consistent pattern: read the toolkit catalog via `canon <domain> list --json`, match against project context, then execute the CLI with `CANON_NON_INTERACTIVE=1` so it skips prompts. Claude Code's tool permission dialog is the single confirmation gate. Skills never reimplement CLI logic or hardcode rule, stack, or snippet names. `setup-gov` is the reference.

### Reading a report rather than rediscovering

`canon-operator` reads `canon sync --check --json` rather than walking the tree itself, and treats an absent report key as unread rather than as an empty answer. An absent key and an empty array are separate states: reading an absent key as empty exits zero, takes the nothing-to-report branch, and reports a clean target the CLI never actually measured, while a current CLI reporting an empty array has looked and found nothing.

That skew is the general shape rather than one skill's problem. A skill reaches a target through whichever CLI the machine has, while the skill itself loads live from the plugin, so a body written against a field can run against a binary predating it. `ARCHITECTURE.md` carries the two-speed release as a standing risk.

The fallback does not key on `historyUnavailable`, since that field reports failed attribution on a domain or on `seeds`, while `unmigrated` is a filesystem read carrying no attribution at all. Keying on it would drop a correct detection whenever an unrelated half of the report could not be dated.

### Where the fallback stops being the safe answer

`migration-superseded` reads the `superseded` array off the same report and takes the opposite branch when the key is absent. It stops and names the CLI rather than degrading to a listing, because the two detections fail differently. `unmigrated` pairs against domain folders whose worst listing error is an unfiltered count, while `superseded` pairs against the seed subdirectory names and an uppercase stem is not the test.

A listing of `.claude/*.md` also reaches `ARCHITECTURE.md`, `REQUIREMENTS.md`, and `DESIGN.md`, each a single file the layout intends to stay one, so the fallback that costs a count on one skill costs three shredded documents on the other. A fallback is worth having when its failure is an imprecision and worth refusing when its failure is a proposal nobody can undo.

The destination standard is the second place the skill declines a route every sibling takes. `skill.md` has a body cite the plugin copy at `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, which is correct for a standard the skill follows itself. Here the standard is the project's own agreement about the shape of a folder, resolved by matching the replacement path against the `appliesTo` the standards catalog declares.

A proposal drawn from the plugin copy would hand back a shape the project never adopted, against content only the user can place, so an absent standard names itself and the install command and proposes nothing. Resolving through `appliesTo` rather than through the folder stem is what lets the four seed folders nobody has observed degrade by mechanism, since `.claude/hooks/` matches no entry and earns a decline rather than a guessed shape.

### Reading the report for a precondition rather than a detection

`migration-standards-drop` reads the same report for its `skew` object alone and detects from a directory read. Nothing in the report names an installed `.claude/standards/` tree: `src/sync/check.ts` registers governance alone and `ROOT_LAYOUTS` in `src/sync/layout.ts` is empty by decision, so there is no key to test for and no absent-key branch to get wrong. What the report answers instead is whether the sync the proposal names may run at all, since a binary behind the published version installs rules citing the path the move removes. The absent-key discipline above still applies to the field it does read, where an unread version reports as unknown and continues rather than as current.

### Configuration a project declares rather than a skill ships

`git-pr` labels a pull request from a `[domains]` table at `canon/config/pr-labels.toml`, keying a label name to the path prefixes that earn it. No domain name of this repository reaches the skill or its references, because a shipped label set is a guess about someone else's surfaces and a wrong default costs more than no label at all. A project declaring no map is labelled silently and never warned, which reads the absent-key discipline above the other way: an absent file here is an answer rather than a state to repair.

The map keys on changed paths rather than on the conventional-commit scope, since the top level of the tree already is the domain set and a scope-based table would need a second vocabulary held in step with the first. `.github/` is the rejected home for the map, since a skill reads the file and GitHub does not. `actions/labeler` would earn that folder but relabels on every push, needs a second glob syntax the skill cannot read, and derives labels from something other than the diff the body is written from.

Matching is prefix-anchored, so a row written for an authoring root reaches nothing under the consumed copy: `standards/` never matches `.claude/standards/`, and `claude/skills/` never matches `.claude/skills/`. Every surface living only under a dotted folder needs its own prefix on the row that owns its subject.

`canon labels audit`, living in `src/labels/` rather than in the skill body, names an uncovered branch before it merges. A second table, `[declined]`, separates a surface nobody covered from one somebody decided against, since prose can carry that distinction only to a reader rather than to a command. `canon/context/cli/audits.md` carries the reasoning behind the verb.

What it cannot see is a row that has gone stale: an entry naming a path that no longer exists still parses, still loads, and stops matching, so a branch moving a file the map enumerates literally leaves a dead row behind and the audit reports clean over it. Verify a rename against the moved tree rather than trust a passing run. A moved path shows up under `declined` against the row that caught it, where a dead entry appears in neither `declined` nor `uncovered`.

The skill calls the verb and keeps the stated rule as a fallback. A target whose installed `canon` predates the verb still labels correctly off the reference, though it loses the uncovered-path report.

The fallback carries every refusal except `no-map`, rather than the absent record alone: a map with a typo still has rows a prefix match can reach, so reading that refusal as an absence would open the pull request unlabelled and say nothing. `no-map` is the one reason that stops the step, since a project declaring no map has nothing to fall back to.

Eleven rows carry 41 prefixes. What is left uncovered is recorded in the file itself rather than covered: four paths a release moves and three a command rewrites, since a domain row over either gives a mechanical edit a subject it does not have, plus `assets/captures/hero.html`, which rides in the commit that regenerates the image beside it, so a row over `assets/` would label every such commit with a surface none of them is about.

### Labelling runs at open and nowhere else

Labelling runs after the pull request resolves rather than as a flag on the create. `gh pr create --label` fails whole on a label the remote lacks, so a mistyped row opens no pull request at all and the branch is left pushed with nothing to review. `gh pr edit --add-label` afterward degrades to a warning naming `gh label create` on failure, and it covers both the create and the edit branch with one call, earning a second output line since a refusal reaching nobody is the failure the fallback exists to prevent.

The step stays in `git-pr` alone, which makes the label set a description of the branch at the moment the pull request opened. `review-address` delegates its push to `git-followup`, which stages, commits, pushes, and refreshes the body without invoking `git-pr`, so no follow-up push reaches the labelling step whatever the branch touched.

A branch that pushes again after opening can merge under-labelled if the new commits cross into a domain the open-time diff never touched. Moving the step into `git-followup` is the alternative and it loses on the price rather than on the rate, since one behavior in two skills on two cadences buys back a rare miss. A check comparing the label set against the diff after the fact is the other answer and it loses too, since nothing can do that without re-deriving the map on every push, which is the same step in a third place.

### What the map fails to cover

The map has a second consumer and it is a person. Nothing detects a top-level directory the table fails to cover, so a surface added later labels nothing until someone adds a row, which is the manifest-to-reference symmetry this repository already records as a gotcha, arriving in a new folder.

`.claude/` carries no row of its own, since the tree spans context entries, two sets of generated mirrors, and internal skills rather than one domain, and a single row would label unrelated work alike. Each subtree instead carries its prefix on the row owning its subject: `.claude/rules/` joins `governance` and `.claude/internal/snippets/` joins `snippets`, rather than the map doubling with a row per subtree.

The row count is the measure worth watching here. A map with a row per subtree would rebuild the unreadable map this design avoids, which is why extending an existing row is the default and a new row waits for a subject no label carries. `snippets` and `repo` are the two that earned one.

### The review classifier is data the CLI parses rather than a list a body applies

`auto-ship` Step 5 decides whether `review-branch` runs. `canon autoship classify` returns the decision, the file that decided it, and which of the two tests that file failed, reading the prefixes from `src/autoship/paths.ts`. It is an instance of the rule `ARCHITECTURE.md` states: a rule a session can talk itself out of moves into a verb rather than staying prose a body applies by hand.

Being machine-parsed is what makes the set permanently exempt from any later design that folds a list back into the surface citing it, on the clause `ARCHITECTURE.md` already carries. The bar there is a list a parser reads, and this one is now read by `classifyChanges` rather than by a reader.

The verb takes the changed set as arguments and reads no git, which is not a convenience. `git-ship` and `review-branch` already share one diff baseline, and a classifier resolving its own range could disagree with the set the chain measured, which is the stale-baseline half a prior row closed. Handing the names over keeps one baseline for the whole chain.

What it costs is the fourth surface reached by the two-speed release. The verb ships with the CLI and Step 5 ships with the plugin, so a target on an older binary meets a missing subcommand, and the body keeps the written list as the fallback rather than refusing. The fallback may never be a skip: failing open is the defect the verb closes, so an absent subcommand that routed to a skip would ship every branch unreviewed. Two copies of the path set is the price, standing until a release retires the written half, and nothing compares them.

### The body check reads one section and grades one direction

`review-pr` Step 3 tests every ticked `## Testing` box against the head and also checks `## Key Changes`: `canon pr key-changes` compares the paths that section claims against the pull request's own changed-file list, and the step files a claim the diff does not carry under the same `**PR body**` block the stale ticked box already takes, since what both corrupt is the merge record rather than a file in the diff.

The section is read alone, since `## Technical Context` names files a branch never touched by design. A bullet's claim region ends at its first comma, since a clause past the comma is usually naming context rather than the edit itself, and reading the whole bullet as a claim pulls those context mentions in as false claimed-but-untouched paths.

Only the claimed-but-untouched direction is graded. A changed file no bullet names is reported without a severity, since that class covers a real omission and equally a generated asset or a regenerated index, and grading it would fire on nearly every branch. A path written partially, or one past its bullet's first comma, can credit a changed file and never accuse one, since nothing separates a path written short from a path written wrong or a second claim from a file cited for context.

Three words void a bullet's claim outright when the bullet declines an edit rather than making one: `untouched`, `unchanged`, and `as written`.

Each direction then splits again on whether the evidence is worth raising with a person, and what each split sets aside is still reported rather than dropped. A test beside its subject, a fixture, and a lockfile owe no bullet by Step 3's own standard, so they come out of `unnamed` into `incidental`, since a count mixing files that owe a bullet with files that never could cannot be acted on at any value. A generated asset and a regenerated index belong in that class and are deliberately absent, since neither has a spelling that holds outside one project and guessing at one would set aside a file that did owe a bullet. `docs/agents/key-changes.md` carries the span rules and the residual rate.

It composes on the body read Step 4 already does rather than opening a second one, since two reads of one text at one head is two places for the head to be wrong.

### Repairing `core.bare`

`session-worktree` repairs `core.bare` at two points rather than one. Claude Code's entry tool writes the flag into the parent repository's shared config and its exit tool never restores it, which leaves every later command in the main worktree failing for want of a work tree while the files sit untouched on disk. The linked worktree keeps working, so the session that caused the damage is the one least likely to see it.

Repairing only after entry would still admit a repository broken by an earlier session, so the skill reads the flag in Step 1 beside the main-root resolution and repairs before entering, then repeats the repair in Step 5. Both writes are guarded on the flag actually being set, since the entry tool does not set it every time and an unconditional repair would rewrite the config on runs where nothing broke.

`scripts/core/repair-bare-flag.sh` carries the same repair as a second line of defense, sourced from `scripts/lib/worktree.sh` and run by `canon gate run` ahead of every stage because the flag breaks the git reads that scope the run. Nothing forces worktree entry through the skill, and one occurrence hit an operator whose session never entered a worktree at all. A git hook cannot serve here, because the corrupted command aborts before any hook runs.

Both call sites confirm the repository's common dir is named `.git` before writing, which separates the defect from a genuinely bare repository that keeps its objects at the root and would be broken by the repair. The skill states the upstream issue inline rather than pointing at `wiki/claude/claude-worktrees.md`, since a shipped skill runs where no `wiki/` path resolves and `check-skill-paths.sh` fails the build on one.

### Step 6's dependency check is a literal test, not a description

`session-worktree` Step 6 carries the test itself: Node and python each read against a literal `[ -f ... ]` / `[ -d ... ]` pair, and the closing "no manifest" line takes its own direct test, run ahead of both rather than reached by falling through them unmatched. `<install>` resolves off a fixed four-row lockfile table, `bun.lock` or `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, then `package-lock.json`, checked in that order and falling back to `bun install` when none match.

A literal shell test rather than a `canon` verb, since directory presence is not a judgment call and the body ships to a target that may hold no `canon` binary on PATH at all.

### The branch worktree entry hands to the ship chain

`session-worktree` renames the entered branch to `<type>/<name>` rather than to the bare `<name>`. Two consumers pull in opposite directions on that string. Slug derivation wants the plan's own slug, since `auto-ship` finds the plan from the branch and stops when the two spellings differ, and `git-pr` guards on `<type>/<description>` and refuses anything without a type.

The bare name satisfied the first and failed the second, mid-chain, with the work already done and uncommitted. `standards/slug.md` absorbed the difference by dropping a leading type segment before it replaces slashes, so one branch answers both and no consumer had to learn a second spelling.

Entering from a branch that is already conventional stops on the collision. The name derives back onto the branch the session came from, git refuses a second branch under it, and the type default cannot invent a distinct one.

Both collision tests sit in Step 2, ahead of the entry call, because the typed name turns a rare stop into a common one and a stop after entry leaves a worktree built with the session inside it. Neither read needs a worktree. The directory test earns its place beside the branch test rather than duplicating it: two branches differing only in type are distinct refs that collapse onto one slug, so `feat/foo` and `fix/foo` reach one `.claude/worktrees/foo/` and only the directory read sees it. That is the collision `standards/slug.md` records as the cost of dropping the type.

The branch test reads both ref spaces through `git for-each-ref`, matching `checkClaim` in `src/sessions/claim.ts`, so a name this skill clears and a branch a dispatcher cleared answer the same question. `git show-ref --verify` sees no remote-tracking ref, so a branch pushed from elsewhere would pass that narrower test and collide at its first push.

Entry from the main worktree is the case `auto-ship` cannot reach. The guards derive the slug from the current branch and stop when `.canon/plans/feature-<slug>.md` is absent, while Step 0 is the section that enters the worktree giving the branch its name. On `main` the slug resolves to `main`, no plan is filed under that name, and the guard stops the chain before Step 0 runs.

That derivation is also what couples a plan filename to exactly one branch, since the two are one string by construction. `auto-ship` Step 1 takes a caller-supplied plan, a path or a bare slug in the same position `session-worktree` tier 0 accepts its name, ahead of deriving `.canon/plans/feature-<slug>.md` from the branch. The branch-keyed slug that names the worktree, the review receipt, and the pull request is unchanged either way, since only the plan lookup moved.

`orchestrator-dispatch.md` resolves the row's plan to derive the candidate branch and passes that same plan path into the launch, rather than letting the worker re-derive it from the branch it lands on. A plan named outside `feature-<slug>.md`, such as a phased row backing several branches from one file, still needs its own file per branch under this change, since naming the plan is not the same as letting one plan answer for more than one.

### Which document Step 1 resolved

A path resolving to a file says nothing about which document it names, and a task file resolves exactly as a plan does since both are markdown sitting at a path that exists. A path under `.canon/tasks/` reaches a tier of its own, which reads the task's first `Plan:` line and takes what it names, so a caller holding the board's own pointer does not meet a refusal.

Everything else meets the shape test, which checks the resolved file for the `**Files to touch:**` marker `standards/plan.md` requires structurally, or the `## Files to touch` heading form the same standard admits, since a task never carries either. That test runs after all three tiers rather than guarding the supplied one alone, because a branch slug matching an unrelated plan is the same wrong-file risk under the derived tier and a task's own pointer can name a non-plan under the first.

The task tier refuses three ways and each names a different repair, since one message covering all three sends the caller to the wrong file. A path under `.canon/tasks/` resolving to nothing is a typo, a task carrying no `Plan:` line is a row nobody has planned yet, and a pointer resolving to nothing is a stale citation the board should have caught. A bare slug stays a plan's under every tier, because a task slug and a plan slug collide on any similar name and a caller naming a task holds its path already.

The archive refusal tests the resolved path rather than the task's outcomes, since a stale board gets its ticks wrong while `standards/tasks.md` fixes where a shipped pointer lands: it points a shipped task's `Plan:` line into the plans archive, and an archived plan carries `**Files to touch:**` unchanged, so the tier would otherwise re-implement merged work. It covers the two older archive spellings an unmigrated project still holds beside `.canon/plans/archive/`.

What the pointer resolves against decides whether that refusal reaches anything. An archived task sits a folder deeper and the standard points its line at `../../plans/archive/feature-<slug>.md`, so a base fixed at `.canon/tasks/` lands on a repository-root `plans/archive/` that never exists, and the run would answer a correct citation with the stale-citation message. Resolving against the directory holding the task file instead of a fixed base closes that, and taking a bare path beside a link target reaches the older tasks writing the target as a plain project-root path.

### Where a run from `main` stops

Supplying the plan moves where a run from `main` stops. The slug still resolves to `main` and no `feature-main.md` is ever filed, but the caller-supplied tier answers from the argument rather than from that path, so the chain proceeds into Step 0 instead of stopping ahead of it. Step 0 invokes `session-worktree` with no name and leaves derivation to the wrapper, and on `main` with more than one plan on the board that lands the wrapper on tier 3 and its instruction to ask the operator, which a chained run cannot answer. The caller holds the resolved plan by then, so it passes that plan's slug as tier 0 rather than letting the wrapper re-derive what Step 1 already settled.

`session-worktree` handles entry from `main` on its own terms, tiering through a caller-supplied name, then the single plan file, then the multiple-plan question, then an inference from session context. The two bodies therefore answer differently about starting from `main`.

The caller-supplied tier is what a dispatched worker reaches, and it exists because every other tier answers from state the caller cannot set: a worker launched onto `main` misses the branch tier, a board carrying more than one plan puts the single-plan tier out of reach, and the multiple-plan tier then instructs it to ask a person who is not there. Naming the branch in the launch prompt closes none of that, since no tier reads the prompt, so the dispatch runbook calls `session-worktree` with the branch as its argument before `auto-ship` runs. A type spelled by the caller also wins over the one a plan's own lines grade to.

`git-followup` sits at the other end of the same entry. Its guard reads an open pull request rather than a tracking ref, since a worktree branch can carry an open pull request without one, and the push leg sets the ref with `git push -u origin HEAD` when none resolves. Refusing a branch with no pull request stays, since that is the split from `git-ship` rather than an accident of where the branch came from.

### Bundled references

`setup-plugins` bundles `references/plugin-catalog.md`, which holds install data alone. `canon/context/claude-plugin/skill-strategy.md` argues the install-versus-author decision and is not reachable from the shipped file by design, since a `references/` file is read by a session running in a target project, where no `canon/context/` path resolves.

It is recorded here instead, on a surface that never ships, for the maintainer editing the catalog.

## Procedures defined once and cited

Two procedures run inside more than one skill and are defined once in `standards/`, cited from each body rather than restated in it. Each has a standard of its own, `publish.md` for the scan and `slug.md` for the transform. Neither sits inside a document-type standard, since `markdown.md` does not govern a scan and `skill.md` does not govern a slug transform.

The scan carries two checks under one citation, characters and phase labels, with the rules themselves held by `markdown.md` and `versioning.md` beside it. A skill citing the scan gets both without naming either file, which is what keeps a new check from costing an edit in every consuming body. The label check scopes by destination, so `draft-diagram` cites the same standard and takes the character half alone.

Both are stated generally, and neither names what enforces it here. An installed standard belongs to the project that installed it, so a standard citing this repository's audit hook, scratch paths, or output filenames goes wrong in a target that has none of them, with nothing reporting it. In this repository the scan covers text the hook never reaches, meaning `.canon/tmp/`, anything leaving through `gh`, and anything inside a fence, and that belongs here rather than in the file that ships. Each citing skill names its own gap for the same reason, since the gap is a fact about the skill.

A citation names one path, `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, the same as any standard a body reads. The plugin install dereferences the `claude/standards` symlink, so every plugin cache holds the whole corpus and that path resolves wherever the plugin does. `slug.md` at 16 citations and `publish.md` at 7 are reached by citation alone, since neither has a home outside the corpus.

The split between the two surfaces is what keeps the citation honest. The standard owns the procedure and the body owns the trigger, since both the moment a scan runs and the text it runs against vary per skill. The empty-branch case splits the same way, carrying three legitimate answers across the catalogue: fall back to `latest`, stop, or fall through to another source. A body that cites without stating its own case reads as if the default applied to it.

Nothing detects a body that restates a procedure instead of citing it. `assert_no_drift` covers generated copies and a hand-written restatement is not generated, so the guarantee is only that a single definition exists to correct.

## The routing handoff drains per session

The memory-routing handoff queue drains per session rather than accumulating unread, so a file sitting in it is evidence about one session rather than about the mechanism. A handoff outlives its producer only when that producer never reached its own ship chain, so an aged file reads as a session that stopped early rather than as a queue with no consumer. Check the modification time against the live worktree list before concluding the mechanism itself is unread.

### A main-root write names its route or the guard silently takes it

Eleven bodies write shared session scratch at the main worktree root, and Claude Code refuses any such write from a linked worktree, redirecting to the worktree copy instead. The redirected write still succeeds, so a body stating only the destination reports success and loses the file, with no stage reporting the miss.

Each body names the route beside the destination rather than the destination alone. Creating a whole file goes out as a plain single `Bash` command carrying a heredoc, with `mkdir -p` sent separately because the isolation refuses a compound command whose target it cannot statically verify. Changing a line inside an existing file goes through a `canon` verb, since the shell route for that case is the stream editor `CLAUDE.md` bans. `CLAUDE.md` and the seed state the split once, and each guard names only what it writes.

Two structured edits earned verbs, `canon tasks pull-request` and `canon tasks outcome`, chosen over a body instruction because the board write has a measured cost and a verb is the only part of this a test can reach. A structured edit no verb covers, such as `docs-fold` retargeting a `Plan:` line or `memory-review` flipping an item's emoji, reads the file and writes it back whole, staying a body instruction until a second caller wants the same edit.

The read sites were left alone. `Read` resolves against the main root normally, so the six bodies that only read were correct as written.

## Ship-chain hazards

### The drift gate stages a file that mis-scopes the review

Two documented behaviors meet on any branch editing an authoring surface, and the result is a review of the wrong file set. The Consumed copies stage clears only on a staged regeneration, so a branch that edits `governance/rules/core/X.md` has to stage `.claude/rules/canon/core/X.md` before `bun run check` passes. <!-- audit-ignore-citations: .claude/rules/canon/core/X.md --> `review-branch` Step 2 then takes a non-empty `git diff --staged` as its diff scope, which is the generated mirror alone and none of the files carrying the change.

Nothing reports it, since the review runs, writes a receipt, and reads clean. On a branch before its first commit the branch pair is empty too, so `git diff HEAD` is the only read at correct scope and the staged-set rule has to be overridden by hand.

### The body that writes a receipt owns its lifetime

`auto-ship` owns the receipt's lifetime, because it writes the file, cites it in its own output, and is the one body that can read whether Step 6 still needs it, where `docs-fold` sweeps for whatever called it and cannot.

Pinning the slug once at chain entry was the alternative, and it makes the deletion reliable rather than stopping it, closing an accidental escape where a receipt survived only because `review-branch` derived its slug before `git-branch` renamed the branch and a sweep looked for a name the review had never written. What reaps the receipt instead is a second sweep, over reports whose branch no longer exists, bounded by the branch count. The cost is one receipt per live branch, and the durable record stays the pull request's `## Technical Context`, folded before `docs-fold` runs.

### A slug-keyed sweep cannot reach what a later chain step writes

A sweep placed in one ship-chain skill collects nothing when the file it looks for is written further down the same chain. `git-ship` runs `docs-fold` second and `memory-review` ninth, so a memory receipt lands seven steps behind a sweep keyed on the current slug, and no later branch recovers it because a slug is unique per feature. The sweep runs, finds nothing, and reports a clean pass, which is the same silent shape as the drift gate above.

Scanning the folder rather than keying on the slug is what survives this. The memory receipt sweep reads every `.canon/review/memory/memory-review-*.md` and tests each for pending items rather than the session's own file. A sweep keyed on a slug is only safe when the file is written before it in the chain.

### A citation count that reads one surface misses the other

The `docs-fold` plans sweep is retired, and two hazards it carried outlived it. Sweeping every task on the board rather than the session's own could archive a plan still live and growing in a locked parallel worktree, with no history to recover from. Settling a plan's archive on the merge rather than on a sweep closes that, since a branch still building has not merged.

The second hazard is live in `archiveTask` today. It decides whether a plan is still cited by scanning `Plan:` lines alone, so a table row in `.canon/tasks/priority.md` carrying a plan its task file never states leaves the count at zero and the row pointing at a moved file. `canon tasks validate` reports that pair as `plan-uncited` rather than the archive reading the row, which keeps the count on one surface and puts the disagreement in front of a person.

### A cross-cutting entry never refreshes from the diff

An entry describing a cross-cutting rule never refreshes from the diff. `docs-fold` picks entries whose prose references files the diff touched, so an entry referencing no path at all is skipped by construction. Sort entries into the kind a diff refreshes and the kind the enforcing change is what invalidates, and edit the second by hand.

### A stub never refires when its real signal arrives late

`docs-fold` no longer carries a diagram sweep at all: nothing keys on a signal arriving or a cited path leaving, and `.canon/diagrams/` is redrawn on demand by `draft-diagram` rather than watched on every ship.

The shape is worth recording because it outlives the step: an uncovered-kinds trigger fires only when a diff adds a signal and no entry covers that kind, so an entry already drawn from something weaker is never told its real source now exists. `standards/diagrams.md` specifies the components diagram as drawn from `canon/ARCHITECTURE.md`, and an entry predating that file and naming a code scan instead would go untold the day `canon/ARCHITECTURE.md` was created and the signal entered the tree. Any later trigger keyed on a signal entering the tree inherits the same blind spot.

### Pull request detection hits a merged namesake

`gh pr view` resolves by head ref name and ignores state, so a branch name reused after its first pull request merged sends `git-pr`'s create-or-edit conditional down the edit arm and rewrites a merged record. The push reports `* [new branch]` either way, so nothing in the output suggests a collision.

Detect with `gh pr list --head <branch> --state open` and create with an explicit `--head`. Recovery takes the squash merge subject for the title and GraphQL `userContentEdits(last: 1)` for the body.

### The draft conversion lands and whoever closed the review lifts it afterwards

`gh pr ready --undo` writes the flag. Read the flag back anyway, since it can revert after a later force-push, so a read is worth repeating whenever the branch is pushed again. `convertPullRequestToDraft` against the node id is the GraphQL fallback where the command is refused.

Readying a pull request to merge is the operator's or the controlling session's act, taken directly, since GitHub requires it and no guard should prevent it. `role-worker` and `role-orchestrator` carry that boundary: a worker refuses an instruction to lift the mark itself, whoever sends it, and reports against the outcome rather than complying with the surface of the request.

### A failed commit leaks into the next group

When a sequence of grouped commits runs unattended and one is rejected by a hook, its files stay staged and the next group's `git add` absorbs them, so the failure lands as a wrong commit rather than a missing one. A 74-character subject failed `header-max-length` and the 24 files it carried committed under the following group's message, while the run reported a passing final `git log` because the commit count was the only thing short.

### A format change strands the predicates routing on it

When a format a skill parses changes shape, every predicate routing on the old shape has to move with it. Converting the task `Plan:` line to a markdown link taught both `docs-fold` Step 8 and `task-board` Archive Step 2 to read the target out of the parentheses, but a routing bullet still naming the old bare-path form matches nothing for a link-form task, which falls to the final warn-and-skip and archives nothing.

### A ported condition keeps the test its source could afford

Lifting a conditional from another skill copies the clause rather than what it tests. `docs-fold` calls a diff baseline unusable when it came from local `main` and equals HEAD, which misses `origin/main` resolving a merge base equal to HEAD, the shape of every feature branch before its first commit. It never pays for the gap because it unions the committed, working, and untracked sets, and ported verbatim into four skills reading the committed half alone it would have blinded them.

### A deterministic check backstops the session judgment writing the doc

`docs-fold` Step 3 and Step 7 rewrite canonical docs on session judgment, which can leave an appended figure or a re-measurement sitting beside the statement it restates rather than replacing it. Step 10 closes that gap by running `canon context classify diff` over the fold's whole diff baseline, after Step 3 and Step 7 have already run, and answering every non-`KEEP` finding rather than only the files those two steps wrote this run, since an earlier commit on the branch can carry a doc edit the fold is equally responsible for.

The verb's own extraction scopes to canonical doc types and reports nothing when the range carries none, and it reuses the Diff baseline section's own base rather than resolving a second one.

A `REPLACE` or `HISTORY` finding, and a regex-decided `MOVE` finding, is applied in place with a one-line reason to keep instead when it should not be. A model-decided `MOVE` finding is reported rather than cut, since the model's own prompt defines `MOVE` for correct content on the wrong surface, such as domain mechanism written into `canon/ARCHITECTURE.md`, which the regex layer's narrower wireframe-only reading of the same verdict never covers.

The verb's regex layer always runs regardless of whether a project configures a model, so every fold gets a deterministic check rather than one gated on a backend being reachable. A refusal or a missing `context classify` subcommand on an older installed binary reports one line and the fold continues either way, since the classify step is a check on what the fold wrote and not a precondition for shipping it.

### Adding a shipped skill trips two gates the sync checklist now names

A new folder under `claude/skills/` fails `bun run check` twice before anything about the skill itself is wrong. `src/claude/cases/all.test.ts` asserts every shipped skill carries at least one routing case, so the suite fails until the new name gets an entry in one of the `src/claude/cases/*.ts` files, and the failure names the skill rather than the checklist step that was missed. The Hero gate stage then fails, because the captured frame prints the shipped skill count and the count moved, which wants `assets/captures/hero.html` regenerated and re-rendered through `canon capture` with all three of the markup, the image, and the stamp committed. The `internal-claude` sync checklist names the folder, the catalog decision, the sandbox scenario, and both of these, pointing back here for the reasoning behind each rather than restating it.
