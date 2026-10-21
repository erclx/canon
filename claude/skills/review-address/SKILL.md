---
name: review-address
description: Pulls review findings and CI status on the current branch's open PR, fixes each in the working tree, refreshes any stale `.claude/` docs, replies with a summary comment, and pushes a follow-up commit. The worker's return leg after `review-pr`. Use when asked to "address the review", "fix the PR comments", "respond to review", or after a reviewer posts findings. Do NOT use to write a review. That is `review-pr`.
metadata:
  family: after-pr
---

# Review address

The worker's half of the review channel. `review-pr` posts findings to the PR from an independent session. This skill consumes them: fix, reply, push.

## Guards

- Resolve `<number>` and `<tip>` off `canon pr head --json`. An `ambiguous-pull` refusal stops: `❌ Two open PRs on this branch. Name the one to address.`
- A record with no `number` takes the lookup in `${CLAUDE_SKILL_DIR}/references/rest-reads.md`. Nothing resolving stops: `❌ No open PR. Nothing to address.`
- If the PR has no review comments or threads, run step 5's staleness test before deciding. A branch passing both halves stops here: `✅ No review findings to address.`
- A branch failing either half skips steps 1 through 4 and runs step 5 onward, since a branch goes stale from `main` moving and a closed review says nothing about whether it still merges
- Fix findings. Do not merge.

## Step 1: pull the review findings and CI status

Read the reviews, the thread's comments, and the inline review comments through the three reads in `${CLAUDE_SKILL_DIR}/references/rest-reads.md`. Collect each finding with its file, location, and body.

Also read the CI check status so the fixes cover failing checks, not only review comments:

```bash
canon pr checks <number> --json
```

Read the verdict off the record's `state` rather than off the exit.

| Record             | Means                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `failing`          | A finding to resolve alongside the review comments                                                          |
| `pending`          | Runs not concluded, or no run on the tip, which `matched` separates. Neither is a green to continue on.     |
| `conflicted: true` | The branch conflicts with its base, so no run will start. Stop and report it, since a rebase is the repair. |
| No record          | Read the check runs on the tip through `${CLAUDE_SKILL_DIR}/references/rest-reads.md`                       |

## Step 2: address each finding

For each finding, implement the fix in the working tree. When a finding is a question or a conscious-accept rather than a defect, note the reply text instead of editing. Handle each finding independently, so one unresolved finding blocks no other.

## Step 3: verify

Run the project check (`bun run check` or the project's documented equivalent). Do not push a red follow-up.

## Step 4: refresh stale docs

The fixes may have changed behavior that `.claude/` context entries or docs describe. Refresh them with the `context-fold` skill, which maps changed files to the entries citing them and rewrites the stale sections.

Do not reimplement that mapping here. When a fix adds a capability with no existing entry, `context-fold` flags it rather than creating one.

## Step 5: rebase a stale branch

A branch goes stale from `main` moving rather than from anything it did, so the test runs on every invocation, including one the guard sends straight here. Fetch first, since a stale local `origin/main` reports no conflict on a branch that has one.

```bash
git fetch origin main
git merge-tree --write-tree origin/main HEAD
fork=$(git merge-base origin/main HEAD)
git diff -z --name-only --no-renames "$fork" HEAD |
  xargs -0 -r git --literal-pathspecs diff --name-only --no-renames "$fork" origin/main --
```

### Reading the test

`merge-tree` exiting non-zero means the branch no longer merges. A path the last command prints means `main` changed a file the branch writes, so its green run tested a merge nobody will make.

- Either one sends the branch to `${CLAUDE_SKILL_DIR}/references/rebase-conflicts.md` for the sequence, the conflict rules, and the check to re-run
- Even a clean merge can hide semantic conflicts, per Fowler's [Mainline Integration](https://martinfowler.com/articles/branching-patterns.html#mainline-integration). A check failing after a clean rebase is one, fixed on the branch.
- Neither firing skips to step 6, which covers a `main` that moved only on files the branch does not write

`git merge-tree` reads committed history, so it says nothing about fixes still in the working tree. Step 6 re-runs the test once those fixes are commits.

## Step 6: push, then reply

Push the fixes before posting the reply, so the comment never runs ahead of the code it describes. Ship them as a follow-up commit with `git-followup`, invoked with `reply-owned` so it stages, commits, pushes, and refreshes the PR body without its own comment.

### What the push carries

This skill owns the reply, so do not reimplement the followup flow here.

- `git-followup` syncs the body and title on every invocation, `reply-owned` included, so the merge record reflects this pass. The reply still maps fixes to findings in the review's own thread.
- A rebase in step 5 rewrote the branch, so the push is a force-push `git-followup` resolves from the tracking branch. Worker branches are single-owner, which makes that safe.
- `git-followup` stops on an unchanged tree, as when every finding was a conscious-accept and the rebase left generated files alone. Push that with `git push --force-with-lease`.

Once the fixes are commits, re-run step 5's staleness test against the new head. A conflict appearing only now is one the fixes introduced against lines `main` moved, so rebase again under `${CLAUDE_SKILL_DIR}/references/rebase-conflicts.md` and force-push.

### Write the reply

Write a summary reply to `.canon/tmp/pr/reply/reply-<number>.md`, keyed on the PR number so two sessions addressing different pull requests never overwrite each other. Load `write-human` for voice, follow `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md`, and keep each mapping to one line.

| Part     | Content                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading  | `## Review response`, distinct from human threads and subordinate to the review's own `## Review`                                              |
| Summary  | One sentence. After a step 5 rebase, say so and name files resolved by hand and those the regen rebuilt, since the next review is a full pass. |
| Findings | One line per finding under 200 characters, naming its outcome and the commit that carries it, in the shape below                               |
| Docs     | Any `.claude/` docs refreshed as a result of the fixes                                                                                         |
| Close    | `🤖 Addressed by Claude Code` on its own line, so the reply reads as a machine pass rather than a human sign-off                               |

```markdown
- **<severity>**, `<file>` line <n>: fixed in `<sha>`. <What now holds, in one sentence.>
- **<severity>**, `<file>` line <n>: declined. <The fact that settled it.>
```

The commit carries the fix and its test, so the line names neither.

A run the guard sent straight to step 5 has no findings to map, so it takes the `## Rebase` body in `${CLAUDE_SKILL_DIR}/references/rebase-only.md` instead. A run with findings skips that file.

### What a declined finding carries

A finding this run declined carries the fact that settled it inside its own line, which may take a second sentence for it, such as the plan question that answered it, a constraint the diff does not show, or a measurement the reviewer lacked. Left in the channel, that fact is lost when both sessions end.

The rule reaches a finding and nothing else. A correction to what the reviewing session believes about the world changes no finding here, so answer it wherever the dispatch reached this session and keep it off the comment.

### Scan and post

Nothing tests the reply for either rule above. Follow `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md` and run its scan, which reads for banned characters and phase labels, and reports the reply's density:

```bash
canon labels scan --body-file .canon/tmp/pr/reply/reply-<number>.md --json
```

The hook skips `.canon/tmp/`, and the `pull_request` check reads only a pull request's own title and body, so this scan is the only gate on the reply.

- Fix any hit, and stop on a `density` entry too, shortening the line it names
- Read the record rather than the exit, since a post's density never sets the exit code

Then post and keep the `id` the POST answers with, since Step 7 edits this exact comment:

```bash
gh api -X POST 'repos/{owner}/{repo}/issues/<number>/comments' -F body=@.canon/tmp/pr/reply/reply-<number>.md --jq .id > .canon/tmp/pr/reply/reply-<number>.id
```

## Step 7: confirm resolution

After the push, read Watching CI in `${CLAUDE_SKILL_DIR}/../git-ship/SKILL.md` without invoking that skill, start its background watch, end the turn on its line, and run the rest of this step and Step 8 on the wake. Reuse a watch already running on this PR, since it reads the new tip.

- On the wake, stop on `conflicted` naming a rebase, on a `reason` naming it, and on a timeout reporting CI unsettled
- If any check fails, skip the edit and report the failing check so it can be fixed first

When every finding is addressed and the state is `passing`, append the closing confirmation to the reply file Step 6 posted, so the thread carries one terminal state rather than a second comment. A rebase-only run appends the line `${CLAUDE_SKILL_DIR}/references/rebase-only.md` gives instead.

```bash
printf '\n✅ All review findings addressed, CI green.\n' >> .canon/tmp/pr/reply/reply-<number>.md
```

Re-run the scan against the updated file, since the appended line is new content the Step 6 scan never saw:

```bash
canon labels scan --body-file .canon/tmp/pr/reply/reply-<number>.md
```

### Edit the posted comment

Edit the exact comment Step 6 posted, read back from the id it saved, rather than posting a second one. A shell variable assigned from `cat` still carries a runtime value the isolation rule cannot verify, so print the id and write it as a literal:

```bash
cat .canon/tmp/pr/reply/reply-<number>.id
```

```bash
gh api -X PATCH "repos/{owner}/{repo}/issues/comments/<id printed above>" \
  -F body=@.canon/tmp/pr/reply/reply-<number>.md
```

Never use `--edit-last`, which edits the last comment the authenticated account posted. The operator comments from that same account, so a comment they leave during the CI wait would be silently overwritten.

This is a resolution signal, not a formal approval, since the PR author cannot approve their own PR.

## Step 8: output

```plaintext
Addressed <N> findings on PR #<number>. Follow-up pushed.
<Rebased onto origin/main. <N> files resolved by hand, <N> rebuilt by the check.>
```

Omit the second line when the branch still merged. Name any finding left as a reply rather than a code change, with its one-line reason. A rebase-only run reports the line `${CLAUDE_SKILL_DIR}/references/rebase-only.md` gives instead.

Do not merge. Hand back to the reviewer for re-review, or to the orchestrator where no live reviewer answers.

## Post-review findings

Something worth reaching the reviewing session can surface after Step 7 already closed the review. Read `${CLAUDE_SKILL_DIR}/references/post-review-findings.md` before posting it, for the heading it opens with, the voice and scan its body takes, and the call that posts it.
