---
title: Eval harness
description: Arms and what each measures, the ablation strip, the two records a run leaves, and the limits a run cannot report past
---

# Eval harness

`scripts/eval/` asks whether a session that has never seen an artifact can author a conforming one from that artifact alone. It is not a verb and nothing dispatches to it, so it is invoked by path.

That stays true by decision, and the decision covers the spend rather than the driving. A run spends real money and authorizing that is the operator's, while performing the run is not: `run.sh` spawns its own headless `claude -p` session against a fixture extracted outside this repository, so any session holding a shell drives an arm once the spend is authorized. The one thing that still sends a run back to a person is a permission classifier in the calling session refusing the nested spawn, which an agent hands back rather than routes around.

A research harness lives beside the domain it measures only while it measures one. This one sat at `scripts/standards/authoring-test/` because standards were all it tested, and the seed arm made that placement wrong, since a seed is a tooling artifact rather than a standard. It moved to `scripts/eval/` while three files referenced it rather than waiting for the next arm to make the move expensive.

## What an arm measures

An arm measures spec quality rather than efficacy: whether the artifact communicates its own central rule, and nothing about whether what it produces is useful. No baseline arm and a sample of one are correct for that question, because failure is self-evident, since a session that reads the standard and still writes the wrong shape has proved the standard failed to communicate. The accepted weakness is that the harness has confirmed twice and discriminated zero times, so a pass is weak evidence until one arm fails.

Sufficiency and necessity need different arms. The original arms ask whether an artifact carries a session through a task, and no arrangement of them says whether a given line does work. An ablation variant answers the second by running one prompt twice, against the seed as it ships and against the seed with one section's lines removed.

Both halves are labeled `<section>-kept` and `<section>-cut` rather than pairing a cut against the bare arm. The bare arm carries a different prompt, so pairing against it varies the prompt and the artifact at once.

An ablation half records its `Kind` as `ablation`, written by the runner rather than the caller. `Verdict` means whether the artifact conformed under `findings` and `regression`, and whether the pair discriminated under `ablation`, so the two have to be counted separately and `Kind` is the only thing that separates them. A variant that stayed `findings` would silently merge the harness's confirmed-versus-discriminated count with a different question.

## The ablation strip

The strip anchors on each bullet's own text and kills the run when an anchor stops matching exactly one line, since an ordinal is not a stable address here: a bullet list reordered or edited between when an ablation is planned and when it runs leaves an ordinal pointing at the wrong line.

The miss is fatal rather than a warning because a cut half that silently kept its section is identical to its partner in every artifact a run leaves behind. A wrong strip would read as a null result about the section rather than as a broken run.

## What a run records

A run that costs money leaves two records, split by what each costs to keep.

`scripts/eval/ledger.md` takes one appended row per run carrying date, arm, kind, subject commit, cost, turns, verdict, and output path, and is committed. The raw transcript lands in `.canon/tmp/runs/eval/<arm>-<timestamp>/` and is not, because a transcript holds the full text of every file the session read and a hundred retained runs is a repository hundreds of megabytes larger for every clone. The row is the durable record, and a transcript is promoted into the arm's result document by hand on the day it becomes evidence for a claim.

Retention is additive. A failure to write either record warns and the verdict still prints, and a row whose retention failed records its output cell as `none` rather than naming a directory nothing wrote.

`pre-registration.md` and each `result-*.md` are frozen evidence rather than maintained prose. Each opens with a banner refusing edits, the result document over its machine-derived blocks and its first-person text, and the pre-registration over what it fixed as a hit before either run.

Both therefore quote paths, seed bullets, and rules as they stood on the run date. A repository-wide sweep excludes them, and a path inside one that no longer resolves is the record doing its job rather than drift to repair.

The three frozen records do not carry banners of equal strength, so a sweep cannot exclude them as one class. `result-context.md` and `result-wireframes.md` refuse every edit outright. `result-seed.md` refuses edits to its quoted and machine-derived blocks alone and states that the operator-written judgment sections after them do follow prose standards, which puts those sections inside a prose sweep rather than outside it. Read the banner per file before excluding one.

A prose sweep and a path sweep reach those judgment sections differently, and the banner separates the two by what it governs rather than by which section it covers. Prose standards decide how a sentence is worded, while the paths it names are evidence of what the run opened. `result-seed.md` cites the install stamp twice outside its fenced blocks, once naming which seed files were read and once scoring the row that read them, so a rename sweep rewriting either leaves the judgment disagreeing with the block above it. Rewrite the wording in those sections and leave every path they name at the spelling the run date carried.

### The `Subject` column

A `Subject` commit an ablation pair regenerates from gets a pushed tag under `eval/`, and an ordinary run does not. Rows pointing at a commit that lives on one local branch and nothing else are one branch cleanup or one lost disk away from losing the entry point while the content stays committed. A tag survives that deletion, and the `eval/` prefix keeps it clear of the `v*` release tags. `run.sh` does not create the ref itself, so the next ablation can recreate the same state on demand.

The ledger's own path is excluded from the dirty check that builds a row's `Subject`. It is a tracked file the append writes to, so counting it marks every run after the first `-dirty` with nothing under test changed, which corrupts the one column saying which tree a run exercised. An edit that drops the pathspec exclusion breaks the column silently, since the value stays plausible.

### The ledger table

The row is appended with `>>` and anchors on no existing line, so its table has to stay last in `ledger.md`. Prose added below the table lands between the header and the next run's row and breaks the table silently.

## Limits

- Nothing prunes `.canon/tmp/runs/eval/` automatically, which was evaluated and rejected. It is the second uncapped scratch folder after `runs/sandbox/`, and `canon records prune-tmp` is the manual route, reading each as one unit. Clearing either loses every `Output` path the ledger points at, the intended trade rather than a bug.
- `run.sh` is safe serially and not concurrently. Two arms starting in the same second race on the `while [ -e "$run_dir" ]` existence check, and parallel `>>` appends to the ledger can interleave. Parallelism is the obvious fix for wall clock, which is the harness's real cost. Fix both hazards before taking it, since a corrupted ledger is the one record a re-run cannot rebuild.

### The snapshot blind spot

A harness that reports writes by diffing one directory cannot see a write outside it, and both harnesses here have that shape. `scripts/eval/` compares a before-and-after hash of the fixture, and a cut half of the memory ablation can write into `~/.claude/projects/<fixture>/memory/` while the run reports no files changed, which is true of the fixture and false of the machine. The sandbox harness reports `write_scope` from a manifest diff over its sandbox tree and carries the same blind spot rather than a different one, recorded in `canon/context/sandbox/overview.md`. Read the transcript alongside the file list in either, and clear the stray path afterward.

The sandbox picked a boundary, watching the four shared-scratch directories under each toolkit root and naming what it leaves out, so the deciding is done rather than deferred and the eval fixture can copy the shape or state its own.

### A fixture under the project root inherits its instructions

A fixture a headless or subagent run is pointed at has to live outside the repository under `mktemp -d`, because a session started anywhere beneath the project root loads that project's `CLAUDE.md`, `.claude/rules/`, and `canon/context/` through the ancestor chain. A fixture path under `.canon/tmp/runs/groundwork-fixtures/<slug>/` would put a headless arm run there measuring this repository rather than the arm, which is why `scripts/standards/authoring-test/run.sh` extracts to `mktemp -d` instead and states the reason in a comment. Split fixture paths by who reads them: one the current session provisions and reads itself can sit in-repo, and anything an independent agent run is pointed at goes outside.

### A format spec is not an instruction

A coverage audit reading a standard can mistake documenting the shape of X for instructing X, and the two are indistinguishable in a grep. `standards/tasks.md` covers the `Plan:` link, the `../plans/` path, and the archive destination in full, which predicted the Tasks ablation as a null, and both pairs falsify that: the cut halves create no plan at all, since the standard only specifies a pointer's format while the seed bullets carry the instruction to create one.

### An unrelated arm is a control

When every arm in a batch emits the same observable, the arms testing something else are a free control group for how often the rule gets followed anyway. The Output pair looked like clean discrimination until the other three pairs were read for the same behavior: with the section present the canonical grouping appeared 8 times in 10, so a 2-in-10 miss rate already existed and two cut observations could not carry a verdict alone. Count the same observable across every arm that left the rule intact and report that base rate beside the difference.
