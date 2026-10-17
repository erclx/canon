---
title: Eval records
description: What each arm measured, the ablation findings, the frozen records a run left, and the limits the results report past
---

# Eval records

`scripts/eval/` holds the records of a test that asked whether a session that has never seen an artifact can author a conforming one from that artifact alone. The runner was deleted on 2026-10-01 with its fixture archive and is restorable from git history, so the folder carries evidence and no behavior.

A run spent real money. Authorizing that spend was the operator's call and performing the run was not, and a restored runner keeps that split.

## Decisions

### What an arm measured

An arm measured spec quality rather than efficacy, meaning whether the artifact communicates its own central rule. No baseline arm and a sample of one were correct for that question, since a session that reads the standard and still writes the wrong shape has proved the standard failed to communicate.

- The test confirmed twice and discriminated zero times, so a pass is weak evidence until one arm fails
- The context arm ran with its criterion present and measured the standard as shipped. The wireframes arm ran before its criterion existed and measured the shape rules alone.
- An ablation ran one prompt twice, against the seed as shipped and against the seed with one section removed, because sufficiency and necessity need different arms
- Halves are labeled `<section>-kept` and `<section>-cut`, since pairing a cut against the bare arm would vary the prompt and the artifact at once
- An ablation half records `Kind` as `ablation`. `Verdict` means conformance under `findings` and `regression` and discrimination under `ablation`, so count them separately.

### The frozen records

`pre-registration.md` and each `result-*.md` are frozen evidence. Each opens with a banner refusing edits, so a repository-wide sweep excludes them and a path inside one that no longer resolves is the record doing its job.

- `result-context.md` and `result-wireframes.md` refuse every edit
- `result-seed.md` refuses edits to its quoted and machine-derived blocks only, so rewrite the wording of its judgment sections and leave each path as spelled at the run date
- Read the banner per file before excluding one, since the three do not carry equal strength

`ledger.md` took one appended row per run, with its table last in the file. Raw transcripts landed in `.canon/tmp/runs/eval/` uncommitted and were promoted into a result by hand.

Rows whose `Subject` commit an ablation pair regenerated from carry a pushed `eval/` tag, which survives a branch cleanup that would orphan the commit.

### Finding: a fixture under the project root inherits its instructions

A fixture a headless or subagent run is pointed at lives outside the repository under `mktemp -d`. A session started anywhere beneath the project root loads that project's `CLAUDE.md`, `.claude/rules/`, and `canon/context/` through the ancestor chain, so an in-repo fixture measures this repository rather than the arm.

A fixture the current session provisions and reads itself can sit in-repo. Anything an independent agent run is pointed at goes outside.

### Finding: a format spec is not an instruction

A coverage audit can mistake documenting the shape of X for instructing X, and a grep cannot tell them apart. `claude/skills/task-board/references/tasks.md` covers the `Plan:` link and path in full, which predicted a null for the Tasks ablation.

Both pairs falsified that, since the cut halves create no plan at all. The standard only specifies a pointer's format and the seed bullets carry the instruction to create one.

### Finding: an unrelated arm is a control

When every arm in a batch emits the same observable, the arms testing something else are a free control for how often the rule is followed anyway.

The Output pair looked like discrimination until the other pairs were read. With the section present the grouping appeared 8 times in 10, so a 2-in-10 miss rate already existed and two cut observations could not carry a verdict. Count the same observable across every arm that left the rule intact and report that base rate beside the difference.

## Gotchas

### The snapshot blind spot

A harness that reports writes by diffing one directory cannot see a write outside it, and both harnesses here have that shape. A cut half of the memory ablation could write into the fixture's folder under `~/.claude/projects/<fixture>/memory/` while the run reported no files changed, which is true of the fixture and false of the machine.

The sandbox harness reports `write_scope` from a manifest diff over its tree and shares the blind spot, a write outside the diffed tree. Read the transcript beside the file list in either, and clear the stray path afterward.
