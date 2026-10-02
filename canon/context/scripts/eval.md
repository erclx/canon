---
title: Eval records
description: What each arm measured, the ablation findings, the frozen records a run left, and the limits the results report past
---

# Eval records

`scripts/eval/` holds the records of a test that asked whether a session that has never seen an artifact can author a conforming one from that artifact alone. The runner was deleted on 2026-10-01 along with its fixture archive, and both are restorable from git history. Nothing dispatches to the folder now, so it carries evidence and no behavior.

A run spent real money, and authorizing that spend was the operator's call while performing the run was not. A restored runner keeps that split.

## What an arm measured

An arm measured spec quality rather than efficacy: whether the artifact communicates its own central rule, and nothing about whether what it produces is useful. No baseline arm and a sample of one were correct for that question, because failure is self-evident. A session that reads the standard and still writes the wrong shape has proved the standard failed to communicate.

The accepted weakness is that the test confirmed twice and discriminated zero times, so a pass is weak evidence until one arm fails. The context and wireframes results are not parity either. The context arm ran with its criterion already present, so it measured the standard as it shipped. The wireframes arm ran before its criterion existed, so it measured the shape rules alone.

Sufficiency and necessity need different arms. The original arms asked whether an artifact carries a session through a task, and no arrangement of them says whether a given line does work. An ablation answered the second by running one prompt twice, against the seed as shipped and against the seed with one section's lines removed. Both halves were labeled `<section>-kept` and `<section>-cut` rather than pairing a cut against the bare arm, since the bare arm carries a different prompt and the pairing would vary the prompt and the artifact at once.

An ablation half recorded its `Kind` as `ablation`. `Verdict` meant whether the artifact conformed under `findings` and `regression`, and whether the pair discriminated under `ablation`, so the two had to be counted separately.

## The frozen records

`pre-registration.md` and each `result-*.md` are frozen evidence rather than maintained prose. Each opens with a banner refusing edits, the result document over its machine-derived blocks and its first-person text, and the pre-registration over what it fixed as a hit before either run. A repository-wide sweep excludes them, and a path inside one that no longer resolves is the record doing its job rather than drift to repair.

The three results do not carry banners of equal strength, so a sweep cannot exclude them as one class. `result-context.md` and `result-wireframes.md` refuse every edit outright. `result-seed.md` refuses edits to its quoted and machine-derived blocks alone and states that the operator-written judgment sections after them follow prose standards, which puts those sections inside a prose sweep. Rewrite the wording in those sections and leave every path they name at the spelling the run date carried. Read the banner per file before excluding one.

`ledger.md` took one appended row per run, and its table stays last in the file. Raw transcripts landed in `.canon/tmp/runs/eval/`, were never committed, and were promoted into a result document by hand when they became evidence for a claim. Rows whose `Subject` commit an ablation pair regenerated from carry a pushed tag under `eval/`, which survives a branch cleanup that would orphan the commit.

## Limits

### The snapshot blind spot

A harness that reports writes by diffing one directory cannot see a write outside it, and both harnesses here have that shape. The eval fixture was compared by before-and-after hash, and a cut half of the memory ablation could write into `~/.claude/projects/<fixture>/memory/` while the run reported no files changed, which is true of the fixture and false of the machine. The sandbox harness reports `write_scope` from a manifest diff over its sandbox tree and carries the same blind spot, recorded in `canon/context/sandbox/isolation.md`. Read the transcript alongside the file list in either, and clear the stray path afterward.

## Findings that outlive the runner

### A fixture under the project root inherits its instructions

A fixture a headless or subagent run is pointed at has to live outside the repository under `mktemp -d`, because a session started anywhere beneath the project root loads that project's `CLAUDE.md`, `.claude/rules/`, and `canon/context/` through the ancestor chain. A fixture under `.canon/tmp/runs/groundwork-fixtures/<slug>/` would put a headless arm there measuring this repository rather than the arm. Split fixture paths by who reads them: one the current session provisions and reads itself can sit in-repo, and anything an independent agent run is pointed at goes outside.

### A format spec is not an instruction

A coverage audit reading a standard can mistake documenting the shape of X for instructing X, and the two are indistinguishable in a grep. `standards/tasks.md` covers the `Plan:` link, the `../plans/` path, and the archive destination in full, which predicted the Tasks ablation as a null, and both pairs falsify that. The cut halves create no plan at all, since the standard only specifies a pointer's format while the seed bullets carry the instruction to create one.

### An unrelated arm is a control

When every arm in a batch emits the same observable, the arms testing something else are a free control group for how often the rule gets followed anyway. The Output pair looked like clean discrimination until the other three pairs were read for the same behavior. With the section present the canonical grouping appeared 8 times in 10, so a 2-in-10 miss rate already existed and two cut observations could not carry a verdict alone. Count the same observable across every arm that left the rule intact and report that base rate beside the difference.
