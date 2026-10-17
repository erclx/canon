---
title: Pull request evidence comparison
description: What canon pr evidence reads, how its comment is found, how cases group by view and size, and what counts as evidence
---

# Pull request evidence comparison

`src/pr/evidence.ts` answers which changed images `git-pr` and `git-followup` compare in one pull request comment. Images group by the state and stem the path's `evidence/` segment carries, and each is marked for whether it existed at the merge base.

## Decisions

### Read over the API

The changed set, each path's added-or-modified status, and the merge base come from the paginated files endpoint and the compare endpoint for the named pull request, not the local checkout.

The checkout read rendered an empty comparison, and with `--preview` reported `ok` over it, when an orchestrator ran it from the main worktree against a branch built elsewhere. `review-ui` and the orchestrator read the record by number from outside the branch.

### The trade for the API read

Refusing on a checkout head differing from `headRefOid` would have blocked those two callers. Uncommitted or unpushed evidence goes unseen, which the head-pinned image links could not show anyway.

### No empty render over a full comment

A render with no cases over a marked comment that carries some refuses `would-empty` and prints no body, since an emptied render cannot tell a removal from a short read.

### One comment, found by marker

A trailing `<!-- pr-evidence: head=<sha> -->` marker is parsed back off the issue comments endpoint, the shape `review-state` reads for its own marker, so a later call edits the same comment in place.

### What the record reports

`preview`, `local`, and `checklist` are what the marked comment already holds, each present only when carried, on `ok` and `no-evidence` alike. They come through the finders the carry-forward uses, so no skill parses the comment twice.

The thread is read ahead of the `no-evidence` return, and an unread thread refuses as `gh-failed` there too rather than reporting the fields absent.

### A checklist alone renders `ok`

It carries a marked body, reversing the earlier rule that a checklist did not decide `no-evidence`. That rule kept a docs-only branch from posting, but a branch with a checklist changed a rendered surface.

An unmarked standalone post left `review-ui` and the owed check unable to find it. `git-pr` keeps the raw post only as the fallback for a git refusal, which stays unmarked and reports no `checklist`.

### Grouped by view

One block per view, with a width per row and a theme per column, since a flat table sorted by name put a dark case 32 rows from its light twin.

- A name outside `view-theme-width` falls to the flat block, split from the right so a hyphenated view stays whole
- A second file sharing a view cell, such as a `.webp` beside a `.png`, falls there too, so no case is dropped

### Image width

Each image is an `<img>` asking for the smaller of its own width and 1000, read from the PNG's IHDR over the contents API at the commit its link names.

GitHub sizes a comment table to its content and keeps a pixel `width` while clamping to the cell. `width="100%"` on the table or image left a 300px screenshot's table at 472px of 880 in headless Chromium, against a mirror of GitHub's stylesheet. A fixed 1000 scaled a 38px crop up about 17 times.

### Width reads

The contents endpoint ignores a `Range` header, so the whole file downloads for 24 bytes. Reads run four at a time.

- A non-PNG or a failed read keeps 1000 rather than losing the row
- A failed read is named on the record as `widthUnread`, so a render flipping between 38 and 1000 across runs has a cause
- The 1000 ceiling still rests on an assumed 880px comment width

### Counting cases

`countEvidenceCases` counts head images, so a grouped row of two cases counts twice and the `would-empty` guard holds over an older comment.

### What counts as evidence

`isEvidencePath` requires both an `evidence/` segment and an image extension. This repository's evidence tree holds eight `.md` files, two `.sh` scripts, a `.tsv`, a `.json`, and an `.html` file against a single `.png`, and a segment-only test rendered every one as a broken `![]()` embed.

### The poll

`## Evidence` is the sixth heading `role-orchestrator`'s poll classifies. It is excluded from the unmatched set rather than folded into the reply family, since the comment answers no review and posting one should never send the poll back for a re-review.
