import { scenario } from '@/sandbox/scenario'

/**
 * A plan that retries a CI install whose failures are upstream. The failure
 * log bunches by day, another repository fails on the same days, and an
 * earlier cache never saved, so every answer the critique needs sits in the
 * tree and the prompt names none of it.
 */
export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    retry: (ctx) => {
      ctx.fixtures('claude', 'proposal-critique', 'retry', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs(plan): propose a retry for the browser install')

      ctx.log.step('Scenario ready: a retry plan for an upstream failure')
      ctx.log.info(
        'Context: PLAN.md retries the browser install, and ci/install-failures.md',
      )
      ctx.log.info(
        '         shows the failures bunched on three days at the apt mirror.',
      )
      ctx.log.info('Action:  /canon:proposal-critique PLAN.md')
      ctx.log.info(
        'Expect:  every group asked, ending on probe first or stop, PLAN.md unchanged.',
      )
      ctx.log.info(
        '         Declared in fixtures/claude/proposal-critique/retry/expect.toml.',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:proposal-critique retry',
      )
    },
  },
})
