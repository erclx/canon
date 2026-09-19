---
title: The pull request evidence comparison
description: What canon pr evidence compares, the marker that lets it edit its own comment rather than duplicate it, the refusal reasons it names, and why the comparison anchors at the merge base rather than the previous push
---

# The pull request evidence comparison

`canon pr evidence` renders one comment naming every changed image under an
`evidence/` path segment, comparing each against the pull request's merge base
with the trunk. `git-pr` posts it when a pull request opens or is edited, and
`git-followup` posts it again after every later push, so a reviewer never has
to open Files Changed to see what a case looked like before and after.

```bash
canon pr evidence
canon pr evidence 1341 --json
```

## Why the comparison anchors at the merge base

The comparison is always base against the current head, never the previous
push against the new one. A follow-up only ever moves the after side of the
comment, so what the comment claims can only grow to match what the branch
actually shows, and a reviewer who opens it midway through a review round
never reads a stale before image describing an intermediate commit nobody is
looking at anymore.

## What counts as evidence

A changed path qualifies when one of its segments is literally `evidence` and
its filename carries an image extension (`png`, `jpg`, `jpeg`, `gif`, `webp`,
`avif`, `svg`). The second half of that test exists because an `evidence/`
folder holds whatever else a project keeps beside its captures. This
repository's own tree carries eight `.md` files, two `.sh` scripts, a `.tsv`,
a `.json`, and an `.html` file against a single `.png`, and every one of them
would render as a broken `![]()` embed without the extension filter.

## What the record carries

The record groups every evidence path by state, the remainder of its
directory under the `evidence/` segment, and within a state by filename stem,
so a `before/hero.png` and an `after/hero.png` naming the same case group as
one entry rather than two unrelated files. Each entry carries whether it
existed at the base commit, which decides whether the comment shows a base
image or marks the case new.

`reason` on the record is what a caller branches on, not the exit code:

| Reason               | What it means                                                                 |
| -------------------- | ----------------------------------------------------------------------------- |
| `ok`                 | A body was rendered. `commentId` is set when a marked comment already exists. |
| `no-evidence`        | Nothing in the diff carries an `evidence/` segment. An ordinary silent no-op. |
| `gh-missing`         | `gh` is not on the path, so no pull request could be resolved.                |
| `gh-failed`          | `gh` could not answer for this repository or branch, or read its comments.    |
| `no-branch`          | The pull request carries no head branch name.                                 |
| `no-object-head`     | The pull request object reported no head commit.                              |
| `no-base`            | No base resolves against the trunk.                                           |
| `unreadable-tree`    | git could not read the tree at the base commit.                               |
| `unreadable-changes` | git could not list what this branch changed.                                  |

`no-evidence` is not a refusal a caller reports. A project on a stack that
carries no evidence path, such as `base` or `python`, hits this reason on
every pull request and posts nothing, which is the correct behavior rather
than a gap.

## What `[number]` selects, and what it does not

Naming a number picks which pull request the rendered body claims to
describe: its head commit and, when one already exists, the marked comment to
edit in place. The base and the changed set are always read from the local
checkout's own history, `git diff` and `git ls-tree` against the merge base
with the trunk, rather than fetched for the named pull request over the API.
That is correct for `git-pr` and `git-followup`, which never pass a number
and always run from the worktree building the branch, so the local checkout
and the named pull request describe the same branch. Naming a number for a
pull request built somewhere else compares this checkout's own diff against a
head commit that describes a different one.

## One comment, found by its own marker

Every body this verb renders ends with a trailing marker naming the head it
describes:

```markdown
<!-- pr-evidence: head=<sha> -->
```

`canon pr evidence` reads that marker back off every comment on the pull
request, the same way `canon pr review-state` reads its own marker off a
review body, and reports the REST id of whichever comment carries it as
`commentId`. A caller with no `commentId` posts a new comment. A caller
holding one edits that comment in place with a `PATCH` rather than posting a
second one.

Putting the lookup here, in the one place both `git-pr` and `git-followup`
call, is what keeps two close-out comments from landing beside each other the
way `review-pr` once posted, before that skill's own guard existed. It is
also why this verb renders the whole comment body rather than handing each
skill a record to format on its own: a fix to the table shape or the
collapsed-details wrapper lands once, not twice.

## The preview line

`--preview <url>` opens the body with the branch's preview address, and a run
without it carries forward the address the marked comment already holds. With
no evidence in the diff and an address in hand, the body is the address and the
marker alone, reported as `ok`. `canon docs pr-preview` covers where the
address comes from.

## What a collapsed comment still leaves to GitHub

GitHub already draws its own before-and-after comparison on the Files Changed
tab for any tracked image that changed. This comment does not make that view
redundant. The diff view shows what moved between two commits a reader has
already opened, and the comment is what lets a reader see the same comparison
without opening it at all.
