---
name: ui-test
description: Routes each UI change to the test layer that can catch its break, writes end to end tests only for journeys and browser-only behavior, and produces a manual checklist for visual-only items. Use after implementing UI changes, or when asked "what should I test", "what do I verify", or "give me a test checklist". Do NOT use in empty sessions with no implementation context.
---

# UI test

## Guards

- If no implementation context exists in the session, stop: `❌ No implementation context. Describe what you built first.`
- Load `canon:test-craft` before writing any test, and report it rather than proceeding silently when it does not resolve.

## Analysis

Review the session to identify what was built or changed. Categorize each change, then route it:

- **Visual-only:** spacing, alignment, color, typography, layout proportions, animation timing. These become a manual checklist.
- **Journey or browser-only:** a flow across routes, a route change, or a behavior only a real browser renders, such as scroll, focus order across pages, or layout. These become end to end tests.
- **Everything else:** interactions, state transitions, form submissions, keyboard handling, conditional rendering, loading, empty, and error states. Route these through the `test-craft` layer table to a component test, or to a unit test when the logic renders nothing.

Never write an end to end test for a state a component test reaches. Exclude anything already covered by tests written during implementation.

## Component and unit tests

- Read the project's test config and an existing test at the layer first, and follow its runner, suffix, and placement.
- Read the `test-craft` component reference before the first component test.
- Assert each state through what a user sees or does, covering the happy path and the key edges.
- When the project has no component runner, write the checklist item for that state instead of an end to end test, and name the missing runner in the output. Do not fall back to end to end silently.

## E2e tests

Write Playwright tests for journeys and browser-only behavior only. Follow these rules:

- Read the `test-craft` end to end reference before the first one.
- Add tests to the project's existing `e2e/` layout and naming. If none exists, create `e2e/<feature>.spec.ts`.
- Use the project's existing Playwright config and test patterns. Read them first.
- Each test performs a user action across the journey and asserts the expected outcome.
- For Chrome extensions: load the unpacked extension via Playwright's `--load-extension` flag and use the extension's sidepanel or popup URL as the test target.
- Run every test written, at every layer. Fix failures before finishing.

Test structure:

```typescript
test('description of user flow', async ({ page }) => {
  // Arrange: navigate, set up state
  // Act: perform user action
  // Assert: verify expected outcome
})
```

## Manual checklist

For visual-only items that cannot be asserted programmatically, and for any state left without a runner, produce a checklist. Group by feature area. Use `- [ ]` checkbox syntax.

```markdown
**What to verify visually:**

**<Feature area>**

- [ ] <action> → <expected visual result>
```

If every change is covered by a test, skip the manual checklist:

`✅ All changes covered by tests. No manual verification needed.`

### Persist the checklist

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

When a manual checklist is produced, write it directly to `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does. Create the directory if it does not exist. Always overwrite. This is a handoff file rather than a deliverable: `git-pr` posts it as a pull request comment once one opens, then removes it, and nothing here talks to `gh` directly.

From a linked worktree the file-editing tools refuse that path, so the checklist goes out through `Bash`. Send the `mkdir -p` and the heredoc as two plain commands rather than joining them with `&&`, which is refused as compound.

Skip the file write when every change is covered by tests and no checklist was produced.

The `.canon/tmp/` directory is gitignored. Do not stage or commit the file.

## Output order

1. Write and run the tests, naming each one's layer (report pass/fail)
2. Name any state left to the checklist for want of a component runner
3. If a manual checklist was produced, write it to file, then output only the file path in chat:
   `📝 Wrote .canon/tmp/handoff/ui-checklist/<slug>.md`
4. If no checklist was needed: `✅ All changes covered by tests. No manual verification needed.`

Do not repeat the full checklist in chat.
