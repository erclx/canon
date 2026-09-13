---
title: Label coverage
description: Reading a changed set against the pull request label map, the two tables it matches, how a gap is separated from a decision, and why an absent map is an answer
---

# Label coverage

`canon labels audit` resolves the paths a branch changed against the label map a project declares, reports the labels the set earns, and names every path no row reaches. It closes a gap the map's own comment had predicted since the map shipped: nothing detected a surface added after the rows were written, so such a branch merged carrying no label and nobody heard about it.

```bash
canon labels audit
canon labels audit --json
canon labels audit --base origin/main
canon labels audit src/cli.ts docs/index.md --json
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--base <ref>`  | Ref the range runs back to, defaulting to the trunk        |
| `--root <path>` | Repository to read, defaulting to the current directory    |
| `--json`        | Add a machine-readable record on stdout, keeping the frame |

`--base` names the far side of the range rather than the commit the diff runs against. The audit resolves the merge base between `HEAD` and the ref before reading anything, so `--base origin/main` on a branch the trunk has moved past still earns labels for the paths that branch wrote. Reading the ref literally is what once handed a long-open branch the labels for somebody else's merge, and it named those paths as uncovered surfaces on top.

Positional paths replace the range entirely. A caller holding a changed set already passes it rather than paying for a second git read, and the record then omits `base` to say the range was never resolved.

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode.

## The map it reads

The map sits at `canon/config/pr-labels.toml`, falling back to `.claude/canon/pr-labels.toml` for a project that has not moved, and carries two tables. `[domains]` keys a label name to the path prefixes that earn it, and `[declined]` keys a reason to the prefixes that earn no label on purpose.

```toml
[domains]
api = ["services/api/"]
web = ["apps/web/", "packages/ui/"]

[declined]
release-managed = ["CHANGELOG.md", "package.json"]
generated = ["build/manifest.json"]
```

Matching is prefix-anchored, so a row written for an authoring root reaches nothing under the copy a project consumes. A path claimed by rows in both tables takes the label, since it already has a subject and reporting it as deliberately unlabelled would contradict the label the same run applies.

## A gap and a decision are different findings

The verb sorts every changed path into three buckets and keeps two of them apart:

- **Labelled.** At least one `[domains]` row reaches the path. It contributes its label and nothing else.
- **Declined.** A `[declined]` row reaches it. Somebody already decided the path earns no label, so the run names it and moves no exit code.
- **Uncovered.** Neither table reaches it. This is the finding, and it wants either a prefix on the row that owns its subject or a `[declined]` row carrying the reason.

Folding the last two together was the shape this replaced. A report that cannot tell a surface nobody has gotten to from one somebody refused is useful about neither, which is why the declined half moved out of the map's trailing comment and became data the command reads.

## The range it reads

The default range is the branch against the trunk, resolved as the merge base against `origin/main` and then local `main`. The changed set is that base diffed against the working tree, plus untracked files git does not ignore, rather than against `HEAD`.

Reading the working tree is what lets the check run before the branch commits, which is the moment a session adds the surface nobody covered. The set is a superset of `base..HEAD`, so a caller running after the commits still sees the whole branch.

## Exit codes and refusals

| Code | Meaning                                        |
| ---- | ---------------------------------------------- |
| `0`  | every changed path is labelled or declined     |
| `1`  | refused, with `reason` naming the cause        |
| `2`  | at least one changed path is reached by no row |

It reports and never gates. Whether an uncovered surface deserves a label is a judgment only whoever owns that surface can make, and a push failing on one teaches a contributor to route around the check while nothing about the surface has changed.

A project declaring no map refuses with `no-map`, which is an answer rather than a fault. Such a project is labelled silently by design, and treating the absence as a break would make the map mandatory for every target. `canon audits run` reads that one reason as an expected absence and every other refusal as a measure that did not run.

## What it does not measure

A prefix reaching no path is invisible here. A row left behind by a deleted folder stays in the map forever, and this verb has nothing to say about it. That is the map going stale from the other side and a second measure rather than this one.
