---
title: Orchestrator design launch
description: The launch for a design session, being an app drive or a sketch round run under the planner role, always as a talk session, the name it takes, and how a pick reaches a worker
---

# Dispatch a design session

A design session is a planner whose record is an app drive under `app-drive` or a sketch round under `design-pick`. It writes intake items and board frames, and never a tracked file. Like a planning launch, it takes no branch and no worktree, and none of the three checks in `orchestrator-dispatch.md` binds it.

Launch it as a talk session every time, since the operator judges a design by looking and only the operator can make a round's pick. The talk sentence and the `-talk` suffix come from `orchestrator-talk-launch.md`.

```bash
claude --bg --model <model> --effort <effort> -n "planner-<project>-design-<topic>-talk" "Run /canon:role-planner, then /canon:design-pick <ask>. This is a talk session: the operator will talk with you here, so run your role's talk clause, and message your controller when the operator ends the conversation. Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the pick is made, carrying the winning arm's frame refs and the page ref, and message it again if you stop on a question."
```

A drive swaps the middle of the brief to `/canon:app-drive <target>` and asks for the ready list in place of the pick, which that skill's close sends.

## What differs from a planning launch

- `<topic>` names the surface or the build, such as a logo or a release tag, since neither record has a task row to take a slug from
- `<ask>` is the decision the round settles and `<target>` the build the drive runs, each stated as the operator put it
- The name keeps the `planner-` prefix, since `orchestrator-handoff.md` and the skills that branch on a dispatched planner already read it, and the `design-` segment is what a reader tells it apart by
- Never launch one cold. A drive asks the operator for missing config and closes only on their word, and both skills ask each pick through the question tool a cold launch denies.
- Record no task, since the launch names none. The session's close hands back what its record produced.

## Landing the pick

A design session never applies its pick, per `role-planner`. On the pick message, file the landing as a row and plan it, so a worker lands the winning arm through `design-record` in a pull request the reviewers read. The `ui-audit` and `ui-measure` skills take no launch of their own, since each runs inside another skill.
