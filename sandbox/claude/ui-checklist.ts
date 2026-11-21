import { scenario } from '@/sandbox/scenario'

/**
 * No project copy of the corpus, so `ui-checklist` falls back to the plugin's
 * slug standard and the branch name fixes the checklist path `expect.toml` asserts.
 * The `02-task-filter` fixture keeps the filter input mounted beside the empty state.
 */
export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'ui-checklist', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(ui): task list')

      ctx.git('checkout', '-b', 'feat/task-filter', '-q')

      // `TaskList` gains states, a route, and a visual change, all three needed for a checklist.
      ctx.fixtures('claude', 'ui-checklist', 'shared', '02-task-filter')

      ctx.git('add', '.')
      ctx.commit('feat(ui): filter tasks and handle the empty state')

      ctx.log.step(
        'Scenario ready: UI change with an automatable and a visual half',
      )
      ctx.log.info('Context: feat/task-filter, one commit ahead of main')
      ctx.log.info(
        '  component   : loading state, empty state, list count after filtering',
      )
      ctx.log.info('  end to end  : the route change to /archive')
      ctx.log.info(
        '  visual only : 12px gap, 16px padding, muted empty-state color',
      )
      ctx.log.info('')
      ctx.log.info(
        'This arm also checks the slug reference citation, not the skill alone.',
      )
      ctx.log.info(
        '  the target holds no copy, so the skill must reach the plugin copy',
      )
      ctx.log.info(
        '  the slug transform lives only in the slug standard, never in the skill body',
      )
      ctx.log.info(
        '  so .canon/tmp/handoff/ui-checklist/task-filter.md is evidence it resolved',
      )
      ctx.log.info(
        '  expect.toml asserts that exact path, so the checker reads it for you',
      )
      ctx.log.info('')
      ctx.log.info(
        'The Playwright and vitest scaffold stays in the fixture on purpose.',
      )
      ctx.log.info(
        'The skill writes no test now, so a run that installs a runner or adds',
      )
      ctx.log.info(
        'a spec has gone past its job. The write scope is what catches that:',
      )
      ctx.log.info(
        'e2e/ and the component test glob are outside it, so either write',
      )
      ctx.log.info('reports as a violation rather than as coverage.')
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:ui-checklist I added a filter input, a loading state, an empty state, and a link to the archive route to TaskList, and restyled its spacing',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/ui-checklist/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:ui-checklist',
      )
    },
  },
})
