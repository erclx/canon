---
title: Pull request boundaries reference
description: How a plan sequencing its work into batches declares where each pull request ends, how dependent batches stack or fold, and the order batches build in
---

# Pull request boundaries reference

Applies to a feature plan that sequences its work into more than one batch. A dependency chain cannot be split once it is built, so the boundary is declared while the batches are still a plan rather than at ship time.

## One batch, one file

One batch is one pull request, and one pull request is one plan file, named for its own concern rather than a numeric suffix. `canon tasks plan-branch` derives one branch from one plan filename.

- A `**Batch N**` sub-heading inside one file's `**Files to touch:**` shares that branch across every batch, so the first merge strands the rest
- Write a plan opening five batches as five files before the first line of any of them

## Dependent batches

State a dependent batch's dependency on the ones before it in its own `**Constraints:**`, naming the earlier batch's slug and stacking rather than merging into it.

A batch that builds after another and shares most of its files folds into that batch as contiguous commits on one branch. Each pull request pays a fixed cost a same-file slice cannot earn back, and the rebases between stacked slices land on the same files.

### Judged apart

Keep a batch apart only where a reviewer or the operator would judge it apart. Write that reason as ``Judged apart from `feature-<parent>`: <reason>`` in the batch's `**Constraints:**`.

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
