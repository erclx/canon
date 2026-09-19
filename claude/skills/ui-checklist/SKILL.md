---
name: ui-checklist
description: Writes the visual checklist a reviewer reads beside the evidence screenshots, and names each changed behavior shipping with no test so `test-craft` can place one. Use after implementing UI changes, or when asked "what should I look at", "what do I verify", or "give me a visual checklist". Do NOT use in empty sessions with no implementation context, and do NOT use to write the tests themselves.
---

# UI checklist

## Guards

- If no implementation context exists in the session, stop: `❌ No implementation context. Describe what you built first.`
- This skill writes no test. When a behavior needs one, name it and let `canon:test-craft` place it.

## Analysis

Review the session to identify what was built or changed. Split each change two ways:

- **Visual-only:** spacing, alignment, color, typography, layout proportions, animation timing. These are what the checklist exists for, since nothing asserts them programmatically.
- **Automatable:** interactions, state transitions, form submissions, keyboard handling, conditional rendering, loading, empty, and error states, plus journeys across routes and behavior only a real browser renders.

An automatable change already covered by a test written during implementation is done. What is left is the missing-test list below.

## The checklist

Group visual items by feature area. Use `- [ ]` checkbox syntax, and write each item as the action and the result a person is looking for, so a reviewer who did not build the change can run it.

```markdown
**What to verify visually:**

**<Feature area>**

- [ ] <action> → <expected visual result>
```

## The missing-test list

Name every automatable change this branch ships with no test, one per line, with the layer `test-craft` would place it at. Do not write the test and do not read the project's test config to write one against.

Route each through the `test-craft` layer table: a journey or a browser-only behavior to end to end, a rendered state to a component test, and logic that renders nothing to a unit test. When the project has no runner at that layer, say so on the line rather than moving the item to a layer that does.

This list ships inside the checklist file, below the visual items, so a reviewer reads what is untested next to what to look at:

```markdown
**Shipping without a test:**

- <behavior> → <layer> (<runner, or the runner that is missing>)
```

Omit the heading when every automatable change is covered.

## Persist the checklist

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

When a checklist is produced, write it directly to `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does. Create the directory if it does not exist. Always overwrite. This is a handoff file rather than a deliverable: `git-pr` renders it into the evidence comment once a pull request opens, then removes it, and nothing here talks to `gh` directly.

The path names the artifact rather than this skill, so it does not move when the skill is renamed. A checklist written by an older binary still lands where the consumer looks.

From a linked worktree the file-editing tools refuse that path, so the checklist goes out through `Bash`. Send the `mkdir -p` and the heredoc as two plain commands rather than joining them with `&&`, which is refused as compound.

Skip the file write when there is nothing to verify visually and nothing shipping untested.

The `.canon/tmp/` directory is gitignored. Do not stage or commit the file.

## Output order

1. If a checklist was produced, write it to file, then output only the file path in chat:
   `📝 Wrote .canon/tmp/handoff/ui-checklist/<slug>.md`
2. Name the count of visual items and the count of behaviors shipping without a test, on one line each
3. If nothing was produced: `✅ Nothing to verify visually and nothing shipping untested.`

Do not repeat the full checklist in chat.
