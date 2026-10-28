---
title: Orchestrator reviewer launch runbook
description: The launch shapes that start a reviewer rather than a builder, being the code reviewer, the cloud reviewer, the UI reviewer driving a pull request's checklist, and the batch shapes holding several small pull requests
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
- Check `canon sessions list --json` before launching for a live `reviewer-<project>-` session whose trailing numbers include `<number>`, and message it instead when one holds the pull request

### Record the reviewer on the task

A reviewer writes no task file, so this session names it on the task the pull request closes, through the sessionId the launch output carries:

```bash
canon tasks session <reviewer-id> <task> --json
```

Record the UI reviewer below the same way after its launch, and a batch reviewer on every task its batch closes, one call per task. A `no-name` refusal means the reviewer exited before the read, so rerun with `--name` and the name the launch passed to `-n`.

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

## Dispatch a batch to one reviewer

`orchestrator-review-dispatch.md` decides when small pull requests share a reviewer pair. The batch shapes run the single shapes above once per number, in the order the name lists them.

```bash
claude --bg --model <model> -n "reviewer-<project>-<n1>-<n2>" "Run /canon:role-reviewer, then run /canon:review-pr once for each of <n1> <n2>, in that order, posting each verdict on its own pull request and never one comment across the set. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. When a pass posts under ## Review, message the worker holding that pull request's branch to run review-address, carrying your own sessionId and the number, and send it to the controller instead when no worker resolves. When a pass posts ## Review closed, run canon pr lift <that number> --json and message the controller with the number, the heading, the count line, and the reason the verb returned, unless that reason names the UI review as still open or missing. A re-review request names one number, so re-run that pass alone. Message the controller again if you stop on a question."
```

- The name lists every number, so the live check and the handback match a number among the trailing ones
- `canon pr lift` runs once per number on that number's close, so a closed pull request lifts while another in the batch stays open
- Append each pull request's cross-branch facts after the controller clause, prefixed with its number

### The UI batch shape

The UI reviewer takes `reviewer-ui-<project>-<n1>-<n2>` and `review-ui` once per number, with the code shape's clauses for that family. Name only the pull requests whose evidence record carries a checklist, since a pass on one without a checklist stops on arrival.

- The model is `sonnet`, as for the single UI shape
- `canon pr lift` runs once per number on that number's `## UI review closed`, unless the reason names the code review as still open or missing
