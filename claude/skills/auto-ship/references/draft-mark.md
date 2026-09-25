---
title: Draft mark
description: The one command auto-ship Step 8 runs as git-ship's pull request step returns, which proves the target is this branch's open pull request, marks it a draft, and reads the flag back
---

# Mark the pull request a draft

Step 8 of `auto-ship`. The session reads this file as `git-ship`'s pull request step returns, ahead of its CI watch.

Run the mark as one command, where the shell proves the target before the mark and reads the flag back after it:

```bash
target=$(gh pr view <number> --json headRefName,state --jq '"\(.headRefName) \(.state)"') || exit 1
if [ "$target" != "$(git branch --show-current) OPEN" ]; then
  printf '❌ #%s reads "%s", not "%s OPEN". The draft mark was not written.\n' "<number>" "$target" "$(git branch --show-current)" >&2
  exit 1
fi
gh pr ready --undo <number>
gh pr view <number> --json isDraft
```

Name the number `git-ship`'s pull request step returned in every position rather than leaving any to resolve by branch. `${CLAUDE_SKILL_DIR}/../git-pr/REQUIREMENT.md` states why: a lookup that resolves by branch alone can return a closed pull request sharing that head, so the number is resolved once and reused rather than re-derived.

A refusal is a stop. Report the line the shell printed, then resolve the number from the `number=` and `head=` lines of `git-pr`'s output and re-run the command by hand. The comparison sits in the shell rather than in the session's reading of a printed value, which is the same split `git-pr`'s `assert_own_pr` makes, because the judgment that picked a wrong number is the one that would read the check.

The number crosses from that step's output into a command this session types, which is the one place a number gets authored rather than derived. A number misread there, or inferred from the newest pull request in view, would draft a stranger's pull request. A release pull request is the worst such target, since the mark holds the release and this role may not lift it again.

Report what the read returned rather than what the command printed, since the exit says the call ran and says nothing about the state. A `true` reports a draft. A `false` reports the pull request as opened ready and unsupervised, and the chain stops there. Never re-issue the undo on a disagreeing read, which fights whoever readied it instead of guarding anything.

Placement is why the call sits ahead of the watch rather than after it. Marking afterwards leaves the pull request unmarked for the whole CI run, which is the stretch an unattended worker's branch is least supervised. What the mark buys is a reader learning the pull request has had no review yet. It buys no bound on that stretch: readying a pull request to merge lifts the mark, GitHub requires it before a merge, and the act belongs to the operator or to the controlling session that closed the review, whichever it is, taken directly on the pull request rather than delegated to a worker. `role-worker` states the mirroring refusal.
