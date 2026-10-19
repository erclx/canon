---
title: Orchestrator launch runbook
description: The launch every dispatch kind shares, being the build, cloud build, review-address, planning, and talk templates, the session name and controller id each carries, why the command sits at position zero, and what the brief may carry
---

Run this once `orchestrator-dispatch.md` has cleared a row, or from its planning or review-address shape below when that runbook's checks do not bind. The model each template names comes from `## Pick the model` in that runbook.

## Contents

- [Dispatch](#dispatch)
- [Dispatch to a cloud worker](#dispatch-to-a-cloud-worker)
- [Dispatch to address a review](#dispatch-to-address-a-review)
- [Dispatch to plan a row](#dispatch-to-plan-a-row)
- [Dispatch a talk session](#dispatch-a-talk-session)
- [Hand launch](#hand-launch)
- [Dispatch a reviewer](#dispatch-a-reviewer)

## Dispatch

```bash
claude --bg --model <model> -n "worker-<project>-<slug>" "/canon:auto-ship <plan>
Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the pull request opens, carrying the number, the branch, the head sha, the CI state, and every point you departed from the plan on, and message it again if you stop on a question."
```

`--bg, --background` starts the session as a background agent and returns immediately, and `--model` overrides the inheritance `## Pick the model` states. `-n, --name` sets the display name that tells a self-dispatched worker from an operator's own launch in `canon sessions list`.

- Pass `-n` on every dispatch, since a launch omitting it names the session for a fragment of its identifier, its send address and all the operator sees
- The prefix reads `worker-` because that is the role it marks, since a prefix naming another role sends a worker filtering the roster to a sibling or itself
- Nothing matches the prefix programmatically, which keeps a rename down to three strings

### The project and the controller id

`<project>` is the basename of the main worktree root, resolved the way `session-worktree` Step 1 does, since `git rev-parse --show-toplevel` inside a linked worktree returns the worktree path. `claude agents` lists every session on the machine with no path column, so `<project>` is all that tells two fleets apart.

Read `<dispatcher-id>` with `canon sessions list --self --json` and interpolate the row's `sessionId`. Carry the id rather than the name, since a name can be renamed minutes after launch, inside the window a worker announces its pull request in.

- Where the installed CLI answers `--self` with an unknown option, read the `sessionId` from the record the client writes under its configuration directory
- Say which route answered, so the reader knows whether the id was read or inferred

### How the worker resolves the id

The worker resolves that id back to a name through `canon sessions list --json`, which carries `sessionId` per row. The agent listing prints a name and a short ref and no id, so a worker reaching for it first finds no lookup and can conclude there is none.

That failure is silent in both directions. The worker goes idle holding the message it owes, and nothing on this side reports the quiet, so the loss surfaces as a missing worktree or a pull request that never opens.

### No worktree call and no branch

The template carries no worktree call. `auto-ship` Step 0 invokes `canon:role-worker` and then `canon:session-worktree` itself, and neither carries the flag, so both are reachable through the `Skill` tool wherever a call sits in a prompt.

- The autoship call carries `<plan>`, the file `orchestrator-dispatch.md` read to derive the branch, so Step 1 takes it as the caller-supplied plan
- Step 0 runs `canon tasks plan-branch <plan>` on that file and hands the `<type>/<slug>` to `session-worktree` as its tier 0 argument
- The two sides agree by calling one derivation rather than copying a string, and only a binary lacking `plan-branch` derives by prose

### Position zero

Put a command whose skill carries `disable-model-invocation: true` at position zero of the launch prompt, followed by a space and its argument, with nothing before it. The client expands a slash command there as a user invocation, which is the route the flag permits.

- Anything reaching the session as prose falls to the model, which invokes it through the `Skill` tool, a route that answers a flagged skill inconsistently
- `auto-ship` carries the flag
- A comma or other punctuation glued to the command name at position zero has failed to expand, so treat the space as part of the rule

Never depend on the `Skill` tool route for a flagged skill. A refusal there tells the session not to replicate the workflow by other means, so a refused worker stops with a clean worktree, the correct outcome. The refusal is sticky inside a session, so recover by re-dispatching onto the same branch with the build template above.

### Shapes needing no expansion

The review-address and planning shapes below, and the reviewer shapes in `orchestrator-reviewer-launch.md`, depend on no expansion. None of `role-worker`, `review-address`, `role-planner`, `plan-feature`, `role-reviewer`, or `review-pr` carries the flag, so each keeps its leading word whatever the delimiter or position.

The same rule reaches a human relay. Hand an operator one message carrying one command at position zero, since two blocks pasted as separate messages can land as one, where the second never fires.

### What the brief may carry

The prompt carries pointers and standing context, and stops there. The branch and the plan stay arguments, because a skill resolves an argument through a documented ladder and reads no prose at all. What the prose reaches is the worker's judgment, so it holds only what a session has to weigh:

- Name the addressee and what it is owed, which the two message clauses above already do.
- Carry standing context a cold session cannot derive, such as a constraint settled in conversation that never reached the plan
- Leave out anything scope-shaped, such as a file list, a naming convention, or a check, which belongs in the plan the review reads back against the diff
- On a reviewer launch, carry the sibling pull requests in flight, the files each shares with this one, the merge order, and a settled constraint, all as facts
- Leave out this session's read of the change and the author's argument, which cost the dispatch its independence, and any list of what to look for, which is `review-craft`'s

Report the dispatch as loudly as the human-launch line it replaces, naming the branch, the model, the task, and the session name, so a person reading the transcript can follow what fired without watching it happen.

## Dispatch to a cloud worker

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-cloud-launch.md` when `orchestrator-dispatch.md` picked cloud for the row. It holds the prompt that carries the plan as text and announces over GitHub, the create under `script`, and the readout that refuses to record a missing session id.

## Dispatch to address a review

`review-address` is a single pass, not a chain, so a launch naming it alone reaches no `role-worker` and owes no message. Reach the role directly on this launch instead of wrapping a second chain around one skill.

The branch already exists, so this shape skips the plan-derived name and takes `<branch>` off the pull request's own head ref. `<slug>` is the directory name of the original build's worktree, `.claude/worktrees/<slug>/`.

- Enter it with `EnterWorktree`'s `path` form when it is still there, or `git worktree add .claude/worktrees/<slug>/ <branch>` when it was cleaned up
- `EnterWorktree` refuses that path in the ordinary case, since the idle build session holds a harness-level lock the roster does not report
- Work in the folder directly with `Bash`, `Read`, and `Edit` instead of retrying the tool

```bash
claude --bg --model <model> -n "worker-<project>-<slug>" "Enter the worktree for <branch> at .claude/worktrees/<slug>/, creating it from that branch if the folder is gone. Run /canon:role-worker, then /canon:review-address. Your controller is the session whose sessionId is <dispatcher-id>, and your reviewer is the session whose sessionId is <reviewer-id>. Resolve each current name from its id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message the reviewer when the address pass finishes, asking it to re-review and carrying what was addressed and the PR's CI state, and send that to the controller instead when the reviewer's id resolves to no live session. Message the controller if you stop on a question."
```

`<dispatcher-id>`, `<model>`, and `<project>` resolve the same way the build shape resolves them above. `<reviewer-id>` is the sessionId the reviewer's own message carried, so a worker launched fresh answers the reviewer directly.

- Where no local reviewer is live, as a cloud reviewer always leaves, drop the reviewer clause and send the finished message to the controller
- Take this shape wherever a review needs answering and no live session holds the branch. Where one does, message it per the loop's step 6.
- That check is blind to a session working through the direct-path fallback, since it never moves its registered branch off `main`
- `canon sessions list --branch` then reports nothing holding the branch, so a dispatch landing there collides with nothing the check can see

## Dispatch to plan a row

`plan-feature` is a procedure rather than a role, so a launch naming it alone reaches no `role-planner` and owes no message. Reach the role directly, the way the build shape reaches `role-worker`, rather than retyping its obligations as prose.

No branch and no worktree exist here and none is created. A planner writes one gitignored file at the main worktree root, so this shape names the row's task file and opens with the role.

- That write meets the isolation guard as a linked worktree's main-root write does, with no worktree to redirect it to
- `role-planner` therefore sends it as a `Bash` heredoc rather than through `Write`

```bash
claude --bg --model <model> -n "planner-<project>-<slug>" "Run /canon:role-planner, then /canon:plan-feature <task>. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the plan lands, carrying the path and what the task file got wrong, and message it again if you stop on a question."
```

`<task>` is the row's task file path and `<slug>` the slug its plan will take, resolved off the row. `<dispatcher-id>`, `<model>`, and `<project>` resolve as above, and the prefix reads `planner-` because it marks the role of the session it names.

### Which checks bind

None of the three checks in `orchestrator-dispatch.md` binds this shape.

- The branch check has no candidate to read
- The conflict check has nothing to compare, since a planner writes one file no track in flight can hold
- The plan-answer gate reaches no plan, since the planner writes the file a build later reads, so running it would refuse every planning dispatch

What a planning dispatch owes instead is the reverse reading, since a row planned during a wave is planned against a tree that wave is changing. `role-planner` composes the session roster with the pull request list itself, which is why the brief carries no branch list.

### One row per dispatch

A session reused across a batch pays the context load once and ages its picture of the tree while it works, which is why the in-flight read sits on the task rather than the batch. One that compacts mid-batch loses the reasoning behind its earlier plans with nothing reporting it.

Cap a reused session where the saving is worth it and say what the cap was.

## Dispatch a talk session

A planner or worker the operator will talk with takes the same launch as its cold shape above, with a `-talk` suffix on its name and one sentence added to its brief. A cold session works alone and reports back, and a talk session stays open after its plan or pull request lands so the operator can keep shaping the row.

```bash
claude --bg --model <model> -n "planner-<project>-<slug>-talk" "Run /canon:role-planner, then /canon:plan-feature <task>. This is a talk session: the operator will talk with you here, so run your role's talk clause, and message your controller when the operator ends the conversation. Your controller is the session whose sessionId is <dispatcher-id>. ..."
claude --bg --model <model> -n "worker-<project>-<slug>-talk" "/canon:auto-ship <plan>
This is a talk session: the operator will talk with you here, so run your role's talk clause, and message your controller when the operator ends the conversation. Your controller is the session whose sessionId is <dispatcher-id>. ..."
```

The ellipsis stands for the rest of the cold template's message clauses, unchanged. The build variant keeps `/canon:auto-ship <plan>` at position zero with nothing before it, per the rule above.

- Keep the role prefix and add the suffix, since `orchestrator-handoff.md` separates dispatched sessions by `worker-` and `planner-` and a new prefix reads as a hand launch
- A talk session is retired only on the operator's word, stated once in `orchestrator-handoff.md`, so do not restate it in a launch report
- Reviewers get no talk shape, since a reviewer's pass holds no operator dialogue

### Recording the talk session

Read the session's `sessionId` off the launch output, carry it in this session's own context, and write it into the map's `## Talk sessions held open` at the next handoff. The client can rename a session and drop the suffix, so the id is the durable marker and the suffix is only for display.

The map exists only once the handoff writes it, so this session's own launches, read with the prior map, are what the first wind-down reads talk sessions from.

## Hand launch

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-hand-launch.md` when the operator launches sessions by hand. It states the single prompts file at `.canon/tmp/dispatch/prompts.md`, the lean shape of each fence, and a filled example, while the background templates above keep their full controller paragraph.

## Dispatch a reviewer

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-reviewer-launch.md` when `orchestrator-review-dispatch.md` sends a pull request to a dispatched reviewer, for the code, cloud, and UI reviewer shapes.
