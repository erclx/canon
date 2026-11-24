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
5. **Not already filed.** No open feedback issue covers it, and on the board arm no open row does either. A candidate one does cover passes as a follow-up on that issue or open row rather than failing.
6. **Not a plain slip.** Where clear guidance existed and the session missed it, the candidate passes only when the surface made the slip easy.
   - The shortlist names that surface, such as a runbook missing from the index a session is told to read

Test 5 passes on its own when the open-issue or open-row match did not run, with the shortlist saying so.

## Ranking

Rank survivors by observed cost, highest first. Cap the shortlist at five, and move a sixth or later survivor to the dropped list as `over the cap of five`.

## Shape

Render both lists as markdown, so a terminal shows each title in bold and each candidate on three short lines.

```markdown
## Worth filing

**1. <short title>** (<new | follow-up on #n | follow-up on the open row <title>>, <repo>)

- **Cost:** <what it cost this session, with the number>
- **Fix:** <direction, one sentence>

## Dropped

- <candidate>: <the test that dropped it, in plain words>
```

Omit the `## Dropped` heading and its list when nothing was dropped. When the match did not run, put its line above the first heading.
