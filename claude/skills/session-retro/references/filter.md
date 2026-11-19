---
title: Retro filter
description: The six tests a session-retro candidate must pass to be proposed, and the fixed shape of the shortlist and the dropped list
---

# Retro filter

Applies to every candidate `session-retro` collects. A candidate is proposed only when all six tests hold. Run them in order and stop at the first that fails, recording it.

## Tests

1. **Observed cost.** The friction cost this session something that happened. A plausible failure names nothing.
   - The cost is an extra session, an extra review round, a wait, a wrong output, or an operator intervention
2. **Toolkit cause.** A skill, the CLI, a rule, a template, or a default caused it.
   - Friction the project caused fails here, and is offered for the project's own board through `task-board` instead
3. **Recurs.** It was seen twice or more, or once on a path every later session takes, such as a fixed default or a contract step.
4. **Fix direction.** A concrete change can be named, even roughly.
5. **Not already filed.** No open feedback issue covers it. A candidate one does cover passes as a follow-up on that issue rather than failing.
6. **Not a plain slip.** Where clear guidance existed and the session missed it, the candidate passes only when the surface made the slip easy.
   - The shortlist names that surface, such as a runbook missing from the index a session is told to read

Test 5 passes on its own when the open-issue match did not run, with the shortlist saying so.

## Ranking

Rank survivors by observed cost, highest first. Cap the shortlist at five, and move a sixth or later survivor to the dropped list as `over the cap of five`.

## Shape

Show both lists in this form, one line per candidate.

```plaintext
Worth filing
1. <surface>: <observed cost>. Fix: <direction>. <new | follow-up on #<n>>

Considered and dropped
- <candidate>: <test that dropped it>
```

Omit the dropped list when nothing was dropped. When the match did not run, put its line above `Worth filing`.
