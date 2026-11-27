---
title: Planning output
description: The two output modes of plan-change Step 4, the checks on a written plan, the chat output with its Next table, and the shape of a discussion round
---

# Planning output

Applies to `plan-change` Step 4, after Step 3 built the plan, and to the discussion rounds that follow it. The body decides the mode, and this file carries what each mode writes and says.

## Step 4: output

Each mode below follows the body's Small and Full test.

### Small mode

When a caller asks for a file, write it as Full mode does and name the mode, since the caller builds on it. Markers match the standard's.

```markdown
## Weight

- **Weight:** <light, medium, or heavy>
- **Reason:** <the criterion that fired>

## Files to touch

- `path/to/file`: reason

## Verification

- <outcome>: `<test or command that proves it>`

## Questions

1. <question>
   - Suggested: <pick>, <reason or tradeoff>
   - Evidence: `<command or path>` <what it shows>, or none, <reason>
   - Answer:
```

Keep `## Questions` only for a real question, each with its `- Suggested:` line, its `- Evidence:` line, and its `- Answer:` slot. Small mode carries no `## Review focus`, since its Risks came out empty. Omit empty sections, and print no `None identified.` in chat.

### Full mode

Derive a 2-to-4-word kebab-case slug from the feature description. Write the plan to `.canon/plans/feature-<slug>.md` at the main worktree root, resolved the way `session-worktree` does, creating the directory if needed.

The plan is a main-root write, from a linked worktree and from a background session at the main root alike, so it goes out as a heredoc routed the way `session-worktree` states. Copy the shape from the template in `${CLAUDE_SKILL_DIR}/references/plan.md` rather than from this file, so one edit to the standard moves every plan.

### Checking the written plan

Two commands check the file once it lands, and both write nothing.

- Run `canon records validate plans feature-<slug>` when the CLI is on PATH. Its `findings` name a section, a filename, or an answer slot that does not hold.
- Fix each entry its `structure` and `evidence` arrays name before reporting, against `### Structure` and `## The suggested-and-answer contract` in `${CLAUDE_SKILL_DIR}/references/plan.md`
- Read those arrays rather than the exit code, since neither sets the exit
- Say the check did not run when the binary refuses the plan argument or carries no `structure` key, rather than reporting the plan clean
- Run `canon markdown audit .canon/plans/feature-<slug>.md`, naming the file, since the gitignored plan reaches no other gate. Rewrite a hit's sentence rather than swapping the token.

When Step 1 resolved an existing task, run `canon tasks plan-link <task> .canon/plans/feature-<slug>.md` right after the file lands, naming the stem Step 1 read. Skip it when Step 1 found no task, and report a refusal rather than stopping, since `canon tasks validate` still catches an unlinked task through `plan-uncited`.

### Chat output

Then output in chat:

```markdown
📝 Wrote .canon/plans/feature-<slug>.md

## Questions

1. <question>
   - Suggested: <pick>, <reason or tradeoff>

Next: <line from the table below>
```

Pick the `Next:` line from the roster check `${CLAUDE_SKILL_DIR}/../task-board/SKILL.md` states under `### Check for a live orchestrator`, read there rather than restated here.

| Roster read                                                                | `Next:` line                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Found**                                                                  | `<name> places and dispatches <task>`, naming the orchestrator row the check matched                 |
| **Not found**, and this session's name starts with `worker-` or `planner-` | `Hand <task> to a worker`, naming no session, since none is live and the operator dispatches by hand |
| **Not found otherwise**, or the read fails                                 | `/session-worktree`                                                                                  |

Three rules apply to the `Next:` choice:

- With a live orchestrator and no planner role held, send the plan path to it through `canon:session-relay`, resolved from its `sessionId`
- A session holding `canon:role-planner` already owes that announcement through its own channel, so it sends none
- Say which row fired in one clause, since a line with no stated reason is one the next reader re-derives.

Show only the path line and the `Next:` line when there are no questions.

## Discussion rounds

After the plan is written, the user may re-ping with follow-up questions or pushback.

- State each pick as one-line pick plus one-line reason. Section headers, context blocks, and multi-section breakdowns belong in the plan file.
- Put numbered decisions to resolve at the bottom of the response, not interleaved with findings
- When a finding needs more than two lines, update `.canon/plans/feature-<slug>.md` in place and point the user at the file
