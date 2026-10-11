import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'session-compact', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(api): scaffold the task API and its board')

      ctx.log.step(
        'Scenario ready: a plain session that only reasoned, about to compact',
      )
      ctx.log.info(
        'Context: the session compared cursor and offset pagination and settled',
      )
      ctx.log.info(
        '  on a cursor, and changed no source. The prompt states that reasoning,',
      )
      ctx.log.info('  since a cold sandbox holds none of its own.')
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:session-compact the task list needs pagination. We measured',
      )
      ctx.log.info(
        '         offset paging against a cursor, chose the cursor because an insert',
      )
      ctx.log.info(
        '         between two page reads shifts every offset row, and left the page',
      )
      ctx.log.info(
        '         size open. Write the handoff, we are about to compact.',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/session-compact/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:session-compact',
      )
      ctx.log.info(
        '         One note under .canon/compact/, nothing new under .canon/tasks/,',
      )
      ctx.log.info('         and no ## State section in the note.')
    },
  },
})
