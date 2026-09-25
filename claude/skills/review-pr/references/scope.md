---
title: Scope the review read
description: Step 2 of review-pr, which finds the commit and verdict the prior pass left, stops on an unchanged head with no new reply, and scopes the read to the whole change or to the commits added since
---

# Scope the read

Step 2 of `review-pr`. The session reads this file on reaching that step, ahead of Step 3, so the unchanged-head stop below still fires before any review runs.

Find the commit the last pass covered and the verdict it posted:

```bash
canon pr review-state <number> --json
```

The fields are `<prior-oid>` off `commit`, `<prior-heading>` off `heading`, and `<prior-at>` off `readAt // submittedAt`. The commit scopes the read below, the heading feeds the repeat guard at the end of this step, and the instant scopes the reply query further down, so one call answers all three rather than three reads of the same review. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

`source` says which stamp answered. `marker` is the pass's own read-time record and is the authority. `fallback` is a pass posted before this mechanism shipped, so its commit is whatever the head was when GitHub recorded the review rather than what that session read, and a push inside its compose window is invisible. `none` is a thread carrying no pass at all.

Do not read `commit.oid` or `submittedAt` off `gh pr view --json reviews` here. Both are stamped at submission, so a push landing between a pass's read and its post moves them onto a commit that pass never saw, and this step then scopes the delta past it and reports it covered.

A target whose CLI predates the verb meets a missing subcommand rather than a record. Fall back there to the jq below, which reads the stamps and carries the defect above, and say the fallback answered so a reader can tell a marker read from a stamped one:

```bash
gh pr view <number> --json reviews --jq '[.reviews[] | select(.body // "" | split("\n")[0] | rtrimstr("\r") | . == "## Review" or . == "## Review closed")] | last | select(. != null) | ((.commit.oid // "") + "\t" + (.body | split("\n")[0] | rtrimstr("\r")) + "\t" + (.submittedAt // ""))'
```

The three fields are `<prior-oid>`, `<prior-heading>`, and `<prior-at>`. Keep the `select(. != null)` guard, since the string concatenation aborts jq on the null an empty selection returns, and an aborted command reaches the session as an error rather than as the empty result the first-pass branch reads.

Match the first line for equality against the two headings this skill posts. A prefix test also matches `## Review response` and any heading merely starting with those words, which would scope the pass to whatever commit that comment carried. The `\r` trim covers a body composed in the GitHub web editor, which stores CRLF.

A `source` of `none`, or an empty result from the fallback, is a first pass. Read the whole change:

```bash
gh pr diff <number>
```

```bash
gh pr diff <number> --name-only
```

A commit is a later pass. Fetch the pull request head so both commits are local:

```bash
git fetch -q origin pull/<number>/head
```

A failed fetch stops the skill: `❌ Could not fetch the PR head. Retry once the remote is reachable.` Do not fall through to the full pass. A fetch failure and a rebase both leave the prior commit unreachable, and the fallback below states a rebase as fact on the pull request, so conflating the two publishes a claim the skill never checked.

Then test that the prior commit still reaches the head:

```bash
git merge-base --is-ancestor <prior-oid> <headRefOid>
```

On exit zero, review `<prior-oid>..<headRefOid>` and nothing else. `git diff` and `git log --oneline` over that range are the whole read, because the first pass already covered everything behind it. A non-zero exit means the branch was rebased or force-pushed, so the delta is undefined rather than empty. Fall back to the full pass above and say so in the body.

A commit is its own ancestor, so an unchanged head passes that test too, with an empty range. When `<prior-oid>` equals `<headRefOid>`, decide whether this pass has anything to add before reading anything else, since the empty range itself cannot answer that:

```bash
gh pr view <number> --json comments --jq '[.comments[] | select(.body // "" | split("\n")[0] | rtrimstr("\r") | . == "## Review response" or . == "## Rebase" or . == "## Post-review findings") | select(.createdAt > "<prior-at>")] | last | .url // empty | split("-") | last'
```

`<prior-at>` is the instant Step 2 resolved above, which is the prior pass's `readAt` where it wrote one. Reading `submittedAt` off the thread here instead is the same submission-time defect on the time axis: a reply posted inside that pass's compose window sorts before the stamp and reads as already answered, when in fact the pass had stopped reading before it landed.

Scope the replies to those newer than the prior pass, never to every reply the thread carries. A pass answering the newest reply and a pass answering an older one derive the same third segment (Step 4), so an unscoped read hands a re-run after a close-out the name its own prior pass already wrote. That is the collision this case exists to prevent, reached without a rebase or an error.

Read the number off `.url`. The `id` field carries a GraphQL node id, which the thread never displays. Keep the `// empty` guard, since `split` aborts jq on the null an empty selection returns, and an aborted command reaches the session as an error rather than as the empty result the stop below reads.

An empty result means no reply arrived since the prior pass, so the head is unchanged and this pass has nothing new to add. Stop here, before Step 3 or Step 4 run: `❌ The head is unchanged since the prior pass on <short-sha>. Nothing new to review.` This is the earliest point every path crosses, which is why the check sits here rather than inside Step 4's filename derivation. A path that decides there is nothing to add never reaches a step reached only when composing a body, so a stop written there is a stop a shortcut path can route around.

A non-empty result carries the comment id Step 4 needs for the third filename segment. A `## Review response` or a `## Rebase` reply answers a finding already argued or reports a stale branch resolved without one, so read it for what the worker changed or accepted, treat an accepted finding as closed rather than restating it, and skip the diff and file reads below. This is the entire read on a repeated head for either heading, since the empty range above has nothing in it to say whether a prior finding landed and neither reply needs anything more to answer that.

A `## Post-review findings` reply carries no argued finding behind it, since it asserts a new defect rather than answering one, and this pass is its first independent reader. Restating it as a finding without opening anything is repeating the worker's claim rather than checking it. Read the file the comment names at `<headRefOid>`, the same `git show <headRefOid>:<path>` read Step 3 already runs to confirm a ticked box, and confirm the defect before it becomes a finding of this pass's own.

A moved head has its own way to add nothing, which the ancestor test cannot see. When `<prior-heading>` reads `## Review closed`, the standing verdict already reports the branch clear, so a pass over the new commits that raises nothing posts a comment saying what the one above it said.

The producing shape is narrow. A prior pass tells the author a change is their own call, the author makes it, and the delta reaching the next pass has nothing left to say by construction.

Carry `<prior-heading>` into Step 4 and run Step 3 unchanged. This guard cannot stop the pass the way the unchanged-head stop above does, because that stop reads an empty range and this one turns on what the pass carries, which is Step 3's output. Deciding ahead of the review would swallow the pass that does find something, and that is the costlier error, so the rule is stated beside its sibling and executed where the heading is picked.

Read each changed file in scope. Skip deleted files. Run reads in parallel.
