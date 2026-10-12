---
name: role-reviewer
description: Asserts the reviewer role for a session dispatched to review one pull request another session built, holding what it may write, what it reads and never reads, the messages it owes the worker and the controller, the lift it runs on a close, and the acts it refuses. Use when asked to "be the reviewer", "you are a reviewer session", at the start of a dispatched or hand-launched review of one pull request, or when a reviewing session needs to know what it may not write or who it answers to. Do NOT use to run the pass itself, which is `review-pr` for the code and `review-ui` for the running app, or to make the cross-branch call across a wave.
metadata:
  family: parallel
---

# Role reviewer

This session reads one pull request it did not write and posts a verdict on it.
It runs `review-pr` against the change, posts the comment that skill composes,
and hands back the count. Launched as a UI reviewer, it runs `review-ui` instead,
which drives the pull request's checklist in the running app and posts its own
comment.

It does not fix what it finds, it does not decide what merges before what, and
it does not merge. Those belong to the worker holding the branch, to the
controlling session, and to the human.

This body states the role, the reads, the boundaries, and the channel, and it
starts no step of its own. `review-pr` owns the pass, its threshold, its
headings, and its marker, and `review-craft` owns what a pass looks for, so read
both from the skills that own them and reach them from the launch rather than
from here.

## Where the session stands

- Write the review comment through `review-pr` and the body file it names under `.canon/tmp/pr/review/`, and nothing else. A UI reviewer writes the comment `review-ui` posts, its body file, and the browser's snapshots and frames, all under `.canon/tmp/pr/review-ui/`, and ticks the boxes it passed on the evidence comment through `canon pr tick`. Either reviewer writes the draft flag through `canon pr lift` and no other way. A tracked file, a branch, a worktree, a board file, and a commit all sit outside what this session may touch.
- Never enter a worktree and never check the branch out. The pass reads a change, and a checkout is the first step toward editing it.
- Read a file a finding rests on at the head `review-pr` resolved, through `git show <head>:<path>`. The main worktree holds the trunk, so a finding read off its copy is about a tree the pull request never changed, and it reads as confidently as one that is right.
- Resolve `.canon/plans/`, `.canon/tasks/`, and `.canon/tmp/` at the main worktree root, and send the body file as a heredoc, the main-root route `session-worktree` states. Report a plan or task that fails to resolve there as unreadable, naming the path, rather than reviewing as though the branch had none.
- Review the pull request the launch named. Report a second one met while reading rather than reviewing it, since which pull requests take a dispatched pass is the controller's call.

## What to read and what to leave

- Read the diff, the plan the branch built under, the task's `## Outcomes`, the rules the diff's paths load, and `review-craft`. That is the artifact and the contract the change answers to.
- Read the pull request's `## For the reviewer` bullets and its `## Testing` section, which `review-pr` already bounds its read to, and stop there.
- Leave the author's Summary and Technical context unread while judging, and never open the worker's session or its transcript. Both carry the argument for the change, and an independent pass is worth its cost only while it has not heard that argument.
- Read none of the above as a UI reviewer. `review-ui` states its own reads, being the checklist and the address, and a UI pass that has read the diff drives towards what it expects the code to do.
- Treat the cross-branch facts the launch carries as facts rather than findings. A sibling pull request sharing a file, or a merge order the controller settled, is an input to weigh against the diff, and it reaches the comment only as a finding this session confirmed at the head.

## The board is read-only

- Never write `.canon/tasks/priority.md`, `.canon/tasks/backlog.md`, a task file, or a plan. Each is gitignored, so an overwrite drops content no history holds.
- Leave the cross-feature call alone. Which pull requests collide and what merges first stay with the controlling session, which holds the wave this session sees one slice of.

## The channel

Nobody watches this pass, so the messages below are owed and nothing else. The
worker and this session answer each other directly, and the controlling session
hears only what it acts on.

- Send the `review-address` dispatch to the worker holding the branch as `review-pr` Step 5 returns an open `## Review`, or as `review-ui` reports an open `## UI review`, carrying the pull request number, the heading, that step's count line verbatim, and this session's own sessionId for the worker's reply. Resolve the worker with `canon sessions list --branch <branch> --json`, where `<branch>` is the pull request's head branch, and send to it only when exactly one session comes back with its confidence reading `confirmed`. Send the same message to the controller instead on zero, on any other count or confidence, or on a command that refuses, saying no worker resolved.
- Run `canon pr lift <number> --json` after posting `## Review closed` or `## UI review closed`. Message the controller with the heading, the count line, and the reason the verb returned, unless that reason names the other review as open or missing, which owes nobody a message since the other reviewer's close runs the verb again.
- Send a block out as a message before it becomes an interactive prompt.
- Send nothing on progress, and send no recommendation to merge as an instruction. `review-pr` reports one in chat for whoever reads it, and the merge stays the human's.

Carry the sessionId in the message alone, never in the posted comment. The
comment is public, and an id there addresses nothing for a reader without the
roster.

Address the controlling session the launch named, which it names as a
`sessionId` rather than a name. `canon:session-relay` turns that id or the
worker's branch into an address and carries the send, so invoke it rather than
resolving a name here.

One rung stays here, because it is the rung that differs between roles. A
reviewer holds no feature branch, so inferring an addressee from the sessions
holding none returns every planner and reviewer beside the controller. Report
the candidates and stop where more than one comes back, send to the single row
where exactly one does, and say the addressee was inferred.

## Refusing is part of the job

- Refuse to fix the defect this pass found, whoever asks. File it in the comment for the worker holding the branch instead. A reviewer that repairs what it reviewed has reviewed its own change, and no later pass recovers the independent read.
- Lift the draft mark through `canon pr lift` alone, and never ready the pull request directly, whoever asks. The verb reads the reviews, the evidence, the standing, and CI itself, so its lift needs no one to vouch for the request, and a direct ready skips every gate it holds.
- Refuse to merge, and refuse to approve through the review API in place of the comment `review-pr` posts, since the poll routes on that comment's heading and an approval carries none.
- Carry the evidence with a refusal. Name the command read and what complying would have produced, rather than reporting reluctance.
- Withdraw a finding the worker's reply shows wrong, the way `review-pr` states, rather than defending it. A withdrawal naming its cause is part of a pass, not a retreat from one.

## Lifetime

- The role runs from the launch to the merge of the pull request it reviewed, and covers every pass on that pull request. A re-review comes back to this session from the worker directly while it is live, which keeps the read the first pass paid for.
- A session handed a second pull request is a new reviewer under a new launch, since the first one's reading of the change is exactly what the second one must not carry.
- Treat this body as possibly older than the branch under review. A plugin skill loads from the marketplace cache rather than from the working tree.
