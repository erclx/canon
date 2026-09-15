---
name: ui-test
description: Generates and runs Playwright e2e tests for UI changes, with a manual checklist for visual-only items. Use after implementing UI changes, or when asked "what should I test", "what do I verify", or "give me a test checklist". Do NOT use in empty sessions with no implementation context.
---

# UI test

## Guards

- If no implementation context exists in the session, stop: `❌ No implementation context. Describe what you built first.`

## Analysis

Review the session to identify what was built or changed. Categorize each change:

- **Automatable:** interactions, state transitions, form submissions, keyboard navigation, conditional rendering, error states, empty states, loading states. These become Playwright e2e tests.
- **Visual-only:** spacing, alignment, color, typography, layout proportions, animation timing. These become a manual checklist.

Exclude anything already covered by unit or component tests written during implementation.

## E2e tests

Write Playwright tests for all automatable changes. Follow these rules:

- Add tests to the existing e2e test file. If none exists, create `e2e/ui.test.ts`.
- Use the project's existing Playwright config and test patterns. Read them first.
- Each test should perform a user action and assert the expected outcome.
- Cover both happy path and key edge cases (empty state, error state, boundary input).
- For Chrome extensions: load the unpacked extension via Playwright's `--load-extension` flag and use the extension's sidepanel or popup URL as the test target.
- Run the tests after writing them. Fix failures before finishing.

Test structure:

```typescript
test('description of user flow', async ({ page }) => {
  // Arrange: navigate, set up state
  // Act: perform user action
  // Assert: verify expected outcome
})
```

## Manual checklist

For visual-only items that cannot be asserted programmatically, produce a checklist. Group by feature area. Use `- [ ]` checkbox syntax.

```markdown
**What to verify visually:**

**<Feature area>**

- [ ] <action> → <expected visual result>
```

If all changes are automatable, skip the manual checklist:

`✅ All changes covered by e2e tests. No manual verification needed.`

### Persist the checklist

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

When a manual checklist is produced, write it directly to `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does. Create the directory if it does not exist. Always overwrite. This is a handoff file rather than a deliverable: `git-pr` posts it as a pull request comment once one opens, then removes it, and nothing here talks to `gh` directly.

From a linked worktree the file-editing tools refuse that path, so the checklist goes out through `Bash`. Send the `mkdir -p` and the heredoc as two plain commands rather than joining them with `&&`, which is refused as compound.

Skip the file write when all changes are covered by e2e tests and no checklist was produced.

The `.canon/tmp/` directory is gitignored. Do not stage or commit the file.

## Output order

1. Write and run e2e tests (report pass/fail)
2. If a manual checklist was produced, write it to file, then output only the file path in chat:
   `📝 Wrote .canon/tmp/handoff/ui-checklist/<slug>.md`
3. If no checklist was needed: `✅ All changes covered by e2e tests. No manual verification needed.`

Do not repeat the full checklist in chat.
