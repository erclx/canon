import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.info(
      'file  : raw dump in notes/, a CLI to measure it against, one live board task',
    )
    ctx.log.info(
      'route : one question nobody can answer from the tree, phrased as a dump',
    )
  },
  arms: {
    file: (ctx) => {
      ctx.fixtures('claude', 'plan-intake', 'file', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(cli): build and serve commands')

      ctx.log.step('Scenario ready: a brain dump filed into an intake folder')
      ctx.log.info('Context: notes/dump.md carries eight unmeasured complaints')
      ctx.log.info(
        '  src/ holds what they are about: console writes in three files, a',
      )
      ctx.log.info(
        '  log module nobody imports, and a hand-rolled flag loop in two commands',
      )
      ctx.log.info(
        '  CLAUDE.md already states that logs go to stderr, so one item is settled',
      )
      ctx.log.info(
        '  .canon/tasks/v01.0-error-envelope.md already owns the error item',
      )
      ctx.log.info(
        '  One item needs three builds measured, so it belongs to groundwork',
      )
      ctx.log.info(
        '  src/cli.ts runs, so a trailing --out prints building into dist and',
      )
      ctx.log.info('  the last bullet can be reproduced by one command')
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:plan-intake file notes/dump.md as the cli-cleanup intake',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/plan-intake/file/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:plan-intake file',
      )
      ctx.log.info(
        '         A folder at .canon/intake/01-cli-cleanup/ with 00-overview.md',
      )
      ctx.log.info(
        '         carrying frontmatter, a date, and links to numbered cluster',
      )
      ctx.log.info(
        '         files named for their domain. Every write lands inside the',
      )
      ctx.log.info('         folder, and the reply reports the routing split.')
      ctx.log.info(
        '         Six expectations need a reader and report as unchecked.',
      )
    },
    route: (ctx) => {
      ctx.fixtures('claude', 'plan-intake', 'route', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(cli): build command')

      ctx.log.step(
        'Scenario ready: intake refuses a question that needs measuring',
      )
      ctx.log.info(
        'Context: one question, not a set of findings, and no read of the tree',
      )
      ctx.log.info(
        '  answers it. Costing three parser rewrites takes builds, not greps.',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:plan-intake should we move the CLI onto a real argument',
      )
      ctx.log.info('         parser, and what does it cost in bundle size')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/plan-intake/route/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:plan-intake route',
      )
      ctx.log.info(
        '         The skill declines and routes to /plan-groundwork.',
      )
      ctx.log.info('         NO folder under .canon/intake/, .canon/plans/, or')
      ctx.log.info('         .canon/groundwork/.')
      ctx.log.info(
        '         Three expectations need a reader and report as unchecked.',
      )
    },
  },
})
