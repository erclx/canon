---
name: review-address
description: Pulls review findings and CI status on the current branch's open PR, fixes each in the working tree, refreshes any stale `.claude/` docs, replies with a summary comment, and pushes a follow-up commit. The worker's return leg after `review-pr`. Use when asked to "address the review", "fix the PR comments", "respond to review", or after an orchestrator posts findings. Do NOT use to write a review. That is `review-pr`.
---

# Review address

The worker's half of the review channel. `review-pr` posts findings to
the PR from an independent session. This skill consumes them: fix, reply, push.

## Guards

- If no open PR resolves for the current branch via `gh pr view`, stop: `❌ No open PR. Nothing to address.`
- If the PR has no review comments or threads, run step 5's staleness test before deciding. A branch that still merges stops here: `✅ No review findings to address.` One that does not skips steps 1 through 4 and runs step 5 onward, since a branch goes stale from `main` moving and a closed review says nothing about whether it still merges.
- Fix findings. Do not merge.

## Step 1: pull the review findings and CI status

Read the review comments and threads on the PR:

```bash
gh pr view --json number,reviews,comments
```

For inline review comments, read them via `gh api` on the PR's review comments. Collect each finding with its file, location, and body.

Also read the CI check status so the fixes cover failing checks, not only review comments:

```bash
canon pr checks <number> --json
```

Read the verdict off the record's `state` rather than off the exit. Treat `failing` as a finding to resolve alongside the review comments. A `pending` covers a tip whose runs have yet to conclude and a tip carrying no run at all, which the record separates on `matched`, and neither is a green to continue on. Fall back to `gh pr checks <number>` when no record comes back at all, which is a target whose CLI predates the verb.

## Step 2: address each finding

For each finding, implement the fix in the working tree. When a finding is a
question or a conscious-accept rather than a defect, note the reply text instead
of editing. Handle each finding independently. Do not let one unresolved finding
block the others.

## Step 3: verify

Run the project check (`bun run check` or the project's documented equivalent).
Do not push a red follow-up.

## Step 4: refresh stale docs

The fixes may have changed or added behavior that `.claude/` context entries, docs, or wireframes describe. Refresh them with the `docs-fold` skill, which maps the changed files to the entries that reference them and rewrites the stale sections. Do not reimplement that mapping here. When a fix adds a new capability with no existing entry, `docs-fold` flags it rather than creating one.

## Step 5: rebase a stale branch

A branch goes stale from `main` moving rather than from anything the branch did,
so the test runs on every invocation, including the one the second guard sends
straight here with no findings to fix. Fetch first. A stale local `origin/main`
reports no conflict on a branch that has one.

```bash
git fetch origin main
git merge-tree --write-tree origin/main HEAD
```

A zero exit means the branch still merges. Skip to step 6, which is the ordinary
run. A non-zero exit means it does not, so read
`${CLAUDE_SKILL_DIR}/references/rebase-conflicts.md` for the stash-and-rebase
sequence, the conflict resolution rules, and the check to re-run afterward.

`git merge-tree` reads committed history, so this test says nothing about the
fixes still sitting in the working tree. A branch that merges clean as committed,
whose fixes touch lines `main` moved, passes here and reaches the remote
unmergeable. Step 6 re-runs the test once those fixes are commits.

## Step 6: push, then reply

Push the fixes before posting the reply so the comment never runs ahead of the
code it describes. Ship the fixes as a follow-up commit on the same branch with
the `git-followup` skill, invoked with `reply-owned` so it stages, commits,
pushes, and refreshes the open PR body without posting its own comment. This
skill owns the reply. Do not reimplement that flow here.

`git-followup` syncs the body and title against the fix commit on every
invocation, including `reply-owned`, so the merge record reflects what this pass
changed rather than only what opened the PR. The reply comment still carries the
fix log mapped to each finding, since the two serve different readers: the body
is the merge record and the reply is the review's own thread. A rebase in step 5
rewrote the branch, so that push is a force-push and `git-followup` resolves it
from the tracking branch. Worker branches are single-owner here, which is what
makes overwriting the remote safe.

`git-followup` stops on an unchanged tree. A run that answered every finding as a
conscious-accept and whose rebase left the generated files alone has nothing for
it to commit, so the rebase would never reach the remote. Push that case directly
with `git push --force-with-lease`, then post the reply below.

Once the fixes are commits, re-run step 5's staleness test against the new head.
A conflict that appears only now is one the fixes introduced against lines `main`
moved, which the earlier test could not see. Rebase again under
`${CLAUDE_SKILL_DIR}/references/rebase-conflicts.md` and force-push, then
continue. The second push costs one extra force-push in a
case that needs the fix and the sibling to touch the same lines.

Then write a summary reply to `.canon/tmp/pr/reply/reply-<number>.md`
mapping each finding to what changed, or to a one-line reason when it is a
conscious-accept rather than a defect. Key the filename on the PR number so two
sessions addressing different pull requests never overwrite each other between
the write and the post. Note any `.claude/` docs refreshed as a result of the
fixes.

The reply is a rendered-for-human GitHub surface, so load the `write-human`
skill for voice, follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for
the banned words, and keep each mapping to a line or two.

Open the body with the `## Review response` heading so it anchors as a section
distinct from human threads and stays subordinate to the `## Review` heading the
review itself carries. Follow it with a one-line summary sentence, then one
bullet per finding, each opening with the bolded finding identifier.
Close the body with `🤖 Addressed by Claude Code` on its own line so the reply
reads as an independent machine pass, not a human sign-off.

A finding this run declined carries the fact that settled it, inside its own
bullet rather than in a section of its own. Name the plan question that already
answered it, the constraint the diff does not show, or the measurement the
reviewer did not have. Answering the dispatch in the channel and leaving that
fact there loses it when both sessions end, and the reviewer is left with a
finding that stopped being mentioned. The rule fires on a bullet the body already
writes, so nothing depends on judging mid-reply whether a reply was important.

The rule reaches a finding and nothing else. A correction to what the reviewing
session believes about the world, such as which session holds which branch or
what an edit passes through before it lands, changes no finding on this pull
request and belongs in that session's own record rather than on a thread that
closes. Keep it off the comment, and answer it wherever the dispatch reached this
session when one did. Nothing tests the reply for either rule, since the scan
below reads it for banned characters and phase labels alone, so both halves hold
while a run applies them.

The `pull_request` check the git-pr surface carries reads a pull request's own
title and body, not a reply comment, so the scan below stays the only gate here.

When step 5 rebased the branch, say so in the summary sentence and name which
files were resolved by hand and which the regen rebuilt. The next review is a
full pass rather than a delta, and the reader is owed the reason.

A run the second guard sent straight to step 5 has no findings to map, so it
takes a different body rather than an empty list. Open it with `## Rebase`, not
`## Review response`, since nothing on the pull request is being responded to and
that heading claims a review this run never read. State that the branch stopped
merging, name what landed on `main`, name the files resolved by hand and those
the regen rebuilt, and close the same way. The heading stays outside the
`## Review` family so the close-out's equality test on the first line never
matches it.

Before posting, follow `${CLAUDE_SKILL_DIR}/../../standards/publish.md`
and run its scan against the reply:

```bash
canon labels scan --body-file .canon/tmp/pr/reply/reply-<number>.md
```

The hook skips `.canon/tmp/`, so this scan is the only gate on the published
reply. Fix any hit the standard names, then post the reply to the PR and
capture the posted comment's id, since Step 7 edits this exact comment rather
than trusting whichever one `gh` considers last:

```bash
comment_url=$(gh pr comment <number> --body-file .canon/tmp/pr/reply/reply-<number>.md)
echo "${comment_url##*issuecomment-}" > .canon/tmp/pr/reply/reply-<number>.id
```

## Step 7: confirm resolution

After the follow-up push, watch CI on the PR. Poll
`canon pr checks <number> --json` until the record's `state` leaves `pending`,
then read it. When every finding is addressed and the state is `passing`, append
the closing confirmation to the reply file Step 6 already posted, so the thread
carries one terminal state rather than a second comment under no heading:

```bash
printf '\n✅ All review findings addressed, CI green.\n' >> .canon/tmp/pr/reply/reply-<number>.md
```

A rebase-only run addressed no finding, so it appends its own confirmation
instead of that one. Claiming findings were addressed on a pull request that
carries none is false on a surface nothing else checks:

```bash
printf '\n✅ Rebased onto origin/main, CI green. No review findings were open.\n' >> .canon/tmp/pr/reply/reply-<number>.md
```

Re-run the scan against the updated file, since the appended line is new
content the Step 6 scan never saw:

```bash
canon labels scan --body-file .canon/tmp/pr/reply/reply-<number>.md
```

Then edit the exact comment Step 6 posted, read back from the id it saved,
rather than posting a second comment. A shell variable assigned from `cat` and
handed to `gh` still carries a runtime value the isolation rule cannot verify,
so read the id as its own plain command and write the printed value as a
literal in the `gh api` call rather than a substitution or a variable:

```bash
cat .canon/tmp/pr/reply/reply-<number>.id
```

```bash
gh api -X PATCH "repos/{owner}/{repo}/issues/comments/<id printed above>" \
  -F body=@.canon/tmp/pr/reply/reply-<number>.md
```

`--edit-last` was the first shape and it targets the wrong object here.
It edits the last comment posted by the authenticated user, not the last
comment this run posted, and every session here authenticates as the one
account the operator also comments from. A comment the operator leaves on
their own pull request during the minutes Step 7 spends waiting on CI becomes
that last comment, so `--edit-last` would overwrite it with the reply and the
confirmation, silently. Targeting the id Step 6 captured closes that whether
or not anyone commented in between.

If any check fails, skip the edit. Report the failing check so it can be fixed
first. This is a resolution signal, not a formal approval, since the PR author
cannot approve their own PR.

## Step 8: output

```plaintext
Addressed <N> findings on PR #<number>. Follow-up pushed.
<Rebased onto origin/main. <N> files resolved by hand, <N> rebuilt by the check.>
```

Omit the second line when the branch still merged. Name any finding left as a
reply rather than a code change, with its one-line reason.

A rebase-only run drops the first line rather than reporting zero findings
addressed, and leads with the rebase instead:

```plaintext
Rebased PR #<number> onto origin/main. <N> files resolved by hand, <N> rebuilt by the check.
```

Do not merge. Hand back to the orchestrator for re-review.

## Post-review findings

Not everything worth reaching the reviewing session surfaces inside the numbered flow above. A worker that settled a risk, filed a follow-up, or found something else worth reporting after Step 7 already closed the review posts it directly rather than waiting on a review pass that has nothing left to trigger it. Write the body the way Step 6 writes a reply: load `write-human` for voice, follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for the banned words, and run the `${CLAUDE_SKILL_DIR}/../../standards/publish.md` scan before posting with `canon labels scan --body-file .canon/tmp/pr/reply/reply-<number>.md`.

Open with `## Post-review findings` rather than `## Review response`, since nothing on the thread is being answered. `review-pr` states the full heading set this belongs to and routes it the same as a response: `role-orchestrator`'s poll picks it up and sends the reviewing session back for a pass. Close the body with `🤖 Addressed by Claude Code` on its own line, matching the reply's footer.

```bash
gh pr comment <number> --body-file .canon/tmp/pr/reply/reply-<number>.md
```
