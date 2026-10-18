---
name: ui-checklist
description: Writes the visual checklist a reviewer reads beside the evidence screenshots, and names each changed behavior shipping with no test so `test-craft` can place one. Use after implementing UI changes, or when asked "what should I look at", "what do I verify", or "give me a visual checklist". Do NOT use in empty sessions with no implementation context, and do NOT use to write the tests themselves.
metadata:
  family: build
---

# UI checklist

## Guards

- If no implementation context exists in the session, stop: `❌ No implementation context. Describe what you built first.`
- This skill writes no test. When a behavior needs one, name it and let `canon:test-craft` place it.

## Analysis

Review the session to identify what was built or changed. Split each change two ways:

- **Visual-only:** spacing, alignment, color, typography, layout proportions, animation timing. These are what the checklist exists for, since nothing asserts them programmatically.
- **Automatable:** interactions, state transitions, forms, keyboard handling, conditional rendering, loading, empty, and error states, journeys across routes, and behavior only a real browser renders.

An automatable change already covered by a test written during implementation is done. What is left is the missing-test list below.

## The checklist

Group visual items by feature area. Use `- [ ]` checkbox syntax, and write each item as the action and the result a person is looking for, so a reviewer who did not build the change can run it.

```markdown
**What to verify visually:**

**<Feature area>**

- [ ] <route>[, <width>]: <verb> <target> → <expected visual result>
```

Write each box so a session driving the running app can run it without guessing:

| Part  | Rule                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route | A path or the control that reaches it. A box naming none is driven from the address the driver opens. Write "from the page the app opens on" for a state reached by a sequence. |
| Width | Only when the change can differ by width, such as layout, spacing, or anything responsive. Copy, color, or a state rendering the same everywhere leaves it off.                 |
| Verb  | An action a driver performs, such as "scroll to", "click", "resize to", or "tab to". Never "read" or "look at", which name no action.                                           |
| Taste | End the line with `(taste)` when the result is a judgment of look or feel. A driver reports such a box as needing a person's eyes rather than passing it.                       |
| Setup | State inline any setup the page does not open in. End the line with `(local only)` when a hosted preview cannot reach that state, such as a stopped service or a seeded record. |

When the plan cites `canon/design/<surface>/` under `**Design references:**`, name the reference as the comparison on each box for that surface, such as "→ matches `canon/design/<surface>/` in light and dark". The reviewer then judges the build against the accepted design instead of against taste.

The checkbox stays `- [ ]` followed by the action and the result, since the evidence comment reads boxes by that shape. Only the UI reviewer ticks a box, stamping it with the commit it passed at, and the comment carries that tick forward only while the head it names is current.

## The missing-test list

Name every automatable change this branch ships with no test, one per line, with the layer `test-craft` would place it at. Do not write the test or read the project's test config to write one against.

- A journey or a browser-only behavior goes to end to end
- A rendered state goes to a component test, and logic that renders nothing to a unit test
- When the project has no runner at that layer, say so on the line rather than moving the item to a layer that does

This list ships inside the checklist file, below the visual items, so a reviewer reads what is untested next to what to look at:

```markdown
**Shipping without a test:**

- <behavior> → <layer> (<runner, or the runner that is missing>)
```

Omit the heading when every automatable change is covered.

## Persist the checklist

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`. Fall back to `latest` on an empty result.

When a checklist is produced, write it to `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root, resolved the way `session-worktree` does, creating the directory if needed and always overwriting.

- It is a handoff file rather than a deliverable. `pr-evidence` renders it into the evidence comment once a pull request opens, then removes it, and nothing here calls `gh`.
- The path names the artifact rather than this skill, so a rename moves nothing and an older binary's checklist lands where the consumer looks
- The checklist is a main-root write, so it goes out as a heredoc, routed the way `session-worktree` states
- Skip the write when there is nothing to verify visually and nothing shipping untested
- `.canon/tmp/` is gitignored, so do not stage or commit the file

## Output order

1. If a checklist was produced, write it to file, then output only the file path in chat:
   `📝 Wrote .canon/tmp/handoff/ui-checklist/<slug>.md`
2. Name the count of visual items and the count of behaviors shipping without a test, on one line each
3. If nothing was produced: `✅ Nothing to verify visually and nothing shipping untested.`

Do not repeat the full checklist in chat.
