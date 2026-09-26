---
title: Orchestrator launch runbook
description: The launch every dispatch kind shares, being the build, review-address, planning, and reviewer templates, the session name and controller id each carries, why the command sits at position zero, and what the brief may carry
---

Run this once `orchestrator-dispatch.md` has cleared a row, or from its planning, review-address, or reviewer shape below when that runbook's checks do not bind. The model each template names comes from `## Pick the model` in that runbook.

## Dispatch

```bash
claude --bg --model <model> -n "worker-<project>-<slug>" "/canon:auto-ship <plan>
Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the pull request opens, carrying the number, the branch, the head sha, the CI state, and every point you departed from the plan on, and message it again if you stop on a question."
```

`--bg, --background` starts the session as a background agent and returns immediately, `-n, --name` sets the display name that tells a self-dispatched worker from an operator's own launch in `canon sessions list`, and `--model` overrides the inheritance `## Pick the model` states. Pass `-n` on every dispatch rather than letting the client derive one. A launch that omits it leaves the session named for a fragment of its own identifier, which is both its address on the send channel and the whole of what the operator sees for it in agent view.

The prefix reads `worker-` because that is the role it marks. A prefix naming a role the session does not hold sends a worker filtering the roster for that string to a sibling or itself on every row. Nothing matches the prefix programmatically, which keeps a rename down to three strings.

`<project>` is the basename of the main worktree root, not of wherever the dispatcher happens to be running. Resolve the main root first, the way `session-worktree` Step 1 does, since a bare `git rev-parse --show-toplevel` inside a linked worktree returns the worktree path rather than the project's. `claude agents` lists every session on the machine with no path column and no per-project filter, so `<project>` in the name is the only thing left telling two fleets apart.

Read `<dispatcher-id>` with `canon sessions list --self --json` and interpolate the `sessionId` that row carries. Carry the id rather than the name. A name is derived from whatever the session turned out to be doing and can be renamed minutes after launch, inside the window a worker announces its pull request in, so a name written into the prompt is aimed at a send that happens after it goes stale.

Where the installed CLI answers `--self` with an unknown option, that flag is newer than the release the target holds. Read the `sessionId` from the record the client writes for this session under its configuration directory, and say which route answered so the reader knows whether the id was read or inferred.

The worker resolves that id back to a name through `canon sessions list --json`, which carries `sessionId` per row, rather than through the agent listing, which prints a name and a short ref and no id at all. A worker reaching for the listing first therefore finds no lookup and can conclude there is none. That failure is silent in both directions: the session has nothing useful to do with the message it owes and goes idle holding it, and nothing on this side reports the quiet, so the loss surfaces as a missing worktree or a pull request that never opens rather than as anything watching for it.

The template carries no worktree call. `auto-ship` Step 0 invokes `canon:role-worker` and then `canon:session-worktree` itself, and neither carries the flag, so both are reachable through the `Skill` tool regardless of where a call to them would sit in a prompt. The autoship call carries `<plan>`, the same file `orchestrator-dispatch.md` read to derive the branch, so its Step 1 takes it as the caller-supplied plan rather than re-deriving one from the slug the worker's branch happens to carry.

The template names no branch, and it does not need to. `auto-ship` Step 0 runs `canon tasks plan-branch <plan>` on the same file the candidate was derived from, and hands the `<type>/<slug>` it reports to `session-worktree` as its tier 0 argument, so the two sides agree by calling one derivation rather than by a string copied between them. What still travels on judgment is the fallback: a worker whose installed binary carries no `plan-branch` derives by prose.

### Position zero

Put a command whose skill carries `disable-model-invocation: true` at position zero of the launch prompt, followed by a space and its argument, with nothing before it. The client expands a slash command there as a user invocation, which is the route the flag permits. Anything reaching the session as prose falls to the model, which invokes it through the `Skill` tool, and that route answers a flagged skill inconsistently. `auto-ship` carries the flag. A comma or other punctuation glued to the command name at position zero has failed to expand, so treat the space as part of the rule until a dispatch shows otherwise.

Never depend on the `Skill` tool route for a flagged skill. A refusal there tells the session not to replicate the workflow by other means, so a refused worker stops with a clean worktree, which is the correct outcome. The refusal is sticky inside a session, so recovery belongs to whoever writes the next prompt: re-dispatch onto the same branch with the build template above.

The review-address, planning, and reviewer shapes below depend on no expansion at all. None of `role-worker`, `review-address`, `role-planner`, `plan-feature`, `role-reviewer`, or `review-pr` carries the flag, so all three correctly keep their leading word regardless of the delimiter or the position it sits at.

The same rule reaches a human relay. Hand an operator one message carrying one command at position zero, since two chained blocks pasted as separate messages can land as one, where everything after the first command's name reads as that command's argument and the second never fires.

### What the brief may carry

The prompt carries pointers and standing context, and stops there. The branch and the plan stay arguments, because a skill resolves an argument through a documented ladder and reads no prose at all. What the prose reaches is the worker's judgment, so it holds only what a session has to weigh:

- Name the addressee and what it is owed, which the two message clauses above already do.
- Carry standing context this session holds that a cold one cannot derive, such as a constraint settled in conversation that never reached the plan.
- Leave out anything scope-shaped. A file list, a naming convention, or a check to run belongs in the plan, where the review reads it back against the diff. Scope that arrives as prose is scope nothing verifies afterward.
- On a reviewer launch, carry the sibling pull requests in flight, the files each shares with this one, the merge order, and a constraint settled in conversation, all as facts. Leave out this session's own read of the change, the author's argument for it, and any list of what to look for, since the first two cost the independence the dispatch pays for and the third is `review-craft`'s.

Report the dispatch as loudly as the human-launch line it replaces: name the branch, the model, the task, and the session name, so a person reading the transcript can follow what fired without watching it happen.

## Dispatch to address a review

`review-address` is a single pass, not a chain, so a launch naming it alone reaches no `role-worker` and takes no role, which owes no message either. Reach the role directly on this launch instead of wrapping a second chain around one skill that has none of its own.

The branch already exists here, opened by whatever built it, so this shape skips the plan-derived name the build shape resolves above. Take `<branch>` off the pull request's own head ref. Enter the worktree the original build left on disk, `.claude/worktrees/<slug>/`, with `EnterWorktree`'s `path` form when it is still there, or `git worktree add .claude/worktrees/<slug>/ <branch>` when it was cleaned up, so `<slug>` is that directory name either way.

`EnterWorktree` refuses that path in the ordinary case, because the original build session stays registered against its own worktree after going idle and holds a harness-level lock the roster does not report. Work in the folder directly with `Bash`, `Read`, and `Edit` instead of retrying the tool.

```bash
claude --bg --model <model> -n "worker-<project>-<slug>" "Enter the worktree for <branch> at .claude/worktrees/<slug>/, creating it from that branch if the folder is gone. Run /canon:role-worker, then /canon:review-address. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the address pass finishes, carrying what was addressed and the PR's CI state, and message it again if you stop on a question."
```

`<dispatcher-id>`, `<model>`, and `<project>` resolve the same way the build shape resolves them above.

Take this shape wherever a review needs answering and no live session already holds the branch. Where one does, message it to run `review-address` instead, per the loop's own step 6, since a session already there needs no second one dispatched onto the same branch.

That check is blind to a session working through the direct-path fallback above, since a session that never runs `EnterWorktree` never moves its registered branch off `main`, so `canon sessions list --branch` reports nothing holding it. A dispatch landing on a branch worked that way collides with nothing the check can see.

## Dispatch to plan a row

`plan-feature` is a procedure rather than a role, so a launch naming it alone reaches no `role-planner` and takes no role, which owes no message either. Reach the role directly on this launch, the way the build shape above reaches `role-worker`, rather than retyping the role's obligations as prose into each launch.

No branch and no worktree exist here and none is created. A planner writes one gitignored file at the main worktree root, so this shape names the row's task file rather than a branch and opens with the role instead of a worktree call. That write meets the isolation guard the same way a linked worktree's main-root write does, with no worktree here to redirect it to, so `role-planner` sends it as a `Bash` heredoc rather than through `Write`.

```bash
claude --bg --model <model> -n "planner-<project>-<slug>" "Run /canon:role-planner, then /canon:plan-feature <task>. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the plan lands, carrying the path and what the task file got wrong, and message it again if you stop on a question."
```

`<task>` is the row's task file path and `<slug>` the slug its plan will take, resolved off the row the way the build shape resolves one off a plan. `<dispatcher-id>`, `<model>`, and `<project>` resolve the same way they do above. The prefix reads `planner-` for the reason the worker's reads `worker-`, which is that it marks the role of the session it names rather than the one that launched it.

None of the three checks in `orchestrator-dispatch.md` binds this shape. The branch check has no candidate to read, and the disjointness gate has nothing to compare, since a planner writes one file no track in flight can hold. The plan-answer gate reaches no plan at all, because the planner is dispatched to write the file a build would later read, so running it here would refuse every planning dispatch over a plan nobody has written yet.

What a planning dispatch owes instead is the reverse reading, because the plan it produces carries a constraint per track in flight and a row planned during a wave is planned against a tree that wave is changing. `role-planner` composes the session roster with the pull request list for that read rather than reading pull requests alone, which is why the brief carries no branch list for it: the planner takes this reading itself either way.

One row per dispatch. A session reused across a batch pays the context load once and ages its picture of the tree while it works, which is what puts the in-flight read on the task rather than on the batch, and one that compacts mid-batch loses the reasoning behind its earlier plans with nothing reporting it. Cap a reused session where the saving is worth it and say what the cap was.

## Dispatch to review a pull request

`review-pr` is a single pass rather than a role, so a launch naming it alone reaches no `role-reviewer` and owes no message. Reach the role first on this launch, the way the planning shape reaches `role-planner`. `orchestrator-review-dispatch.md` decides whether a pull request takes this shape at all.

No branch and no worktree are entered here. The reviewer reads the pull request at the head `review-pr` resolves and writes the comment and its body file alone.

```bash
claude --bg --model <model> -n "reviewer-<project>-<number>" "Run /canon:role-reviewer, then /canon:review-pr <number>. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the pass posts, carrying the heading and the count line, and message it again if you stop on a question."
```

`<number>` is the pull request's number, and the brief pins no head, since `review-pr` resolves the head itself and stamps the range it covered in its marker. `<dispatcher-id>`, `<model>`, and `<project>` resolve the same way they do above. Append the cross-branch facts after the controller clause, per `### What the brief may carry`.

Check `canon sessions list --json` for a live `reviewer-<project>-<number>` before launching, and message that session instead when one holds the pull request.
