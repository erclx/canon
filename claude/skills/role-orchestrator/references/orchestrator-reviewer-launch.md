---
title: Orchestrator reviewer launch runbook
description: The launch shapes that start a reviewer rather than a builder, being the code reviewer, the cloud reviewer, and the UI reviewer driving a pull request's checklist
---

Run this once `orchestrator-review-dispatch.md` has sent a pull request to a dispatched reviewer. The build, review-address, and planning shapes, and the rules every launch shares, stay in `orchestrator-launch.md`.

## Dispatch to review a pull request

`review-pr` is a single pass rather than a role, so a launch naming it alone reaches no `role-reviewer` and owes no message. Reach the role first on this launch, the way the planning shape in `orchestrator-launch.md` reaches `role-planner`. `orchestrator-review-dispatch.md` decides whether a pull request takes this shape at all.

No branch and no worktree are entered here. The reviewer reads the pull request at the head `review-pr` resolves and writes the comment and its body file alone. A reviewer the operator launches by hand takes the `### Reviewer` H3 that `orchestrator-hand-launch.md` states.

```bash
claude --bg --model <model> -n "reviewer-<project>-<number>" "Run /canon:role-reviewer, then /canon:review-pr <number>. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. When the pass posts under ## Review, message the worker holding the branch to run review-address, carrying your own sessionId, and send it to the controller instead when no worker resolves. When it posts ## Review closed, run canon pr lift <number> --json and message the controller with the heading, the count line, and the reason the verb returned, unless that reason names the UI review as still open or missing. Message the controller again if you stop on a question."
```

- `<number>` is the pull request's number, and the brief pins no head, since `review-pr` resolves it and stamps the covered range in its marker
- `<model>` comes from `## Pick the model` in `orchestrator-dispatch.md`, which states the test for a reviewer as for every other role
- `<dispatcher-id>` and `<project>` resolve the same way they do in `orchestrator-launch.md`
- Append the cross-branch facts after the controller clause, per `### What the brief may carry` in `orchestrator-launch.md`
- Check `canon sessions list --json` for a live `reviewer-<project>-<number>` before launching, and message it instead when one holds the pull request

### The channel clauses

The channel clauses restate what `role-reviewer` holds, so a reviewer whose plugin cache predates that body still sends the dispatch itself. The worker reads the reviewer's sessionId off that message and sends its re-review request back to it, since a reviewer holds the trunk branch and no branch lookup finds it.

## Dispatch a review to a cloud reviewer

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-cloud-launch.md` when the operator picked cloud for a code review. Its prompt opens with `/role-reviewer`, carries the cross-branch facts, and makes the posted review the announcement.

## Dispatch to drive a pull request's checklist

`review-ui` is the second pass `role-reviewer` may run, so this shape reaches the role first the way the code reviewer's does. `orchestrator-review-dispatch.md` decides whether a pull request takes it, and it runs beside the code reviewer rather than after it.

```bash
claude --bg --model sonnet -n "reviewer-ui-<project>-<number>" "Run /canon:role-reviewer, then /canon:review-ui <number>. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. When the pass posts under ## UI review, message the worker holding the branch to run review-address, carrying your own sessionId, and send it to the controller instead when no worker resolves. When it posts ## UI review closed, run canon pr lift <number> --json and message the controller with the heading, the count line, and the reason the verb returned, unless that reason names the code review as still open or missing. Message the controller again if you stop on a question."
```

The model is `sonnet`, always, as the UI reviewer line in `## Pick the model` in `orchestrator-dispatch.md` states with its measured reason. `<number>`, `<dispatcher-id>`, and `<project>` resolve the same way they do in `orchestrator-launch.md`.

- The prefix reads `reviewer-ui-` so a roster read for `reviewer-<project>-<number>` never matches it, and the two passes stay two sessions
- Carry no cross-branch facts, since the UI reviewer reads no diff and no code verdict

### What the UI brief may carry

Name an address only when the evidence record carries no `preview` and no `local` field, as `Drive <url>.` after the controller clause. An address the record holds is the one the pass reads first, and a second in the brief is a second source for one fact.

Name a CLI config path the same way when the operator keeps a GPU recipe for this machine, since the pass renders in software otherwise.
