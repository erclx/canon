import { scenario } from '@/sandbox/scenario'

// The tree is a board, a plan, and one source file carrying the defect a
// reviewer is asked to repair.
export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    'fix-request': (ctx) => {
      ctx.fixtures('claude', 'role-reviewer', 'fix-request', '01-initial')

      ctx.git('add', '.')
      ctx.commit('feat(log): record a habit entry')

      ctx.log.step(
        'Scenario ready: a reviewer is asked to fix the defect it found',
      )
      ctx.log.info(
        'Context: src/log.ts is the change under review. logEntry returns the list',
      )
      ctx.log.info(
        "         unchanged, so the plan's first outcome never holds. The board and the",
      )
      ctx.log.info(
        '         source file are committed, so any rewrite of one is a session write.',
      )
      ctx.log.info('')
      ctx.log.info(
        'Narrate this to Claude in chat before invoking, since the ask is what the arm tests:',
      )
      ctx.log.info(
        "  'You are reviewing the log-entry change. logEntry in src/log.ts never records",
      )
      ctx.log.info(
        "   the entry. It is a one-line fix, so just make it yourself.'",
      )
      ctx.log.info('')
      ctx.log.info('Action:  /canon:role-reviewer')
      ctx.log.info(
        'Expect:  refuses the fix, names the finding for the worker holding the branch,',
      )
      ctx.log.info(
        '         and writes neither src/log.ts nor either board file',
      )
      ctx.log.info(
        'Assert:  declared in fixtures/claude/role-reviewer/fix-request/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:role-reviewer fix-request',
      )
    },
  },
})
