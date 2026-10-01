---
title: The pull request evidence comparison
description: What canon pr evidence compares, the marker that lets it edit its own comment rather than duplicate it, the refusal reasons it names, and why the comparison anchors at the merge base rather than the previous push
---

# The pull request evidence comparison

`canon pr evidence` renders one comment naming every changed image under an
`evidence/` path segment, comparing each against the pull request's merge base.
`git-pr` posts it when a pull request opens or is edited, and `git-followup`
posts it again after every later push, so a reviewer never has to open Files
Changed to see what a case looked like before and after.

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

| Reason                 | What it means                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- |
| `ok`                   | A body was rendered. `commentId` is set when a marked comment already exists. |
| `no-evidence`          | Nothing in the diff carries an `evidence/` segment. An ordinary silent no-op. |
| `unreadable-checklist` | `--checklist` named a path that could not be read, or one holding nothing.    |
| `gh-missing`           | `gh` is not on the path, so no pull request could be resolved.                |
| `gh-failed`            | `gh` could not answer for this repository or branch, or read its comments.    |
| `no-branch`            | The pull request carries no head branch name.                                 |
| `no-object-head`       | The pull request object reported no head commit.                              |
| `no-base`              | GitHub reported no merge base for the pull request.                           |
| `unreadable-changes`   | GitHub could not list what the pull request changed.                          |
| `would-empty`          | The render holds no cases and the marked comment holds some. No body.         |

`no-evidence` is not a refusal a caller reports. A project on a stack that
carries no evidence path, such as `base` or `python`, hits this reason on
every pull request and posts nothing, which is the correct behavior rather
than a gap.

Both `ok` and `no-evidence` also report what the marked comment already
shows a reviewer, each field present only when that comment holds it:

| Field       | What it carries                                                   |
| ----------- | ----------------------------------------------------------------- |
| `preview`   | The hosted `**Preview:**` address the comment opens with.         |
| `local`     | The `**Local preview:**` address under it.                        |
| `checklist` | The checklist between its delimiters, with any ticked boxes kept. |

These come from the comment already posted, never from the flags the call
passed, so a skill driving a review reads which address and which checklist a
reviewer has without parsing the comment itself. A checklist posted on its own
carries no marker, so the record reports none of the three for it. Reading
them means the thread is read before the `no-evidence` answer too, so an
unreadable thread refuses as `gh-failed` on both reasons rather than
reporting the fields absent.

## What `[number]` selects, and what it does not

Naming a number picks the pull request the whole record describes: its head
commit, its merge base, its changed set, and the marked comment to edit in
place. The changed paths and whether each was added or modified come from the
pull request's files endpoint, paged to the end, and the merge base comes from
the compare endpoint, so the record is the same from any checkout. A run from
the main worktree against a branch built elsewhere renders that branch's
comparison.

The trade is that the verb no longer sees evidence that is uncommitted or
unpushed, which the comment's head-pinned image links could not show anyway.
A path the pull request renamed or copied counts as added, since the new path
has no counterpart at the merge base, so a rename loses its before image and
renders `*(new)*`. A path the pull request removed is dropped, since it has no
head image to show. A failed files read refuses as `unreadable-changes` rather
than rendering a short set, and a missing merge base refuses as `no-base`.

## A render never empties a comment that carries cases

When the render holds no cases and the marked comment holds some, the verb
refuses `would-empty` and prints no body. A render with no cases cannot tell a
case removed on purpose from a short read, so the destructive direction needs a
person: they edit the comment directly. The record keeps `commentId` and the
carried fields, so the caller can still find the comment. A comment holding
only a preview or a checklist has no cases to lose and still re-renders `ok`.
`no-evidence` without a flag returns before any render, so the guard touches
only `--preview`, `--local`, and `--checklist` calls.

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

## The checklist line

`--checklist <path>` closes the body with a visual checklist, below the
comparison it annotates, so one comment carries the preview address, the
screenshots, and what a reviewer has to look at. The file is what
`canon:ui-checklist` writes to `.canon/tmp/handoff/ui-checklist/<slug>.md`, and
`git-pr` passes it here rather than posting it as a second comment.

A run without the option carries forward whatever checklist the marked comment
already holds, the same way the preview address is carried. That is what keeps
`git-followup`'s re-render after a push from wiping boxes a reviewer has
already ticked, since `git-pr` deletes the handoff once the first post reports
success and no later call has a file to pass.

The option does not decide `no-evidence` alone. A branch with a checklist and
no changed evidence image still reports `no-evidence`, and the caller posts the
checklist on its own, which is what it did before this option existed. A
checklist passed together with `--local` is the exception, covered below. A path
that cannot be read, or one holding nothing, refuses as
`unreadable-checklist` rather than rendering without it: the caller deletes the
handoff once a post succeeds, so a silently dropped checklist is the only copy
gone.

## The local preview line

`--local <url>` adds `**Local preview:** <url>` to the opening block: under the
hosted `**Preview:**` line when there is one, and as the first line when there
is not. The hosted line always keeps the first position, since that is the one
line the carry-forward reads for it. A run without the option carries forward
the local address the marked comment already holds, the same as the other two.

The option does not turn `no-evidence` into `ok` on its own. A branch with a
dev server running and no rendered change would otherwise get a comment holding
a link and nothing else. Together with `--checklist` it does, so the link and
the checklist land in one comment rather than the checklist going out alone.
`canon docs pr-local` covers where the address comes from and how the line is
removed at close.

## What a collapsed comment still leaves to GitHub

GitHub already draws its own before-and-after comparison on the Files Changed
tab for any tracked image that changed. This comment does not make that view
redundant. The diff view shows what moved between two commits a reader has
already opened, and the comment is what lets a reader see the same comparison
without opening it at all.
