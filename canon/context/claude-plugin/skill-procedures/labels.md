---
title: Labels
description: The pull request label map a project declares rather than the skill ships, why labelling runs at open and nowhere else, and what the map fails to cover
---

# Labels

## Overview

The pull request label map is declared by a project rather than shipped by the skill. This entry covers why labelling runs at open and nowhere else, and what the map fails to cover.

## Layout

### The map

`git-pr` labels a pull request from a `[domains]` table at `canon/config/pr-labels.toml`, keying a label name to the path prefixes that earn it. No domain name of this repository reaches the skill or its references, because a shipped label set is a guess about someone else's surfaces and a wrong default costs more than no label at all.

A project declaring no map is labelled silently and never warned. That reads the absent-key discipline in `canon/context/claude-plugin/skill-procedures/overview.md` the other way, since an absent file here is an answer rather than a state to repair.

### Prefix anchoring

Matching is prefix-anchored, so a row written for an authoring root reaches nothing under the consumed copy. `governance/rules/` never matches `.claude/rules/`, and `claude/skills/` never matches `.claude/skills/`.

Every surface living only under a dotted folder needs its own prefix on the row that owns its subject.

### What stays uncovered

The map file records two surfaces it leaves uncovered rather than covering them.

- Paths a release moves and paths a command rewrites, since a domain row over either gives a mechanical edit a subject it does not have
- `assets/captures/hero.html`, which rides in the commit that regenerates the image beside it, so a row over `assets/` would label every such commit with a surface none of them is about

### `.claude/` carries no row of its own

The tree spans generated rule mirrors, internal skills, and hooks rather than one domain, and a single row would label unrelated work alike. Each subtree instead carries its prefix on the row owning its subject.

- `.claude/rules/` joins `governance`
- `.claude/skills/` joins `skills`, which covers the internal skills and their references
- `.claude/hooks/` and `.claude/settings.json` join `ci`

## Decisions

### Why the map keys on paths and lives in `canon/config/`

The map keys on changed paths rather than the conventional-commit scope, since the top level of the tree already is the domain set and a scope-based table would need a second vocabulary held in step with the first.

`.github/` is the rejected home, since a skill reads the file and GitHub does not. `actions/labeler` would earn that folder but fails three ways.

- It relabels on every push
- It needs a second glob syntax the skill cannot read
- It derives labels from something other than the diff the body is written from

### What the verb reports

`canon labels audit`, living in `src/labels/` rather than the skill body, names an uncovered branch before it merges. A second table, `[declined]`, separates a surface nobody covered from one somebody decided against, which prose carries only to a reader. `canon/context/cli/audits/reports.md` carries the reasoning behind the verb.

### The fallback

The skill calls the verb and keeps the stated rule as a fallback. A target whose installed `canon` predates the verb still labels correctly off the reference, though it loses the uncovered-path report.

The fallback carries every refusal except `no-map`, rather than the absent record alone. A map with a typo still has rows a prefix match can reach, so reading that refusal as an absence would open the pull request unlabelled and say nothing.

- `no-map` is the one reason that stops the step, since a project declaring no map has nothing to fall back to

### Where the step runs

Labelling runs after the pull request resolves rather than as a field on the create, so one step covers both the create and the edit branch. It runs over REST, since a cloud session's GitHub access blocks GraphQL.

The REST endpoint creates any label it is handed that the remote lacks.

- The step therefore reads each name off the remote first and degrades a missing one to a warning naming `gh label create`
- The warning earns a second output line, since a refusal reaching nobody is the failure the fallback exists to prevent

### One verb for every caller

The step stays in `git-pr` alone, which makes the label set a description of the branch at the moment the pull request opened. `review-address` delegates its push to `git-followup`, which stages, commits, pushes, and refreshes the body without invoking `git-pr`, so no follow-up push reaches the labelling step.

- The step is one verb, `canon labels apply <number>`, which `git-pr`'s final command calls and any other path to an open pull request runs by hand
- The seeded `pr-create-log.sh` hook names it after a `gh pr create`, since that path skipped `git-pr` and nothing else labels the result
- The verb only adds, and refuses before any write, `--check` included, a pull request whose head is not the current branch or whose state is not open
- A project declaring no map exits 0 with nothing added

### Declined for now

Two further options were declined for now. The hook and the verb close the reported gap.

- Whether `review-pr` should raise owed labels
- Whether CI should run the verb on `pull_request` opened, which would fix this repository alone while the issue came from a target

### Row count is the measure

A map with a row per subtree would rebuild the unreadable map this design avoids. Extending an existing row is therefore the default, and a new row waits for a subject no label carries. `repo` is the one that did.

## Gotchas

### What the verb cannot see

It cannot see a row gone stale. An entry naming a path that no longer exists still parses, still loads, and stops matching, so a branch moving a file the map enumerates literally leaves a dead row behind and the audit reports clean over it.

- Verify a rename against the moved tree rather than trust a passing run
- A moved path shows up under `declined` against the row that caught it, where a dead entry appears in neither `declined` nor `uncovered`

### The follow-up push gap

A branch that pushes again after opening can merge under-labelled if the new commits cross into a domain the open-time diff never touched. The follow-up-push miss stays a gotcha, since no caller runs the verb on a push.

- Moving the step into `git-followup` lost on price rather than rate, since one behavior in two skills on two cadences buys back a rare miss
- A check comparing the label set against the diff after the fact first lost because it would re-derive the map in a third place
- The verb replaced that rejection rather than reopening it, since it is one place every caller shares, and `--check` is the after-the-fact reading of the same earned set the add uses

### A person closes the gap

The map has a second consumer, and it is a person. Nothing detects a top-level directory the table fails to cover, so a surface added later labels nothing until someone adds a row. That is the manifest-to-reference symmetry this repository already records as a gotcha, arriving in a new folder.
