---
title: Overview
description: What sequences the gate stages, the four check kinds, the unmeasured status, the report-only Audit set stage and its upstream corpus, and the gotchas of a regenerate-then-assert run
---

# Overview

## Overview

Owns the stages that read a measure and fail a push on it rather than regenerating anything, plus the Audit set stage, which reads a measure and reports. Each states what it does when its input is missing, since a stage that skips quietly reports the pass it exists to withhold. The stages that regenerate an artifact sit in `canon/context/development/regeneration.md`, and how `bun run check` scopes a run sits in `canon/context/development/verification.md`.

## Layout

- `src/gate/` owns the stage table, the changed-file scoping and run loop, and every threshold comparison
- `scripts/core/` owns the checks that stay scripts, such as the skill-path and seed-independence walks

`canon/context/development/gates/content-stages.md` covers the stages reading what a file says, and `canon/context/development/gates/catalog-stages.md` the stages reading a catalog or a count.

## Decisions

### What sequences them

`bun run check` resolves to `canon gate run` and `bun run check:ci` to `canon gate run --all --no-write`. Three things live in `src/gate/`: the stage table in `stages.ts`, the changed-file scoping and the run loop in `sequencer.ts`, and every threshold comparison in `measures.ts`.

Three properties are load-bearing and each has a case in `src/gate/sequencer.test.ts`. Stages run in table order. A stage that finds a fact halts the run, which is what makes a regenerate-then-assert run reveal one surface at a time. A scoped stage that the changed set carries nothing for says so rather than printing a clean line.

A stage is a list of checks, and a check is one of four kinds:

- `command` runs any binary
- `cli` runs this checkout's own `src/cli.ts`, since a globally installed `canon` resolves to the main checkout whatever worktree is running
- `drift` regenerates nothing and asserts a pathspec against the index and the untracked set
- `measure` is a reading whose verdict is a comparison rather than an exit code

Skill paths and Seed independence stay `command` checks, since a script that exits non-zero on a finding needs no comparison around it. Every check is an argument vector rather than a shell string, so no stage runs through `eval` and no check is a quoting question. What that closes is stated under `## Quoting a pathspec changes what it matches` in `canon/context/scripts/core.md`.

### A stage that cannot measure its input reports rather than passing

An unmeasured stage is a status of its own, distinct from pass and fail. On a contributor's machine it warns, the run still exits 0, and the closing line names how many stages measured nothing instead of printing an unqualified pass. Under CI it refuses, because an absent tool on a runner is a broken workflow step rather than somebody mid-setup.

The split is the sequencer's rather than each measure's. A measure returns the reason it could not read its input and never decides what happens next, so the rule is written once and no stage can disagree with it.

### Every stage carries its own wall time

`StageResult` in `src/gate/sequencer.ts` carries `ms`, timed around each stage's checks in `runStage`, and `canon gate run --json` emits it per stage plus a summed `ms` beside `summary`. `AuditResult` in `src/audits/catalog.ts` carries the same field, timed around each spawn in `runAudits`, so `canon audits run --json` says which of its verbs a slow run actually waited on. Both exist so a slow gate is attributable to a stage rather than read off a stopwatch held against the whole run.

## Audit set

The Audit set stage runs `canon audits run --corpus tracked --corpus per-machine --json` and reports. It is the one stage that reads a measure and fails nothing, which is deliberate: the findings the audits treat as facts already fail the push at their own stages, and those name a specific remedy an aggregate line cannot. What this stage adds is the judgment half of every tracked and per-machine audit and the growth against `canon/config/baseline.json`.

Growth reports rather than gates. The standards behind the largest counts set no hard cap, so a rising number is a fact about the corpus and a judgment about whether it matters, and a push failing on a judgment teaches a reader to route around the stage. The stage reads the flat `summary` object of scalars, which `src/gate/measures.ts` parses directly, so the nested record is for whoever reads it by hand.

Several verbs also run at their own gating stages earlier in the same script, so this stage walks those trees a second time. The verbs share no state and run concurrently, so the duplicate walk costs under a second of wall clock. Running only the verbs the earlier stages skip was the cheaper shape and it gives up what the aggregate is for: one verdict over the whole set is the product, and a stage measuring a subset reports a health nobody took.

### The upstream corpus runs on its own schedule

`deps`, the one audit reading `bun audit --json` against the upstream advisory index, carries `corpus: 'upstream'` in `src/audits/catalog.ts` and runs apart from the other corpora. Its wall time would otherwise dominate the gate's cost: three consecutive clean runs measured 44.7, 77.6, and 62.9 seconds each, against roughly 50 seconds for every other stage combined, and a stalled lookup runs unbounded to bun's own 299-second ceiling. Gating a push on a network read that answers nothing about this tree's own health is the defect a separate schedule avoids.

`canon audits run` takes a repeatable `--corpus <tracked|per-machine|upstream>`, defaulting to every corpus when none is named, and `auditsFor` in `src/audits/run.ts` reads it. `auditSet` in `src/gate/measures.ts` passes `tracked` and `per-machine` alone, so the gate reads only the corpora describing this tree.

`auditDependencies` in `src/deps/audit.ts` passes an explicit 120-second `timeout` to its `execa` call, bounding a stall well under bun's own ceiling while leaving margin over the slowest clean run. A timeout reports through the same `no-record` refusal a malformed record takes, distinguished only by its message, which names the stall rather than folding it into an empty stderr line.

A published advisory still needs a reader, since nothing else in the repository shells the runtime's own advisory command. `.github/workflows/verify.yml` carries a `dependency-advisories` job on a weekly `schedule` trigger, running `bun src/cli.ts deps audit` on its own, because an advisory is published against the index rather than against a commit and a per-push read tells a contributor nothing a weekly one does not.

### An absent corpus is not a stage failure

Several audits read gitignored folders, and no fresh clone or CI run carries one. A per-machine corpus refusing because its folder is missing therefore reports as absent, which the stage states and never warns on. The stage still warns when an audit genuinely did not report, and the aggregate exits 3 there. A tracked tree that cannot be found is a broken checkout rather than an ordinary absence, so the allowance does not reach it.

### Separating a branch's growth from main's

The baseline goes stale on `main` itself, so a branch report is not the reading a session wants: a branch inherits whatever growth `main` already carries and the stage attributes all of it to the run in front of the reader. Separating the two means running `bun src/cli.ts audits run` in the main worktree and diffing the two reports. Reach for the source rather than the binary, since a hand-run `canon audits run` reads whatever version is installed.

A branch touching few files answers the same question without a second checkout. Restore those paths to the base commit with `git checkout <base> -- <paths>`, re-run `bun src/cli.ts audits run`, capture every growth line, then restore the branch with `git checkout HEAD -- <paths>`. Commit the branch's own work first, since the second restore discards anything uncommitted. Compare the captured lines rather than a sampled measure.

## Gotchas

### A regen-then-assert stage clears one surface at a time

The indexes and consumed-copy gates in `src/gate/stages.ts` regenerate and then assert with `git diff --exit-code` against the index, so a correct regen fails the run until the rewritten files are staged. The gates are sequential and each halts the run, so clearing the indexes stage only reveals the consumed-copy stage behind it, and a change touching several regenerated surfaces at once costs a stage-and-rerun cycle per surface rather than one. Expecting a single staging to clear the run is what makes the second failure read as a real mismatch.

The `drift` check pairs the diff with `git ls-files --others --exclude-standard`, so a regen emitting a never-committed file fails rather than passing. A stage emits the untracked listing and the diff as two captures under one failure line, so a brand-new `index.md` prints as a bare path that reads as regen drift, and the reader answers it by running the regen again, which writes the same file and fails the same way. Every folder that splits creates one such index, and staging is the only thing that clears it.

`bun run check:install` packs and installs from the extracted tarball rather than cloning, so it reads the same working tree the other gates read. A change staged for one of the regenerated surfaces is visible to it with no separate commit required first.

### The forced staging narrows the next review

`review-branch` Step 2 uses `git diff --staged` as its scope whenever that is non-empty, so a review fired after a check reads only the regeneration. A branch can end up with a staged set of a few regenerated files while carrying many more, including every `src/` file the run existed to review, and both behaviors are documented and correct on their own, so nothing reports the gap. It compounds when the base equals HEAD, which is every autoship run before its first commit. Check whether the staged set matches the branch before invoking a review, and say which scope was read.

### A fence is exempt from the prose gate and not from the spell gate

The prose-standards hook treats a fenced code block as exempt and `bun run check:spell` does not, so an invented short identifier inside a mermaid fence can pass every prose gate and still fail the check that blocks the commit. `standards/mermaid.md` names the fence exemption for the prose hook while saying nothing about the spell stage, so the exemption reads wider than it is. Spell participant aliases and node ids as whole words, and check punctuation bans inside labels by hand. The `Markdown bans` and `Spelling` stages read different corpora, so no reordering closes the gap between them.

### A write grant has to agree with the formatter

Any tool granted write access to a format-checked file has to agree with the formatter, and a release configuration's `extra-files` mechanism is that kind of grant. `release-please` bumps the version in `claude/.claude-plugin/plugin.json` and re-serializes the whole file, expanding `keywords` to one string per line, while prettier collapses any array fitting the print width, so an automated version bump can land a file that fails `bun run check` at every future release. Run the tool and the formatter over the same content and diff the two before wiring the grant. A real file with a fixed name takes a formatter ignore entry, unlike sample content, which takes a suffix.

### A marker built on `isMarked` reaches only its own line and the one above

`isMarked` in `src/exempt-marker.ts` reads a citation's own line and the line directly above it, and stops there. A multi-line comment that states the marker on its first line and repeats the exempted pattern on a later continuation line, such as a second `README.md:NN`-shaped token inside a `readmeCitationsIn` anchor comment in `src/web/readme-citations.ts`, reads as unmarked on that later line. Keep every occurrence of an exempted pattern on the marker's own line or the line immediately above.
