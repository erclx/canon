---
title: Labels
description: The pull request label map a project declares rather than the skill ships, why labelling runs at open and nowhere else, and what the map fails to cover
---

# Labels

## Configuration a project declares

`git-pr` labels a pull request from a `[domains]` table at `canon/config/pr-labels.toml`, keying a label name to the path prefixes that earn it. No domain name of this repository reaches the skill or its references, because a shipped label set is a guess about someone else's surfaces and a wrong default costs more than no label at all. A project declaring no map is labelled silently and never warned, which reads the absent-key discipline in `canon/context/claude-plugin/skill-procedures/overview.md` the other way: an absent file here is an answer rather than a state to repair.

The map keys on changed paths rather than on the conventional-commit scope, since the top level of the tree already is the domain set and a scope-based table would need a second vocabulary held in step with the first. `.github/` is the rejected home for the map, since a skill reads the file and GitHub does not. `actions/labeler` would earn that folder but relabels on every push, needs a second glob syntax the skill cannot read, and derives labels from something other than the diff the body is written from.

Matching is prefix-anchored, so a row written for an authoring root reaches nothing under the consumed copy: `standards/` never matches `.claude/standards/`, and `claude/skills/` never matches `.claude/skills/`. Every surface living only under a dotted folder needs its own prefix on the row that owns its subject.

### The audit verb and its fallback

`canon labels audit`, living in `src/labels/` rather than in the skill body, names an uncovered branch before it merges. A second table, `[declined]`, separates a surface nobody covered from one somebody decided against, since prose can carry that distinction only to a reader rather than to a command. `canon/context/cli/audits.md` carries the reasoning behind the verb.

What it cannot see is a row that has gone stale: an entry naming a path that no longer exists still parses, still loads, and stops matching, so a branch moving a file the map enumerates literally leaves a dead row behind and the audit reports clean over it. Verify a rename against the moved tree rather than trust a passing run. A moved path shows up under `declined` against the row that caught it, where a dead entry appears in neither `declined` nor `uncovered`.

The skill calls the verb and keeps the stated rule as a fallback. A target whose installed `canon` predates the verb still labels correctly off the reference, though it loses the uncovered-path report.

The fallback carries every refusal except `no-map`, rather than the absent record alone: a map with a typo still has rows a prefix match can reach, so reading that refusal as an absence would open the pull request unlabelled and say nothing. `no-map` is the one reason that stops the step, since a project declaring no map has nothing to fall back to.

What is left uncovered is recorded in the file itself rather than covered: paths a release moves and paths a command rewrites, since a domain row over either gives a mechanical edit a subject it does not have, plus `assets/captures/hero.html`, which rides in the commit that regenerates the image beside it, so a row over `assets/` would label every such commit with a surface none of them is about.

## Labelling runs at open and nowhere else

Labelling runs after the pull request resolves rather than as a flag on the create. `gh pr create --label` fails whole on a label the remote lacks, so a mistyped row opens no pull request at all and the branch is left pushed with nothing to review. `gh pr edit --add-label` afterward degrades to a warning naming `gh label create` on failure, and it covers both the create and the edit branch with one call, earning a second output line since a refusal reaching nobody is the failure the fallback exists to prevent.

The step stays in `git-pr` alone, which makes the label set a description of the branch at the moment the pull request opened. `review-address` delegates its push to `git-followup`, which stages, commits, pushes, and refreshes the body without invoking `git-pr`, so no follow-up push reaches the labelling step whatever the branch touched.

A branch that pushes again after opening can merge under-labelled if the new commits cross into a domain the open-time diff never touched. Moving the step into `git-followup` is the alternative and it loses on the price rather than on the rate, since one behavior in two skills on two cadences buys back a rare miss. A check comparing the label set against the diff after the fact is the other answer and it loses too, since nothing can do that without re-deriving the map on every push, which is the same step in a third place.

## What the map fails to cover

The map has a second consumer and it is a person. Nothing detects a top-level directory the table fails to cover, so a surface added later labels nothing until someone adds a row, which is the manifest-to-reference symmetry this repository already records as a gotcha, arriving in a new folder.

`.claude/` carries no row of its own, since the tree spans context entries, two sets of generated mirrors, and internal skills rather than one domain, and a single row would label unrelated work alike. Each subtree instead carries its prefix on the row owning its subject: `.claude/rules/` joins `governance` and `.claude/internal/snippets/` joins `snippets`, rather than the map doubling with a row per subtree.

The row count is the measure worth watching here. A map with a row per subtree would rebuild the unreadable map this design avoids, which is why extending an existing row is the default and a new row waits for a subject no label carries. `snippets` and `repo` are the two that earned one.
