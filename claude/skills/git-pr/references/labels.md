---
title: Label reference
description: Path-to-label map format, prefix matching against the changed set, and the one-time label creation a map requires
---

# Label reference

## Contents

- [Scope](#scope)
- [Map format](#map-format)
- [Paths a map declines to label](#paths-a-map-declines-to-label)
- [Reporting a surface no row reaches](#reporting-a-surface-no-row-reaches)
- [Matching](#matching)
- [Applying](#applying)
- [A label the remote does not carry](#a-label-the-remote-does-not-carry)
- [Release pull requests](#release-pull-requests)
- [Labels at run time](#labels-at-run-time)

## Scope

Governs the labels a pull request carries: the map a project declares, how a changed path resolves to a label, and what a label missing from the remote costs.

Does not govern:

- Pull request title and body: `pr.md`
- Branch naming: `branch.md`
- Issue labels, which `git-issue` derives from the issue type rather than from a diff

## Map format

The map lives at `canon/config/pr-labels.toml` in the project root, or `.claude/canon/pr-labels.toml` for a project that has not moved. Each key under `[domains]` is a label name and its value is the list of path prefixes that earn it.

```toml
[domains]
api = ["services/api/"]
web = ["apps/web/", "packages/ui/"]
```

- A label takes more than one prefix when two folders read as one surface, and a path under two overlapping labels earns both
- Matching is prefix-anchored, so a row written for an authoring root reaches nothing under the copy a project consumes
- A surface living only under a dotted folder carries its own prefix on the row owning its subject
- A folder holding several subjects splits across the rows that own them
- The map is hand-authored, so a surface added later labels nothing until someone adds a row, and `canon labels audit` names it before the merge

## Paths a map declines to label

A path that moves only when a release or a generator rewrites it earns no row. Release automation applies its own label, and a domain label on a generated file gives a mechanical edit a subject it does not have.

Both go under a `[declined]` table keyed by the reason, in the same file and matched by the same prefix rule:

```toml
[declined]
release-managed = ["CHANGELOG.md", "package.json"]
generated = ["build/manifest.json"]
```

- It is a table rather than a comment because the check reads it, separating a decision already taken from a gap nobody has reached
- A path claimed by both a `[domains]` row and a `[declined]` row takes the label, since it already has a subject

## Reporting a surface no row reaches

The audit names every changed path no row reaches.

```bash
canon labels audit --base <base> --json
```

The record carries `labels`, `declined`, and `uncovered`. It exits 2 when `uncovered` has anything in it and 1 when it refuses, with `reason` naming the cause, `no-map` for a project that declared none and a parse or range failure otherwise.

- It reports and never gates, since whether a surface deserves a label is a call only its owner makes
- A push failing on one teaches a contributor to route around the check while the surface stays unchanged
- A prefix reaching no path stays unmeasured, so a row left by a deleted folder stays in the map. That staleness needs a second measure.

## Matching

- Take the changed set from `git diff --name-only <base>...HEAD`, against the same base the body is written from
- The three dots hold whether `<base>` is already a merge base or a bare ref, where two dots would hand the branch somebody else's merged paths
- A path earns a label when the path starts with one of that label's prefixes
- Collect the distinct labels across the whole set, ordered as the map declares them, so two runs over one branch produce one string
- Pass the result as a single comma-separated value. An empty result runs no labelling step.

## Applying

Apply labels after the pull request resolves, never as a field on the create. A create carrying a label the remote lacks either fails whole or creates the label, depending on the surface, and neither is the map's call.

- One step against an existing pull request covers the create and the edit path alike, over REST, so it works where GraphQL is blocked
- The REST endpoint creates any label it is handed, so the step reads each name off the remote first and warns on a missing one

### The apply verb

`canon labels apply <number>` is that step. It resolves the earned set from the pull request's files listing, or from the git range when `--base` is passed, and adds each earned label the pull request lacks.

- It binds only when the pull request's head is the current branch and it is open
- `--check` reports what is owed and writes nothing
- The record carries `number`, `earned`, `present`, `added`, `owed`, `missingOnRemote`, and `uncovered`
- A pull request opened outside this skill, such as by `gh pr create`, takes the same command, since nothing else labels it

### When labelling runs

Labelling runs whenever this skill runs and at no other time, recomputing over the whole branch diff. A push made any other way leaves the labels as the last run left them, so an ordinary branch labels once, when the pull request opens.

- The review return leg pushes through `git-followup`, which refreshes the body without this skill, so commits answering a review reach no labelling
- A follow-up reaching a new surface merges under-labelled, a cost worth paying since a review fix rarely opens a surface the branch had not touched
- The add endpoint never removes, so a hand-applied label stays and a surface the branch has since dropped keeps its label

## A label the remote does not carry

Warn and continue rather than creating it, naming the command in the warning:

```bash
canon labels sync
```

It creates every label the map names that the remote lacks, and never edits or deletes one.

- An installed `canon` predating the verb takes `gh label create <name>` per label instead
- Creating a label writes to the repository settings, and a label created from a map typo is harder to notice than a warning
- So the operator runs the sync on purpose after reading the map, and a run invoked to open a pull request never does

The refusal names the label it rejected and applies none of the set, so an unseen warning leaves the run reading like one that labelled. Surface it beside the result line rather than letting the pull request URL stand alone.

## Release pull requests

Release automation opens its own pull requests without this skill and applies its own labels, so nothing here needs a skip condition for them.

## Labels at run time

The labels step of `git-pr` reads from here. Ask the CLI first:

```bash
canon labels audit --base <base> --json
```

Join the record's `labels`, the set this branch earns, with commas into `pr_labels`, which the final command takes. Report each `uncovered` path beside the result line, naming the map so the reader knows where a row would go, since an uncovered surface merges bare and nothing else says so.

### Reading the reason

Branch on the record rather than on the exit. A shell profile may wrap `canon` in a function whose status comes from a trailing command, and the binary exits 1 for an unknown subcommand and an ordinary refusal alike.

- `no-map` means the project declared no map, so label nothing and warn about nothing, since a set this skill supplied would be a guess
- `unreadable-map`, `no-domains`, `no-base`, `unreadable-changes`, and `bad-base` take the fallback below, with a warning naming the reason
- A map with a typo still has rows a prefix can reach, and reading its refusal as absence would open the pull request bare and silent

### The fallback

Read `canon/config/pr-labels.toml`, or `.claude/canon/pr-labels.toml` when the project has not moved, and match it against the name-only diff per `## Matching`. The fallback labels correctly.

- It also covers no record at all, an installed `canon` predating the verb, since a skill reaches a target on merge and the CLI only on release
- Both spellings matter here, since the binary old enough to need the fallback may predate the move too
- It reports an uncovered path only when `canon labels audit` answered, passing that record's `uncovered` as `pr_uncovered`
- Leave `pr_labels` empty when no map resolves or no prefix matches, which skips the labelling command
