---
title: Failure recovery
description: The recovery canon-rollout takes at each stop point, from an absent gh to a target that fails to converge
---

# Failure recovery

The stops of `canon-rollout`. The session reads this file on any stop, for the recovery that stop point takes.

| Stop point                              | Recovery                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `gh` absent                             | Install it and authenticate, then re-run the wave                                             |
| Target index unknown                    | Re-run with `--sweep <root...>` and read the `bound` before trusting the count                |
| Every clone of a target is behind       | Pull that clone, or name a current one, then dispatch that target alone                       |
| Claim check refuses or reads unverified | Launch that target's worker by hand and report that it went out outside the check             |
| Branch already claimed in a target      | Resolve what holds `chore/agents` there, then dispatch that target alone                      |
| A target refuses the pull read          | Read the `reason`, repair it, and re-poll that target. Never record it as having no work      |
| Diff too large to review here           | Dispatch a reviewer into that clone and route its findings back through Phase 3               |
| Two sessions hold one branch            | Report both and stop. Sending findings to either puts two sessions on one ref                 |
| A target fails to converge              | Stop that target's loop, report the rounds it took and what each pass found, and hand it over |
