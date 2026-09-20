---
title: Gating stages
description: The stages that gate a push on a measure, covering the sandbox coverage ceiling, plugin manifest validation, and the seed independence token walk, plus the one measure-reading stage that reports instead
---

# Gating stages

Ten stages read a measure and fail a push on it rather than regenerating anything. Each states what it does when its input is missing, since a stage that skips quietly reports the pass it exists to withhold.

An eleventh reads a measure and reports it. `## Audit set` at the end of this entry covers it, and it sits here rather than in `canon/context/development/verification.md` because what it reads is a measure like the ten above rather than a gotcha about a stage.

## What sequences them

`bun run check` resolves to `canon gate run` and `bun run check:ci` to `canon gate run --all --no-write`. Three things live in `src/gate/`: the stage table in `stages.ts`, the changed-file scoping and the run loop in `sequencer.ts`, and every threshold comparison in `measures.ts`.

Three properties are load bearing and each has a case in `src/gate/sequencer.test.ts`. Stages run in table order. A stage that finds a fact halts the run, which is what makes a regenerate-then-assert round reveal one surface at a time. A scoped stage that the changed set carries nothing for says so rather than printing a clean line.

A stage is a list of checks, and a check is one of four kinds. A `command` is any binary. A `cli` runs this checkout's own `src/cli.ts`, since a globally installed `canon` resolves to the main checkout whatever worktree is running. A `drift` regenerates nothing and asserts a pathspec against the index and the untracked set. A `measure` is a reading whose verdict is a comparison rather than an exit code, which covers Sandbox coverage, Manifest validation, Hero provenance, Architecture record, Standard success criteria, and Audit set below. Skill paths and Seed independence stay `command` checks, since a script that exits non-zero on a finding needs no comparison around it.

Every check is an argument vector rather than a shell string, so no stage runs through `eval` and no check is a quoting question. What that closes is stated under `## Quoting a pathspec changes what it matches` in `canon/context/scripts/core.md`.

### A stage that cannot measure its input reports rather than passing

An unmeasured stage is a status of its own, distinct from pass and fail.

On a contributor's machine an unmeasured stage warns, the run still exits 0, and the closing line names how many stages measured nothing instead of printing an unqualified pass. Under CI it refuses, because an absent tool on a runner is a broken workflow step rather than somebody mid-setup.

The split is the sequencer's rather than each measure's. A measure returns the reason it could not read its input and never decides what happens next, so the rule is written once and no stage can disagree with it.

## Sandbox coverage

`canon sandbox coverage` reports which scenarios declare expectations. The Sandbox coverage stage reads the same report and gates on it, so a scenario added with no expectation fails a push rather than sitting undeclared.

The gate is `SANDBOX_UNDECLARED_CEILING` in `src/gate/measures.ts`, an absolute count of scenarios declaring nothing, pinned at what a clean run reports. A floor under the declared count would pass the case the stage exists for, since adding an unarmed scenario leaves the declared count where it was, and a ratio moves when a scenario is legitimately deleted. The ceiling does neither: deleting an unarmed scenario lowers it, and deleting an armed one leaves it alone. Raising the number is a deliberate edit, so a branch shipping an unarmed scenario has to say in the diff which one and why, rather than watching a percentage drift down over several merges with no single commit responsible.

`SANDBOX_ASSERTED_FLOOR`, also in `src/gate/measures.ts`, gates the same command's `--skills` census on `asserted` rather than on the scenario count above. A floor is the right shape here for the reason a floor was wrong for the scenario count: a dropped skill-to-scenario pairing lowers `asserted` directly, where an unarmed scenario leaves the declared count untouched. A rename that drops skill-to-scenario pairings without touching any scenario file fails this floor even while the Sandbox coverage stage above stays green, since that stage counts scenarios declaring an expectation rather than skills a scenario reaches.

A coverage command that exits non-zero fails the stage under CI and warns on a contributor's machine. The scenario tree ships in the checkout, so a runner that cannot read it has a broken command rather than an absent tree, and taking the skip there would report the pass the stage exists to withhold.

## Manifest validation

The Plugin manifests stage runs `claude plugin validate --strict` over every plugin and marketplace manifest the repository carries. It always runs, because a manifest edit is not the only thing that invalidates one and the whole stage costs about a third of a second.

It discovers its inputs instead of naming them. Two `git ls-files` listings, tracked and untracked, match `*.claude-plugin/plugin.json` and `*.claude-plugin/marketplace.json`, so a marketplace manifest added later is covered the day it lands with no edit to the script. Both listings honor `.gitignore`, which is what keeps linked worktrees and dependency copies from being validated as if they were ours.

The guard tests twice, first that `claude` resolves on `PATH` and then that `claude --version` succeeds, because a global install can land the wrapper and none of the platform-native package behind it, which leaves a name that resolves and a binary that dies on the first real call. A contributor's machine takes a skip on either failure, since an absent or half-installed CLI there is someone mid-setup rather than a broken gate. CI installs the plugin CLI as a workflow step, so both failures refuse there, and the refusal for a binary that cannot run names the pinned version rather than the install step that already succeeded.

`--strict` promotes warnings to failures, which is what makes the stage catch a manifest missing metadata rather than only one that fails to parse. The cost is that a Claude Code release introducing a new warning fails `bun run check` for everyone until the manifest answers it.

## Skill paths

The Skill paths stage runs `scripts/core/check-skill-paths.sh` over the shipped skill tree and fails on a path that resolves only in this repository. A shipped skill runs from a plugin cache in someone else's project, where this tree's top-level folders reach nothing, so a citation reading correctly here is a dead pointer everywhere the skill actually runs.

The walk reads inside fenced code blocks, which is what makes an illustrative example count. A TOML block demonstrating the label map in `claude/skills/git-pr/references/labels.md` used this repository's own `docs/` and `wiki/` rows and failed the stage. That is a true positive rather than the fenced-example class the Seed independence stage below accepts, since an example is the part of a reference a reader copies, so a target handed one built from this layout learns a folder set it does not have. An example in shipped content invents its paths.

The banned pattern is a bare `wiki/` with no exemption for a body that has a reason to name it. A shipped skill routing a page into a project's wiki has to describe both spellings, and only `.claude/wiki/` survives the match, so the root spelling is stated as a folder named `wiki` rather than as a path. That is the phrasing the promotion routing in `teach-workspace` carries.

## Hero provenance

The Hero stage regenerates every `assets/captures/*.html` from the template beside it and asserts no drift over the set, then runs the `captureStamps` measure in `src/gate/measures.ts` over the images. The drift assert cannot reach a PNG, because a chromium render moves its bytes with the browser version and a machine on a different chromium would fail on that rather than on a stale count. That leaves the artifact a README visitor actually looks at asserted by the second half of the stage alone.

`canon capture` writes a `.stamp` beside each PNG from inside the render, recording a `source-sha256` over the markup it read and an `image-sha256` over the bytes it wrote. The stage hashes both files where they sit on disk and compares each against its field. What it proves is provenance: this image came from this markup, whatever either file's history says.

Which frames it reads comes off the folder rather than a list. `captureStamps` takes the `.html` files under `assets/captures/` as its bases, resolves each base's `.png` and `.stamp` against `assets/`, so a frame added later is covered with no second edit and an image in `assets/` that no markup renders is left alone.

Both halves clear on a staged regeneration rather than on a committed one. `assert_no_drift` reads `git diff --exit-code` against the working tree and `git ls-files --others`, so `git add` of the three files satisfies it while nothing is committed, and `file_sha256` reads the path rather than a committed blob. A branch that regenerates the markup, runs the capture, and stages the triple therefore passes `bun run check` before its commit exists, which is what lets a ship chain verify ahead of the step that commits.

Two digests rather than one, because either file can move alone. The markup side catches an edit committed with no capture. The image side catches a PNG replaced, truncated, or committed by itself under markup that never changed, which a markup-only digest passes.

Writing the stamp inside the render rather than in a wrapper is what makes it worth reading. A caller cannot capture and skip the stamp, so a PNG without a current one is either uncaptured or hand-placed, and the stage names which of a frame's three files is missing rather than reporting a mismatch it cannot compute. A tree carrying no markup under `assets/` has no set to read and passes, which is correct.

Each digest covers a whole file rather than the counts inside it. A template edit changes what the image shows without moving any count, and hashing bytes keeps the stage ignorant of what the markup renders, which is what lets it stay correct as the frame grows fields.

The counts rendered into the frame are regenerated from the standards and skills trees and from the CLI registration block, so any branch adding a standard, a skill, or a command group moves `assets/captures/hero.html` whether or not it meant to touch the frame, and clearing the stage then costs a capture and all three files in the commit. `canon design css --no-components` fills a `{{TOKENS}}` placeholder in every template, so a branch moving a value in `src/design/tokens.ts` moves `assets/captures/hero.html` and `assets/captures/install.html` together and owes two captures, two images, and two stamps. The command-count source is the one a plan is least likely to predict, since the commands expose no `--json` catalog and the figure comes through `canon gov counts`, which parses the registration list in `src/cli.ts` directly.

`file_sha256` refuses on a machine carrying neither `sha256sum` nor `shasum`, and it refuses on stderr. Every caller reads it through a command substitution that captures stdout into the digest, so a message written there is swallowed and the stage reports a mismatch against a blank value, which names the image as wrong when the checker is what could not run.

The regen half is intermittently non-deterministic and nothing here explains why. `scripts/core/regen-hero.sh` exits 2 with no stdout and no stderr on roughly one run in five on WSL2, reaching the reader as `Hero regen failed` under a `run_check` that has nothing to print. The catalog verbs it shells out to run clean individually with stderr surfaced, and a trace ends mid-write of the `STANDARDS_JSON` assignment, so the failing command is unpinned.

Silence is the script's own doing rather than the stage's: `catalog()` sends every `list` call's stderr to `/dev/null`, so a failure inside one reaches nobody. Re-run the script before reading that shape as a real stale count, and know that `auto-ship` bounds verify at one fix attempt, so a chain meeting this stops on a stage that passes on retry.

## Seed independence

The Seed independence stage runs `scripts/core/check-seed-independence.sh`, which walks the `.md` files under every seed root and fails on the literal token `canon`. Seed prose installs into a scaffolded project and is read there as instruction about that project, so a line naming this repository's CLI hands a target a verb it may not be able to run and tells the reader the file is about somewhere else.

Banning a token is blunt, and the alternative is a judgment no stage can make. The only false-positive class is a fenced example naming the toolkit on purpose, which no seed carries, and a rule admitting fenced mentions would parse markdown to answer a question the corpus has never asked.

The match is a bare substring rather than a word boundary, and `grep -w` does not narrow it. A slash is a non-word character, so `grep -w canon` still matches `canon/config/config.json` with a boundary sitting either side. The bare substring is deliberate rather than unrefined, and the stage prefers a false positive to a missed citation because it gates.

### What the walk covers

The walk is scoped by extension rather than by path. Three seed hooks, `tasks-index.sh`, `memory-index.sh`, and `standards-audit.sh`, call the CLI deliberately and each reports by name when the binary is absent, so they keep the dependency and the extension scope leaves them outside the walk with no exemption list to maintain against them. `standards-audit.sh` reports that nothing was checked rather than passing when its binary is absent, an absent runner leaving a check without one rather than an index gone stale, and it answers an empty record the same way, since the audit refuses outside a git repository.

Discovery runs through `collect_seed_roots` in `scripts/lib/tooling.sh`, shared with the Seed standards stage, so a stack seeding `.claude/` later is covered with no edit to either caller.

Three outcomes separate a clean walk from one that measured nothing, matching `check-plugin-boundary.sh` on the last two. A missing `tooling/` exits 1, since the walk covers nothing. Roots that resolve and carry no markdown between them exits 1 for the same reason, because a pass there says the seeds cite no CLI on the strength of having read no prose. No seed root carrying `.claude/` exits 0 and says so, because the Seed standards stage already reads that one condition as a skip.

`internal/rules/claude/596-claude-md.md` carries the matching authoring rule, so a session editing the seed meets it at the edit rather than at the push. Its glob stays on the two `CLAUDE.md` paths rather than widening to every seed markdown, since the three bullets beside it govern the root-and-seed pair and mean nothing over `canon/REQUIREMENTS.md`. The stage is what covers the rest of the seed tree.

### A seed gates harder than a context entry

The same finding fails a push against `tooling/*/seeds/` and only reports against `canon/context/`. The corpus moves it rather than the measure: a seed is authored once and installed into every scaffolded project, so a defect there propagates, while a context entry is edited by the people who own it and a threshold failing their push teaches them to route around the stage. Widening the `paths` globs on the claude rules was the alternative, and it is only a nudge, since a rule loads only when a session opens the file. Gating a measure with a known false-positive class forces an escape hatch, so `stub: true` exempts a seed and both install paths strip it before a target sees it.

## Architecture record

The Architecture record stage calls `measureArchitecture` in-process and fails when `canon/ARCHITECTURE.md` holds more decisions than the entry cap it states or runs past the line ceiling its own allowances derive. Both limits are the record's own clauses, so a project whose record states neither passes, and a project with no record passes and says so.

It exists because the Context citations stage runs `--citations-only`, which never opens the record, so the line ceiling `canon context audit` already gated on went unenforced by `bun run check` until this stage read it directly. The count is by `###` heading outside a fence, so a heading carrying two decisions counts once, which is the undercount a writer at the cap is asked not to exploit by merging rather than packing.

## Standard success criteria

The Standard success criteria stage runs `bun src/cli.ts standards audit --arrivals-only`, which fails a push when a standard new to the branch carries no `## Success criterion` section. It is scoped to arrival rather than to the corpus, since `standards/standard.md` forbids writing the section into an existing standard outside the change that exercises it, and a gate over the corpus would fail every push until someone closed all 26 known gaps at once, which is the sweep that rule exists to prevent.

`--arrivals-only` prints nothing when every arriving standard carries the section, matching the Skill requirements stage's own silent-pass shape one domain over. The bare `canon standards audit` a session runs by hand instead reports the whole corpus, so the same verb serves the gate and the reader without a second command to keep in sync.

## Shipped references

The Shipped references stage reads `referencesIn` from `src/shipped/references.ts` over the seven corpora a target reader reaches, which is the package's `files` field less `src` and less the two trees that field already negates. It fails a push on a bare pull request number, a bare commit sha, either form qualified against this repository's own name, a `docs/`-relative path that resolves against this checkout, a phase-label-shaped token, or a numbered rule path, since a reader holding a plugin cache rather than this repository resolves the first against their own tree and reaches something else, resolves the second nowhere at all, resolves the third exactly as badly as the bare form it qualifies, holds neither the fourth's file nor any board to resolve the fifth against, and reaches the sixth's rule only through a separate `canon gov sync`, and only where governance was installed at all.

The docs-path pattern gates on resolution rather than on shape, because shape alone cannot tell a citation of this repository's own reference corpus from an illustration naming a target's own tree: `docs/agents/tasks.md` and `docs/retry.md` are the same token to a pattern with no filesystem behind it. Resolving each match against the checkout root is what separates the two. `root` is a required argument on `referencesIn` rather than a defaulted one, since a caller that dropped it would silently report zero docs-path findings rather than fail to typecheck. `canon/context/` takes no equivalent pattern, since resolution cannot separate `canon/context/index.md`, which every scaffolded project holds, from `canon/context/indexes.md`, this repository's own domain entry. Both resolve and only the second is a defect, which is a semantic read the rule and the review checklist carry instead.

The standards-path pattern is scoped to one corpus, `claude/skills/`, rather than reaching the other six the stage otherwise walks together. `598-authoring-layout.md` fixes `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` as the form that resolves off the `claude/standards` symlink in every plugin cache, so a bare `standards/<name>.md` citation is the defect there and nowhere else: `docs/agents/` and `docs/workflow/` carry the identical bare shape correctly, since a docs page resolves from this checkout's own root with no skill context to route through. `REQUIREMENT.md` stays out of the scope even there, since a maintainer or an audit command reads that file rather than a session loading it, so the resolver rule has no reader to fail for.

The rule-path pattern shares the standards-path pattern's scope and reasoning rather than carrying its own: `claude/skills/` excluding `REQUIREMENT.md`, and a bare match reports whether or not the named rule exists, since a same-repository citation under this corpus names no target project's own tree the way a `docs/` path can. `598-authoring-layout.md` fixes the reason a shipped skill body may not cite `.claude/rules/canon/core/055-scratch.md` or any other numbered rule path as authority for its own behavior: the rule reaches a target only through a separate `canon gov sync`, and only where governance was installed at all, which is a narrower and slower delivery path than the plugin merge that ships the citing skill. The pattern anchors on the trailing `\d{3}-[\w-]+\.md` rather than on the bare `.claude/rules/` prefix, which is what lets a folder mention carrying no number, such as `create-rule` and `setup-gov` already write correctly, pass untouched.

The phase-label pattern gates on shape alone, the same way the pull-request and commit-sha patterns do, since a target holds no board against which a resolution check could run. It does not reuse `VERSION_TOKEN` from `src/labels/phase.ts`, which admits one or two decimal groups so it can also catch a three-group semver tag in a release pull request's generated body. This reader has no release-please signal to sort by, so it requires exactly two numeric groups with a negative lookahead rejecting a third, which is what every phase label this board issues carries and every semver tag does not.

The corpus stops short of `src/` on the reader rather than on the shipping. A `src/` doc comment lands on a target's disk and nothing serves it to a target reader, so its every number resolves for the person actually reading it. That boundary is also what keeps the check a prose pattern instead of a parser, since `src/design/` writes values shaped `#191512` and no width or boundary rule separates an all-digit hex color from a pull request number.

Both patterns exclude the repair form by construction rather than by exemption. A lookbehind rejecting a word character before `#` never matches `owner/repo#123`, and the sha pattern rejects `@` and `/` in the same position so `owner/repo@abc1234` passes the check that asked for it. A trailing boundary rejects a hex color reading as a pull request number too, such as `bg-[#316ff6]`, which would otherwise read as pull request 316.

It gates rather than reports, since a report leaves a citation for a person to notice rather than for a push to catch. The stage emits every hit before returning its failure, since a stage halts the run on its first failing check and a branch carrying several would otherwise repair one.

The walk passes `dot: true`, which is what reaches the seeds. `Bun.Glob` skips any path carrying a dotted segment by default, and every seeded `.claude/` tree, `.cspell/` list, and `.husky/` hook under `tooling/` sits behind one, so the default scan would walk `tooling/` and return none of the files a scaffolded project receives.

It does not follow `claude/standards` and `claude/snippets`, since both trees are corpora here in their own right, and following the symlinks would read those two twice and report every finding in them under two paths.

The commit-sha pattern reads 7 to 40 contiguous hex characters with no narrower width check, so a URL-encoded hex color inside shipped prose can collide with it. `%23e0724b`, the percent-encoding of `#e0724b`, decodes to a `#` the check does not see and eight trailing hex characters it reads as a short sha. A data URI naming a fill color in shipped skill prose avoids the collision by writing the color as `rgb(224,114,75)` rather than a hex literal.

The marker mutes a line and nothing narrower, because `isMarked` reads the line itself and the one above and stops there. Twenty-one lines carry it: examples illustrating the `#123` spelling in `standards/publish.md`, the `verified` field format in `standards/diagrams.md` and in `draft-diagram`, a copyable `canon claude skills drift` invocation in `docs/agents/skills-audit.md` whose argument has to be a literal git ref, two same-repository citations in `docs/agents/context-audit-checks.md` and `docs/agents/key-changes.md`, and a phase label's own format illustrated across `docs/agents/tasks.md`, `standards/tasks.md`, `standards/versioning.md`, and `claude/skills/task-board/SKILL.md`. One of the twenty-one was never authored as an exemption at all: `standards/publish.md` states the convention on its own line, so the token sits inside a code span as documentation of the format, and `isMarked` reads a code span exactly as it reads a comment, which arms the marker over that line and the line below it with nothing anywhere naming them as exempt.

A real citation later added beside any of the twenty-one ships unreported.

## Raw-field file references

The Raw-field file references stage walks the same seven corpora as Shipped references through the same file list, and fails a push on a `gh api` raw-string flag carrying a file reference. `-f body=@<path>` posts the literal path as the field value, so a comment edited that way is overwritten with the path and loses the marker a later read resolves it by. `-F` is the flag that reads the file, and the defect reached a shipped skill body twice before a gate existed.

The pattern is `(?:^|\s)(?:-f|--raw-field)[ =]\S+=@`, which needs the `=@` and so passes `-F`, `--field`, and a raw string such as `-f body="text"`, the last being what `scripts/sandbox/git/followup.sh` posts on purpose. It needs no judgment, since a raw-string flag followed by an `@` file reference has no correct reading. The stage stands apart from Shipped references because its verdict is a flag spelling rather than an unresolvable reference, and it scans prose, so a body quoting the wrong spelling to explain it fails and gets reworded rather than exempted.

## Audit set

The Audit set stage runs `canon audits run --corpus tracked --corpus per-machine --json` and reports. It is the one stage here that reads a measure and fails nothing, which is deliberate: the three findings the audits treat as facts already fail the push at their own stages above, and those name a specific remedy an aggregate line cannot. What this stage adds is the judgment half of every tracked and per-machine audit and the growth against `canon/config/baseline.json`.

### The upstream corpus runs on its own schedule

`deps`, the one audit reading `bun audit --json` against the upstream advisory index, carries `corpus: 'upstream'` in `src/audits/catalog.ts` and runs apart from the other corpora here. Its own wall time would otherwise dominate the gate's cost: three consecutive clean runs measured 44.7, 77.6, and 62.9 seconds each, against roughly 50 seconds for every other stage in the table combined, and a stalled lookup runs unbounded to bun's own 299-second ceiling. Gating a push on a network read that answers nothing about this tree's own health is the defect a separate schedule avoids.

`canon audits run` takes a repeatable `--corpus <tracked|per-machine|upstream>`, defaulting to every corpus when none is named, and `auditsFor` in `src/audits/run.ts` reads it. `auditSet` in `src/gate/measures.ts` passes `tracked` and `per-machine` alone, so the gate reads only the corpora describing this tree. `canon audits run` with no filter still reads every corpus, including `deps`, for a caller who wants the whole set.

`auditDependencies` in `src/deps/audit.ts` passes an explicit 120-second `timeout` to its `execa` call, bounding a stall well under bun's own ceiling while leaving margin over the slowest clean run measured. A timeout reports through the same `no-record` refusal a malformed record already takes, distinguished only by its message, which names the stall rather than folding it into an empty stderr line.

A published advisory still needs a reader, since nothing else in the repository shells the runtime's own advisory command. `.github/workflows/verify.yml` carries a `dependency-advisories` job on a weekly `schedule` trigger, running `bun src/cli.ts deps audit` on its own, because an advisory is published against the index rather than against a commit and a per-push read tells a contributor nothing a weekly one does not.

### Every stage carries its own wall time

`StageResult` in `src/gate/sequencer.ts` carries `ms`, timed around each stage's checks in `runStage`, and `canon gate run --json` emits it per stage plus a summed `ms` beside `summary`. `AuditResult` in `src/audits/catalog.ts` carries the same field, timed around each spawn in `runAudits`, so `canon audits run --json` says which of its verbs a slow run actually waited on. Neither reading changes what a stage measures, and both exist so a slow gate is attributable to a stage rather than read off a stopwatch held against the whole run.

Growth reports rather than gates, for the reason the ceiling above gates. The standards behind the largest counts set no hard cap, so a rising number is a fact about the corpus and a judgment about whether it matters, and a push failing on a judgment teaches a reader to route around the stage.

The baseline goes stale on `main` itself, so a branch report is not the reading a session wants: a branch inherits whatever growth `main` already carries and the stage attributes all of it to the run in front of the reader. Separating the two means running `bun src/cli.ts audits run` in the main worktree and diffing the two reports, which is the invocation the `auditSet` measure in `src/gate/measures.ts` uses. Reach for the source rather than the binary, since a hand-run `canon audits run` reads whatever version is installed and an older release may carry no `audits` command at all.

A branch touching few files answers the same question without a second checkout. Restore those paths to the base commit with `git checkout <base> -- <paths>`, re-run `bun src/cli.ts audits run`, capture every growth line, then restore the branch with `git checkout HEAD -- <paths>`. Commit the branch's own work first, since the second restore discards anything uncommitted. Compare the captured lines rather than a sampled measure, since naming a couple and inferring the rest says nothing about the ones not covered.

It reads the flat `summary` object of scalars rather than the nested record, which `src/gate/measures.ts` parses directly, so the flat summary is a convenience for whoever reads it by hand rather than the only shape a caller could reach.

### An absent corpus is not a stage failure

Six of the twenty audits read gitignored folders. No fresh clone and no CI run carries one, so a shape counting those as unmeasured printed the same warning on every run a contributor did not make on their own machine. A per-machine corpus refusing because its folder is missing therefore reports as absent, which the stage states and never warns on.

The stage still warns when an audit genuinely did not report, and the aggregate exits 3 there. A tracked tree that cannot be found is a broken checkout rather than an ordinary absence, so the allowance does not reach it.

### What the duplicate walk costs

Three of the twelve verbs run at their own gating stages earlier in the same script, so this stage walks those trees a second time. Measured at 0.8 seconds of wall clock against 4.4 seconds of processor for all twelve together, which is under every other stage here, because the verbs share no state and run concurrently.

Running only the verbs the earlier stages skip was the cheaper shape and it gives up what the aggregate is for. One verdict over the whole set is the product, and a stage measuring a subset reports a health nobody took.

## Gotchas

### A regen-then-assert stage clears one round at a time

The indexes, consumed-copy, and hero gates in `src/gate/stages.ts` regenerate and then assert with `git diff --exit-code` against the index, so a correct regen fails the run until the rewritten files are staged. The gates are sequential and each halts the run, so clearing the indexes stage only reveals the consumed-copy stage behind it, and a change touching several regenerated surfaces at once costs a stage-and-rerun round per surface rather than one. Expecting a single staging to clear the run is what makes the second failure read as a real mismatch.

`bun run check:install` packs and installs from the extracted tarball rather than cloning, so it reads the same working tree the other gates read rather than the last commit. A change staged for one of the regenerated surfaces is visible to `check:install` with no separate commit required first.

The `drift` check in `src/gate/sequencer.ts` pairs the diff with `git ls-files --others --exclude-standard`, so a regen emitting a never-committed file fails rather than passing. The halt this gotcha describes is the sequencer's stop-at-the-first-failure rule, which `src/gate/sequencer.test.ts` pins, so nothing about the round-per-surface cost moved with the sequencing.

The two halves of that pairing report identically. A stage emits the untracked listing and the diff as two captures under one failure line, so a brand-new `docs/workflow/index.md` prints as a bare path that reads as regen drift, and the reader answers it by running the regen again, which writes the same file and fails the same way. Every folder that splits creates one such index, so the shape arrives with the split rather than rarely, and staging is the only thing that clears it.

### The forced staging narrows the next review

`review-branch` Step 2 uses `git diff --staged` as its scope whenever that is non-empty, so a review fired after a check reads only the regeneration. A branch can end up with a staged set of a few regenerated files while carrying many more, including every `src/` file the run existed to review, and both behaviors are documented and correct on their own, so nothing reports the gap. It compounds when the base equals HEAD, which is every autoship run before its first commit. Check whether the staged set matches the branch before invoking a review, and say which scope was read.

### A fence is exempt from the prose gate and not from the spell gate

The prose-standards hook treats a fenced code block as exempt and `bun run check:spell` does not, so an invented short identifier inside a mermaid fence can pass every prose gate and still fail the check that blocks the commit. `standards/mermaid.md` names the fence exemption for the prose hook while saying nothing about the spell stage, so the exemption reads wider than it is. Spell participant aliases and node ids as whole words, and check punctuation bans inside labels by hand, since nothing checks them there. The two gates are the `Markdown bans` and `Spelling` stages in `src/gate/stages.ts`, which sit apart and read different corpora, so no reordering closes the gap between them.

### A write grant has to agree with the formatter

Any tool granted write access to a format-checked file has to agree with the formatter, and a release configuration's `extra-files` mechanism is that kind of grant. `release-please` bumps the version in `claude/.claude-plugin/plugin.json` and re-serializes the whole file, expanding `keywords` to one string per line, while prettier collapses any array fitting the print width, so an automated version bump can land a file that fails `bun run check` at every future release unless the two are checked against each other first. Run the tool and the formatter over the same content and diff the two before wiring the grant. A real file with a fixed name takes a formatter ignore entry, unlike sample content, which takes a suffix. Which side of the gate catches it depends on the grant rather than on the sequencing: the write stage would rewrite the file on a contributor's machine and the check stage fails the push, and both are entries in `src/gate/stages.ts` selected by the write grant rather than two branches inside one stage.

### A marker built on `isMarked` reaches only its own line and the one above

`isMarked` in `src/exempt-marker.ts` reads a citation's own line and the line directly above it, and stops there. A multi-line comment that states the marker on its first line and then repeats the pattern the marker exempts on a later continuation line, such as a second `README.md:NN`-shaped token inside a `readmeCitationsIn` anchor comment (`src/web/readme-citations.ts`), reads as unmarked on that later line, since the marker sits neither on it nor directly above it. A marker-based exemption built on `isMarked` keeps every occurrence of the pattern it exempts on the marker's own line or the line immediately above, never spread across a longer explanatory comment block.
