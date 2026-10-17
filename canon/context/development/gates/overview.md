---
title: Overview
description: What sequences the gate stages, the four check kinds, the unmeasured status, and the Audit set stage
---

# Overview

## Overview

Owns the stages that read a measure and fail a push on it rather than regenerating anything, plus the report-only Audit set stage. Each states what it does when its input is missing, since a stage that skips quietly reports the pass it exists to withhold.

The stages that regenerate an artifact sit in `canon/context/development/regeneration.md`, and how `bun run check` scopes a run sits in `canon/context/development/verification.md`.

## Layout

`src/gate/` owns the stage table, the changed-file scoping and run loop, and every threshold comparison. `scripts/core/` owns the checks that stay scripts, such as the skill-path and seed-independence walks.

`canon/context/development/gates/content-stages.md` covers the stages reading what a file says, and `canon/context/development/gates/catalog-stages.md` the stages reading a catalog or a count.

## Decisions

### What sequences them

`bun run check` resolves to `canon gate run` and `bun run check:ci` to `canon gate run --all`. The stage table lives in `stages.ts`, the changed-file scoping and run loop in `sequencer.ts`, and every threshold comparison in `measures.ts`.

Three properties are load-bearing, each with a case in `src/gate/sequencer.test.ts`.

- Stages run in table order
- A stage that finds a fact halts the run, which makes a regenerate-then-assert run reveal one surface at a time
- A scoped stage the changed set carries nothing for says so rather than printing a clean line

The Tests stage alone holds a machine lock while it runs, so a gate in one worktree queues behind another worktree's suite rather than running beside it. `canon/context/development/tests.md` carries why.

### The four check kinds

A stage is a list of checks, and every check is an argument vector rather than a shell string, so no stage runs through `eval` and no check is a quoting question. `canon/context/scripts/core.md` covers the pathspec case under "Quoting a pathspec changes what it matches".

- `command` runs any binary
- `cli` runs this checkout's own `src/cli.ts`, since a globally installed `canon` resolves to the main checkout whatever worktree is running
- `drift` regenerates nothing and asserts a pathspec against the index and the untracked set
- `measure` is a reading whose verdict is a comparison rather than an exit code

Skill paths and Seed independence stay `command` checks, since a script that exits non-zero on a finding needs no comparison around it.

### A stage that cannot measure its input reports

An unmeasured stage is a status of its own, distinct from pass and fail. On a contributor's machine it warns, the run exits 0, and the closing line names how many stages measured nothing. Under CI it refuses, because an absent tool on a runner is a broken workflow step.

The split is the sequencer's rather than each measure's. A measure returns the reason it could not read its input and never decides what happens next, so the rule is written once and no stage can disagree with it.

### Every stage carries its wall time

`StageResult` in `src/gate/sequencer.ts` carries `ms`, timed around each stage's checks in `runStage`, and `canon gate run --json` emits it per stage plus a summed `ms` beside `summary`. `AuditResult` in `src/audits/catalog.ts` carries the same field per spawn, so `canon audits run --json` says which verb a slow run waited on.

### Audit set

The Audit set stage runs `canon audits run --corpus tracked --corpus per-machine --json` and reports. It reads a measure and fails nothing, because the findings the audits treat as facts already fail the push at their own stages with a specific remedy an aggregate line cannot give.

- It adds the judgment half of every tracked and per-machine audit and the growth against `canon/config/baseline.json`
- Growth reports rather than gates, since the standards behind the largest counts set no hard cap and a push failing on a judgment teaches a reader to route around the stage
- It reads the flat `summary` object of scalars, which `src/gate/measures.ts` parses directly, so the nested record is for whoever reads it by hand

Several verbs also run at their own gating stages earlier in the script, so this stage walks those trees twice. The verbs share no state and run concurrently, so the duplicate costs under a second. Running only the verbs the earlier stages skip would give up the point of the aggregate, one verdict over the whole set.

### The upstream corpus runs on its own schedule

`deps`, the one audit reading `bun audit --json` against the upstream advisory index, carries `corpus: 'upstream'` in `src/audits/catalog.ts` and runs apart from the others. Gating a push on a network read that says nothing about this tree's health is the defect a separate schedule avoids.

- Three clean runs measured 44.7, 77.6, and 62.9 seconds, against roughly 50 seconds for every other stage combined
- A stalled lookup runs unbounded to bun's own 299-second ceiling, so `auditDependencies` in `src/deps/audit.ts` passes a 120-second `timeout` to `execa`
- A timeout reports through the same `no-record` refusal a malformed record takes, with a message naming the stall
- `.github/workflows/verify.yml` runs `bun src/cli.ts deps audit` weekly in a `dependency-advisories` job, since an advisory is published against the index rather than a commit

`canon audits run` takes a repeatable `--corpus <tracked|per-machine|upstream>`, defaulting to every corpus, and `auditsFor` in `src/audits/run.ts` reads it. `auditSet` in `src/gate/measures.ts` passes `tracked` and `per-machine` alone.

### An absent corpus is not a stage failure

Several audits read gitignored folders that no fresh clone or CI run carries. A per-machine corpus refusing because its folder is missing reports as absent, which the stage states and never warns on.

The stage still warns when an audit genuinely did not report, and the aggregate exits 3 there. A tracked tree that cannot be found is a broken checkout rather than an ordinary absence, so the allowance does not reach it.

### Separating a branch's growth from main's

The baseline goes stale on `main` itself, so the stage attributes all inherited growth to the branch in front of the reader. Run `bun src/cli.ts audits run` in the main worktree and diff the two reports, using the source rather than the binary, which may be an older install.

A branch touching few files answers it without a second checkout.

- Restore those paths with `git checkout <base> -- <paths>`, re-run `bun src/cli.ts audits run`, and capture every growth line
- Commit the branch's own work first, since the restore back with `git checkout HEAD -- <paths>` discards anything uncommitted
- Compare the captured lines rather than a sampled measure

## Gotchas

### A regen-then-assert stage clears one surface at a time

The indexes and consumed-copy gates regenerate and assert with `git diff --exit-code`, so a correct regen fails until the rewritten files are staged. Each gate halts the run, so clearing indexes only reveals the consumed-copy stage, and each regenerated surface costs a stage-and-rerun cycle.

- The `drift` check pairs the diff with `git ls-files --others --exclude-standard`, so a regen emitting a never-committed file fails rather than passing
- The listing and the diff are two captures under one failure line, so a brand-new `index.md` prints as a bare path, and rerunning the regen writes the same file and fails again
- Every folder that splits creates one such index, and staging is the only thing that clears it
- `bun run check:install` packs from the extracted tarball and reads the same working tree, so a change staged for a regenerated surface is visible to it

### A write grant has to agree with the formatter

A tool granted write access to a format-checked file has to agree with the formatter, as a release configuration's `extra-files` does. `release-please` writes `keywords` one string per line in `claude/.claude-plugin/plugin.json`, while oxfmt collapses any array fitting the print width, so a bump can land a file failing `bun run check`.

Run the tool and the formatter over the same content and diff before wiring the grant. A real file with a fixed name takes a formatter ignore entry, and sample content takes a suffix.

### A marker built on `isMarked` reaches two lines

`isMarked` in `src/sweep/exempt-marker.ts` reads a citation's own line and the line directly above it, and stops there. A multi-line comment that repeats the exempted pattern on a later line, such as a second `README.md:NN`-shaped token in a `readmeCitationsIn` anchor comment in `src/web/readme-citations.ts`, reads as unmarked.

Keep every occurrence of an exempted pattern on the marker's own line or the line above.
