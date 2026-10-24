---
title: Scope the review read
description: Step 2 of review-pr, which finds the commit and verdict the prior pass left, stops on an unchanged head with no new reply, and scopes the read to the whole change or to the commits added since
---

# Scope the read

Step 2 of `review-pr`. The session reads this file on reaching that step, ahead of Step 3, so the unchanged-head stop below still fires before any review runs.

## Find the prior pass

Find the commit the last pass covered and the verdict it posted:

```bash
canon pr review-state <number> --json
```

Take `<prior-oid>` off `commit`, `<prior-heading>` off `heading`, and `<prior-at>` off `readAt // submittedAt`. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

- The commit scopes the read below, the heading feeds the repeat guard at the end of this step, and the instant scopes the reply query
- One call answers all three rather than three reads of the same review

### Which stamp answered

`source` says which stamp answered, and `marker` is the authority. Never read `commit_id` or `submitted_at` off the reviews listing here, since both are stamped at submission and a push between a pass's read and its post moves them onto a commit that pass never saw.

- `marker`: the pass's own read-time record
- `fallback`: a pass posted before the marker shipped, whose commit is the head when GitHub recorded the review, so a push inside its compose window is invisible
- `none`: a thread carrying no pass at all

### When the verb is missing

A target whose CLI predates the verb meets a missing subcommand rather than a record. Fall back to this REST read, which reads the stamps and carries the defect above, and say the fallback answered so a reader can tell a marker read from a stamped one:

```bash
gh api --paginate 'repos/{owner}/{repo}/pulls/<number>/reviews?per_page=100' --jq '.[] | select(.body // "" | split("\n")[0] | rtrimstr("\r") | . == "## Review" or . == "## Review closed") | ((.commit_id // "") + "\t" + (.body | split("\n")[0] | rtrimstr("\r")) + "\t" + (.submitted_at // ""))' | tail -n 1
```

The three fields are `<prior-oid>`, `<prior-heading>`, and `<prior-at>`.

- The filter emits one line per matching review and `tail` keeps the newest, since `--paginate` runs the filter once per page
- Match the first line for equality, since a prefix test also matches `## Review response` and scopes the pass to that comment's commit
- The `\r` trim covers a body composed in the GitHub web editor, which stores CRLF

## A first pass

A `source` of `none`, or an empty result from the fallback, is a first pass. Read the whole change:

```bash
gh api 'repos/{owner}/{repo}/pulls/<number>' -H 'Accept: application/vnd.github.diff'
```

```bash
gh api --paginate 'repos/{owner}/{repo}/pulls/<number>/files?per_page=100' --jq '.[].filename'
```

Both reads go through REST, since the `gh pr` diff subcommand runs on GraphQL and a cloud session's GitHub proxy refuses it. The diff media type returns the same unified diff, and the paginated listing returns every path rather than the first page.

## A later pass

A commit is a later pass. Fetch the pull request head so both commits are local:

```bash
git fetch -q origin pull/<number>/head
```

A failed fetch stops the skill: `❌ Could not fetch the PR head. Retry once the remote is reachable.` Never fall through to the full pass, since a fetch failure and a rebase both leave the prior commit unreachable, and the fallback states a rebase as fact on the pull request.

Then test that the prior commit still reaches the head:

```bash
git merge-base --is-ancestor <prior-oid> <headRefOid>
```

- On exit zero, `git diff` and `git log --oneline` over `<prior-oid>..<headRefOid>` are the whole read, since the first pass covered everything behind it
- A non-zero exit means a rebase or force-push, so the delta is undefined rather than empty. Fall back to the full pass and say so in the body.

## An unchanged head

A commit is its own ancestor, so an unchanged head passes that test with an empty range. When `<prior-oid>` equals `<headRefOid>`, decide whether this pass has anything to add before reading anything else:

```bash
gh api --paginate 'repos/{owner}/{repo}/issues/<number>/comments?per_page=100' --jq '.[] | select(.body // "" | split("\n")[0] | rtrimstr("\r") | . == "## Review response" or . == "## Rebase" or . == "## Post-review findings") | select(.created_at > "<prior-at>") | .id' | tail -n 1
```

`<prior-at>` is the prior pass's `readAt` where it wrote one. Reading `submittedAt` here is the submission-time defect on the time axis, since a reply posted inside that pass's compose window would read as already answered.

- Scope the replies to those newer than the prior pass, since an unscoped read hands a re-run after a close-out the filename its prior pass already wrote
- The REST `id` is the number the thread displays in each comment's anchor
- Keep `tail` outside the filter for the same per-page reason as the reviews read

### No reply since the prior pass

An empty result means the head is unchanged and this pass has nothing new to add. Stop here, before Step 3 or Step 4 run: `❌ The head is unchanged since the prior pass on <short-sha>. Nothing new to review.`

This is the earliest point every path crosses. A stop inside Step 4's filename derivation would sit on a step reached only when composing a body, which a shortcut path can route around.

### A response or rebase reply

A non-empty result carries the comment id Step 4 needs for the third filename segment. A `## Review response` answers a finding already argued, and a `## Rebase` reports a stale branch resolved without one.

- Read it for what the worker changed or accepted, and treat an accepted finding as closed rather than restating it
- Skip the diff and file reads below. This is the entire read on a repeated head, since the empty range cannot say whether a prior finding landed.

### A post-review findings reply

A `## Post-review findings` reply asserts a new defect rather than answering one, and this pass is its first independent reader. Restating it unread repeats the worker's claim.

Read the file it names at `<headRefOid>`, the same `git show <headRefOid>:<path>` read Step 3 runs to confirm a ticked box, and confirm the defect before it becomes this pass's own finding.

## A closed verdict on a moved head

A moved head has its own way to add nothing, which the ancestor test cannot see. When `<prior-heading>` reads `## Review closed`, a pass over the new commits that raises nothing would repeat the standing verdict. It arises when a prior pass leaves a change to the author's call, the author makes it, and the delta has nothing left to say.

Carry `<prior-heading>` into Step 4 and run Step 3 unchanged. This guard turns on what the pass carries, which is Step 3's output, so deciding ahead of the review would swallow the pass that does find something, the costlier error.

## The read

Read each changed file in scope. Skip deleted files. Run reads in parallel.

### Load the UI rules on a later pass

A path-scoped rule loads when a session reads a matching file, and a later pass reads only `<prior-oid>..<headRefOid>`. When that range changed a rendered-surface file, read it at `<headRefOid>` so the UI rules load, even when the diff alone already shows it.

- Match the globs of `governance/rules/ui/design-taste.md`: `.tsx`, `.jsx`, `.astro`, `.html`, `.css`, `.scss`, and `canon/DESIGN.md`
- Read only files the range changed, never the whole tree, so the cost stays bounded by the range
- A range whose only rendered change is a deletion has no file to read, so skip it and carry on
