---
title: Label reference
description: Path-to-label map format, prefix matching against the changed set, and the one-time label creation a map requires
---

# Label reference

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

A label takes more than one prefix when two folders read as one surface. Two labels may claim overlapping prefixes, and a path under both earns both.

Matching is prefix-anchored, so a row written for an authoring root reaches nothing under the copy a project consumes. A surface living only under a dotted folder carries its own prefix on the row that owns its subject, and a folder holding several subjects rather than one splits across the rows that own them.

The map is authored by hand, so a surface added after it was written labels nothing until someone adds a row. `canon labels audit` is what names that surface before the branch merges.

## Paths a map declines to label

A path that moves only when a release or a generator rewrites it earns no row. Release automation applies its own label, and a domain label on a generated file gives a mechanical edit a subject it does not have.

Both go under a `[declined]` table keyed by the reason, in the same file and matched by the same prefix rule:

```toml
[declined]
release-managed = ["CHANGELOG.md", "package.json"]
generated = ["build/manifest.json"]
```

A table rather than a comment because the check reads it. A path here is a decision already taken and a path under neither table is a gap nobody has gotten to, and a report that could not tell those apart would be useful about neither.

A path claimed by a `[domains]` row and a `[declined]` row takes the label. It already has a subject, so reporting it as deliberately unlabelled would contradict the label the same run applies.

## Reporting a surface no row reaches

```bash
canon labels audit --base <base> --json
```

The record carries `labels`, `declined`, and `uncovered`. It exits 2 when `uncovered` has anything in it and 1 when it refuses, with `reason` naming the cause: `no-map` for a project that declared none, and a parse or range failure otherwise.

It reports and never gates. Whether an uncovered surface deserves a label is a judgment only the person who owns that surface can make, and a push failing on one teaches a contributor to route around the check while nothing about the surface has changed.

What it leaves unmeasured is a prefix reaching no path, so a row left behind by a deleted folder stays in the map. That is the map going stale from the other side and a second measure rather than this one.

## Matching

- Take the changed set from `git diff --name-only <base>...HEAD`, resolved against the same base as the diff the body is written from. The three dots hold whether `<base>` arrives already resolved to a merge base or as a bare ref name, where the two-dot form is correct only in the first case and hands the branch somebody else's merged paths in the second
- A path earns a label when the path starts with one of that label's prefixes
- Collect the distinct labels across the whole set, ordered as the map declares them, so two runs over one branch produce one string
- Pass the result as a single comma-separated value. An empty result runs no labelling step.

## Applying

Apply labels after the pull request resolves, never as a flag on the create. `gh pr create --label` fails whole on a label the remote does not carry, so a name the map got wrong opens no pull request at all and the run stops with the branch pushed and nothing to review. A `gh pr edit --add-label` against a pull request that already exists costs a warning instead, and it is one command across both the create and the edit path rather than two flags that have to stay in step.

Labelling runs whenever this skill runs and at no other time. Nothing else computes the set, so a push made any other way leaves the labels exactly as the last run left them. Any caller invoking this skill again reaches the step again, and it recomputes over the whole branch diff rather than over the new commits.

An ordinary branch therefore labels once, when the pull request opens. The return leg that answers a review hands its push to `git-followup`, which refreshes the body without invoking this skill, so the commits that answer a review reach no labelling step.

A follow-up push reaching a surface the earlier ones did not merges under-labelled, with nothing to report the miss. Keeping the step in one skill is worth that cost, since a review fix lands in the files the review named and rarely opens a surface the branch had not already touched.

`--add-label` adds and never removes. A label a person applied by hand is not this skill's to strip, and a re-run over a branch that has since dropped a surface keeps the label that surface earned.

## A label the remote does not carry

Warn and continue rather than creating it, naming the command in the warning:

```bash
gh label create <name> --description "<text>"
```

Creating a label writes to the repository settings from a run the user invoked to open a pull request, and a label created from a typo in the map is harder to notice than a warning is.

The refusal names the label it rejected and applies none of the set, so a warning that reaches nobody leaves the run reading exactly like one that labelled. Surface it beside the result line rather than letting the pull request URL stand alone.

## Release pull requests

Release automation opens its own pull requests without this skill and applies its own labels, so nothing here needs a skip condition for them.

## Labels at run time

The labels step of `git-pr` reads from here. Ask the CLI first:

```bash
canon labels audit --base <base> --json
```

The record carries `labels`, the set this branch earns, and `uncovered`, the changed paths no row of the map reaches. Join `labels` with commas into `pr_labels`, which the skill's final command takes. Report each `uncovered` path beside the result line, naming the map so the reader knows where a row would go, since a surface nobody covered merges bare and nothing else says so.

Branch on the record rather than on the exit. An operator's shell profile may wrap `canon` in a function whose status comes from a trailing command, and the binary exits 1 for an unknown subcommand and 1 for an ordinary refusal alike.

A `reason` of `no-map` is the answer that the project declared no map, which earns no labels and no warning: a label set this skill supplied would be a guess about that project's surfaces. Stop there and label nothing.

Every other `reason` is a map or a range the verb could not read, which is `unreadable-map`, `no-domains`, `no-base`, and `unreadable-changes`, plus `bad-base` for a ref this skill resolved wrongly. Take the fallback below and warn beside the result line, naming the reason. A map with a typo in it still has rows a prefix match can reach, and reading the refusal as an absence would open the pull request with no labels and nothing said, which is the surface merging bare that the verb exists to name.

The fallback is reading `canon/config/pr-labels.toml`, or `.claude/canon/pr-labels.toml` when the project has not moved, and matching it against the name-only diff per `## Matching` above. It also covers no record coming back at all, which is an installed `canon` predating the verb, since a skill reaches a target the moment it merges while the CLI reaches one only when a release publishes. Naming both spellings matters exactly here: the binary old enough to need this fallback is the same binary that may predate the move, so the project's map can still sit at the older path. The fallback labels correctly and reports no uncovered path, which is the half only the verb carries.

Leave `pr_labels` empty when no map resolves or no prefix matches, which skips the labelling command rather than running it against nothing.
