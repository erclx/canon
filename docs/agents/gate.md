---
title: Merge gate
description: Running the gate this repository verifies a branch with, what the stage table holds and what stays a script, how the changed set scopes three stages, and why a stage that cannot read its input reports rather than passing
---

# Merge gate

`canon gate run` runs every stage that guards a branch here, in order, stopping at the first stage that finds a fact. `bun run check` and `bun run check:ci` resolve to it, and the `update` package script runs `bun run check` after a dependency update.

```bash
canon gate run
canon gate run --all --no-write
canon gate run --json
```

| Option       | Behavior                                                                      |
| ------------ | ----------------------------------------------------------------------------- |
| `--all`      | Run every stage instead of scoping shell, types, and tests to the changed set |
| `--no-write` | Check formatting instead of applying it, which is what a merge gate wants     |
| `--nested`   | Suppress the outer frame when a calling script has already opened one         |
| `--json`     | Add a machine-readable record on stdout                                       |

## What the command owns and what it runs

Three things sit in the command: the stage table in `src/gate/stages.ts`, the changed-file scoping and the run loop in `src/gate/sequencer.ts`, and every threshold comparison in `src/gate/measures.ts`. Each individual check is the script or the verb it already was, under `scripts/core/` or behind another `canon` command, and the move changed none of them. Sequencing, scoping, and comparison are where the recurring defects were, and a check whose behavior changed while its sequencing moved would make any regression impossible to attribute.

A stage is a list of checks and a check is one of four kinds:

| Kind      | What it is                                                                      |
| --------- | ------------------------------------------------------------------------------- |
| `command` | Any binary, run from the project root                                           |
| `cli`     | This checkout's own `src/cli.ts`, never a globally installed `canon`            |
| `drift`   | A regenerated pathspec asserted against the index and against the untracked set |
| `measure` | A reading whose verdict is a comparison rather than an exit code                |

A `cli` check runs the source rather than the binary because a globally installed `canon` resolves to the main checkout no matter which worktree is running, so a gate reading through it would measure the wrong tree and pass a branch it never opened.

Every check is an argument vector rather than a shell line, so no stage carries a quoting hazard and a `drift` pathspec reaches git exactly as the table spells it.

## Scoping

Shell, types, and tests read the changed set. Everything else always runs, because its input is diffuse enough that no path predicts it.

The changed set unions the branch diff against the merge base with `origin/main`, the working tree, and untracked files, which is what a pull request will contain. The baseline is the remote ref and not local `main`, since on `main` itself the local ref is HEAD and every unpushed commit would drop out. Every fallback widens rather than narrows: no merge base at all runs every stage, and a local baseline equal to HEAD does the same. `--all` turns scoping off outright, which is what `bun run check:ci` passes so CI stays the backstop for a wrong local scoping decision.

## A stage that cannot read its input

A stage reports one of four states. It passed, it was scoped out, it found a fact, or it could not measure its input at all.

The fourth is the one worth naming. An absent tool, a catalog that did not report, a corpus with nothing under it: each used to print a line that read like a pass. Now the run records it as unmeasured, the closing line says how many stages measured nothing, and the reader is not told a verdict nobody took.

What happens next depends on where the run is. On a contributor's machine it warns and the run still exits 0, because an absent tool there is somebody mid-setup. Under CI, read off `CI=true`, it refuses, because the same absence on a runner is a broken workflow step.

## Exit codes

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| `0`  | every stage that ran reported, and none found a fact          |
| `1`  | a stage found a fact, or could not measure its input under CI |

One code for a failure, which is what a `bun run` caller and a git hook both read. An unmeasured stage takes no code of its own, since it has already refused under CI and reports on a contributor's machine, so a second code would name a state no caller branches on.

## The record

`--json` puts one record on stdout and keeps every diagnostic on stderr:

```json
{
  "ok": true,
  "root": "/path/to/checkout",
  "scoped": true,
  "changed": 12,
  "summary": {
    "ran": 23,
    "passed": 22,
    "skipped": 1,
    "unmeasured": 0,
    "failed": 0
  },
  "ms": 44453,
  "stages": [
    { "id": "indexes", "label": "Indexes", "status": "passed", "ms": 210 }
  ]
}
```

A failing stage carries its remedy in `failure`, and the same line goes to stderr so a caller reading neither the record nor the frame is still told what to fix.

`ms` carries the wall time each stage took, including every process spawn, and the top-level `ms` sums them. Neither reading changes what a stage measures. Both exist so a slow run is attributable to a stage rather than read off a stopwatch held against the whole thing.

The Tests stage holds a machine lock so one box runs one suite at a time, and its `ms` includes any time it queued behind another worktree's suite. A stage that queued carries `queuedMs`, the part of `ms` spent waiting, which is how to separate a queue from a slow suite. The field is absent on a stage that never waited. The wait is also announced on stderr when it starts, naming the holder's pid and worktree, in every mode.
