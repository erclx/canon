import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.info(
      "mark    : board with three tasks, HEAD ships one task's open outcome",
    )
    ctx.log.info('archive : board with one shipped task and one still open')
  },
  arms: {
    mark: (ctx) => {
      ctx.fixtures('claude', 'task-complete', 'mark', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(api): rate limit the task endpoints')

      ctx.fixtures('claude', 'task-complete', 'mark', '02-pagination')
      ctx.git('add', '.')
      ctx.commit('feat(api): paginate the task list')

      ctx.fixtures('claude', 'task-complete', 'mark', '03-plans')

      ctx.log.step('Scenario ready: closing an outcome settles no plan')
      ctx.log.info(
        'Context: three tasks on the board, each citing a plan in .canon/plans/',
      )
      ctx.log.info(
        '  v02.0-pagination.md has open outcomes that HEAD ships, so this run closes it',
      )
      ctx.log.info(
        '  v01.0-rate-limit.md is already all [x], closed by an earlier session',
      )
      ctx.log.info('  v03.0-search.md is the control. Its outcomes stay open.')
      ctx.log.info('')
      ctx.log.info(
        'A plan is settled by the merge rather than by a tick, and canon tasks',
      )
      ctx.log.info(
        'archive carries it. Narrate nothing about rate limiting. The arm fails',
      )
      ctx.log.info(
        'if the run moves any plan, whichever task put it in front of the run.',
      )
      ctx.log.info('')
      ctx.log.info('Action:  /canon:task-complete')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/task-complete/mark/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:task-complete mark',
      )
      ctx.log.info(
        '         One outcome marked, all three plans live, no plans archive created',
      )
    },
    archive: (ctx) => {
      ctx.fixtures('claude', 'task-complete', 'archive', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(api): serve the task list')

      ctx.fixtures('claude', 'task-complete', 'archive', '02-rate-limit')
      ctx.git('add', '.')
      ctx.commit('feat(api): rate limit the task endpoints (#41)')

      ctx.log.step(
        'Scenario ready: one shipped task archived off a two-task board',
      )
      ctx.log.info(
        'Context: v01.0-rate-limit is all [x], names pull request #41, and its',
      )
      ctx.log.info(
        '  Plan: line points at a live .canon/plans/feature-rate-limit.md that',
      )
      ctx.log.info(
        '  no other task cites, so the archive carries the plan across with it',
      )
      ctx.log.info('  HEAD carries the shipped work under a subject naming #41')
      ctx.log.info(
        '  v02.0-pagination is the control. Its outcomes stay open, and both it',
      )
      ctx.log.info('  and its live plan must end the run where they started.')
      ctx.log.info('')
      ctx.log.info(
        'The sandbox has no remote, so the work-reached-main check resolves',
      )
      ctx.log.info(
        'from the Pull request: line and the local log rather than origin/main.',
      )
      ctx.log.info('')
      ctx.log.info('Action:  /canon:task-complete archive v01.0-rate-limit')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/task-complete/archive/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:task-complete archive',
      )
      ctx.log.info(
        '         The task moved under .canon/tasks/archive/ and its plan',
      )
      ctx.log.info(
        "         under .canon/plans/archive/, the archived task's Plan: line",
      )
      ctx.log.info(
        '         retargeted a folder deeper, its ordering row cleared, and',
      )
      ctx.log.info('         the control and its plan left where they were.')
      ctx.log.info(
        '         Two expectations need a reader and report as unchecked.',
      )
    },
  },
})
