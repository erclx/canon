---
title: Draft mark
description: The one command auto-ship Step 6 runs as git-ship's pull request step returns, which proves the target is this branch's open pull request, reads its draft flag, marks it only when it reads ready, and reads the flag back
---

# Back up the draft on the pull request

Step 6 of `auto-ship`. The session reads this file as `git-ship`'s pull request step returns, ahead of its CI watch. The `--draft` argument opens a new pull request as a draft, so this command normally writes nothing. It repairs what the create misses, being a re-run onto an existing pull request and a host that refused or ignored the field.

Run it as one command, where the shell proves the target and reads the flag before any mark, and reads the flag back after it:

```bash
target=$(gh api repos/{owner}/{repo}/pulls/<number> --jq '"\(.head.ref) \(.state) \(.draft) \(.node_id)"') || exit 1
read -r pr_head pr_state pr_draft pr_node <<EOF
$target
EOF
if [ "$pr_head $pr_state" != "$(git branch --show-current) open" ]; then
  printf '❌ #%s reads "%s %s", not "%s open". The draft mark was not written.\n' "<number>" "$pr_head" "$pr_state" "$(git branch --show-current)" >&2
  exit 1
fi
if [ "$pr_draft" != true ]; then
  for attempt in 1 2 3; do
    gh api graphql -f query='mutation($id: ID!) { convertPullRequestToDraft(input: {pullRequestId: $id}) { clientMutationId } }' -f id="$pr_node" --silent && break
    [ "$attempt" -lt 3 ] && sleep 5
  done
fi
gh api repos/{owner}/{repo}/pulls/<number> --jq '{isDraft: .draft}'
```

## The retry

The loop wraps the mutation alone, and it runs only on a flag reading ready. The target check runs once ahead of it and its refusal exits the command, so a refused target never reaches the mark or a second check.

- A mutation exiting non-zero runs again after five seconds, up to three tries, which clears a transient server error
- The read-back runs once after the loop, whichever try succeeded or none did
- A cloud session's blocked GraphQL fails every try, which costs ten seconds of waiting before the same `false` read

## Why the mark is a fallback

The target check, the flag read, and the read-back go through REST. The mark itself is a GraphQL mutation, because the REST pull request update carries no draft field. The create is the only REST write that can set the flag.

- A create that drafted never reaches the mutation, so a cloud session whose GraphQL is blocked can still hold a draft, unverified until a cloud run opens one
- A pull request the create left ready stays ready in a cloud session, since the mutation fails there and the read-back reports `false`

## The number

Name the number `git-ship`'s pull request step returned in every position rather than leaving any to resolve by branch. `${CLAUDE_SKILL_DIR}/../git-pr/REQUIREMENT.md` states why, since a lookup by branch alone can return a closed pull request sharing that head.

The number crosses from that step's output into a command this session types, the one place a number gets authored rather than derived. A number misread there, or inferred from the newest pull request in view, would draft a stranger's pull request.

- A release pull request is the worst such target, since the mark holds the release and this role may not lift it again

### A refusal

A refusal is a stop. Report the line the shell printed, then resolve the number from the `number=` and `head=` lines of `git-pr`'s output and re-run the command by hand.

The comparison sits in the shell rather than in the session's reading of a printed value, the same split `git-pr`'s `assert_own_pr` makes. The judgment that picked a wrong number is the one that would read the check.

## The read-back

Report what the read returned rather than what the command printed, since the exit says the call ran and says nothing about the state.

- A `true` reports a draft
- A `false` reports the pull request as opened ready and unsupervised, and the chain stops there. The retry already ran, so the read is final.
- Never re-issue the mark on a disagreeing read, which fights whoever readied it instead of guarding anything

Open a stop report on a `false` read with the pull request number and `ready, not a draft`, ahead of anything else, such as `❌ #<number> is ready, not a draft. The mark failed after three tries.` A reader skimming the stop then learns first that a pull request sits open with no review hold.

## Why the backup sits ahead of the watch

Repairing afterwards leaves a missed draft unmarked for the whole CI run, the stretch an unattended worker's branch is least supervised. What the mark buys is a reader learning the pull request has had no review yet.

It buys no bound on that stretch. Readying a pull request to merge lifts the mark, and GitHub requires it before a merge.

- The lift runs through `canon pr lift`, which a reviewer runs on its close and the controlling session runs as the fallback, or through the operator directly
- `role-worker` states the mirroring refusal of an instruction to ready the pull request directly, whoever sends it
