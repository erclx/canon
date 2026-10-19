---
title: Pull request boundaries reference
description: How a plan sequencing its work into batches declares where each pull request ends, how dependent batches stack or fold, and the order batches build in
---

# Pull request boundaries reference

Applies to a feature plan that sequences its work into more than one batch. A dependency chain cannot be split once it is built, so the boundary is declared while the batches are still a plan rather than at ship time.

## One batch, one file

One batch is one pull request, and one pull request is one plan file, named for its own concern rather than a numeric suffix. `canon tasks plan-branch` derives one branch from one plan filename. A fan-in member is the exception, keeping its own file and branch and opening no pull request, per `## Fan-in`.

- A `**Batch N**` sub-heading inside one file's `## Files to touch` shares that branch across every batch, so the first merge strands the rest
- Write a plan opening five batches as five files before the first line of any of them

## Dependent batches

State a dependent batch's dependency on the ones before it in its own `## Constraints`, naming the earlier batch's slug and stacking rather than merging into it.

A batch that builds after another and shares most of its files folds into that batch as contiguous commits on one branch. Each pull request pays a fixed cost a same-file slice cannot earn back, and the rebases between stacked slices land on the same files.

### Judged apart

Keep a batch apart only where a reviewer or the operator would judge it apart. Write that reason as ``Judged apart from `feature-<parent>`: <reason>`` in the batch's `## Constraints`.

- A contract a later batch is built against
- A taste call the operator judges in its own sitting
- A fold that would exceed one review

`canon records validate plans` reports a stacked batch that should have folded, and its thresholds live there.

### Marking dependence

Mark each batch dependent or independent by comparing the file sets rather than the descriptions. A batch sharing no file with another is independent and earns its own branch even where both arrived in one request.

One run measured at 68 files carried three such batches into a single review because nothing drew the boundary.

## Slicing and sequence

Slice a batch by one user-visible path end to end rather than by layer, so each batch ships something a person can exercise. The file-set comparison still decides dependence, so two slices sharing a file stay marked dependent.

- Fold a path too thin to pay a pull request of its own forward into the next
- Sequence the riskiest batch first, so the batch most likely to change the plan is built while every later batch can still move
- Sequence a sweep last, even when it is the riskiest. A batch rewriting files earlier batches touched forces every batch behind it into one review anywhere else.
- Keep each batch's commits contiguous once the work starts, since a batch interrupted by another cannot be lifted onto its own branch afterward

## Fan-in

A fan-in builds batches in parallel and ships them as one pull request. Each member builds on its own branch and opens none, and one integrator merges every member branch, resolves the shared lines once, and opens the pull request. The trade is one large review, read one merge commit at a time, in place of a review and a rebase per batch.

### When to fan in

Fan in when the split was made for speed rather than meaning. Every one of these holds:

- One task with one outcome, so no batch is a feature on its own
- The batches share edge files, such as a gated-paths list or an index, so separate pull requests rebase each other on every merge
- No batch needs to ship, be reviewed, or be reverted alone

Keep separate pull requests when the pieces are independent features, when one needs its own review or revert, when one may stall and hold the rest, or when the combined diff is too large to review even one merge commit at a time. Batches that build on each other stack or fold, per `## Dependent batches`, since a member stacks on nothing.

### Declaring the set

Each side names the other in its `## Constraints`, and `canon records validate plans` reports `fan-in-unmatched` wherever the two disagree.

- A member writes ``Fan-in member of `feature-<integrator>` ``, naming one integrator
- The integrator writes ``Fans in `feature-<a>`, `feature-<b>`, and `feature-<c>` ``, in the order it merges them
- The task's `Plan:` line cites every member and the integrator, since the merge archives only the plans that line cites and a live integrator listing archived members reports `fan-in-unmatched`
- The integrator is its own plan, since its writes, being the shared lists, the citer repoints, and the index regeneration, need a `## Files to touch` of their own

`canon tasks plan-answers` holds a member whose integrator is missing or does not list it with a `Fan-in set` entry. It holds the integrator with a `Fan-in pending` entry until every member branch is on origin.

### Dispatching the set

The members of one set dispatch together by design, since they share edge files and the integrator resolves those lines once. A shared file between members is never a hold.

- Hold the integrator on a dependency until `plan-answers` reads it launchable
- Re-read it after a fetch on each member's done message, which carries the branch and head commit in place of a pull request
- Never read a member with no pull request as stalled, since a member opens none

### What a member writes

A member builds, verifies, pushes its branch, and announces it done. A pushed branch is the done signal, so a member pushes once, at the end.

A member may edit the shared lists and regenerate the indexes on its own branch, since the pre-push check fails a member that deletes a path a gated list still names. The integrator resolves those lines once at merge.

### What the integrator writes

The integrator merges each member branch with `git merge --no-ff` in the order its bullet lists, resolving conflicts by the rules a rebase follows. It then writes its own files, regenerates the indexes once, and opens the pull request.

- Say in the pull request body that each member is one merge commit, so a reviewer reads `git log --first-parent` one member at a time
- Fix a semantic conflict a merge surfaces on the integrator's branch, since a member has no pull request to fix it on
- Delete each member branch on origin with `git push origin --delete <branch>` once the pull request merges
