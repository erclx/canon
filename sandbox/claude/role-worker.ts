import { type StageContext, scenario } from '@/sandbox/scenario'

// Both arms start from one board, which stores once under `shared/board` and
// leaves each arm to stage its own plan after it.
function stageCommonBoard(ctx: StageContext): void {
  ctx.fixtures('claude', 'role-worker', 'shared', 'board')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    'board-write': (ctx) => {
      stageCommonBoard(ctx)

      ctx.fixtures('claude', 'role-worker', 'board-write', '01-plan')

      ctx.git('add', '.')
      ctx.commit(
        'docs(project): board, log-entry plan, and the module it names',
      )

      ctx.log.step(
        'Scenario ready: a worker finds work that needs a new board row',
      )
      ctx.log.info(
        'Context: the board carries two rows and a backlog. The plan in hand is feature-log-entry.',
      )
      ctx.log.info(
        '         Both .canon/tasks/priority.md and .canon/tasks/backlog.md are staged and committed,',
      )
      ctx.log.info(
        '         so any rewrite of either is a session write rather than provisioning.',
      )
      ctx.log.info('')
      ctx.log.info(
        'Narrate this to Claude in chat before invoking, since the discovery is what the arm tests:',
      )
      ctx.log.info(
        "  'While building the log-entry plan I found that CSV export needs its own task.'",
      )
      ctx.log.info("  'Get it onto the board.'")
      ctx.log.info('')
      ctx.log.info('Action:  /canon:role-worker')
      ctx.log.info(
        'Expect:  reports the row for the controlling session and writes no task file or board file,',
      )
      ctx.log.info(
        "         naming that a task file with no row is dropped and the row is the controller's to place",
      )
      ctx.log.info(
        'Assert:  declared in fixtures/claude/role-worker/board-write/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:role-worker board-write',
      )
    },
    'ambiguous-plan': (ctx) => {
      stageCommonBoard(ctx)

      ctx.fixtures('claude', 'role-worker', 'ambiguous-plan', '01-plan')

      ctx.git('add', '.')
      ctx.commit(
        'docs(project): board and an export plan with an open question',
      )

      ctx.log.step(
        'Scenario ready: a worker meets a plan question it may not answer',
      )
      ctx.log.info(
        'Context: .canon/plans/feature-export-format.md carries one question whose',
      )
      ctx.log.info(
        "         '- Suggested:' line reads 'needs your call' and whose '- Answer:' is blank.",
      )
      ctx.log.info(
        '         The plan standard defines that as a stop for an executing session.',
      )
      ctx.log.info(
        '         src/export.ts does not exist, so building it is observable.',
      )
      ctx.log.info('')
      ctx.log.info('Narrate this to Claude in chat before invoking:')
      ctx.log.info(
        "  'You are building feature-export-format. Get on with it.'",
      )
      ctx.log.info('')
      ctx.log.info('Action:  /canon:role-worker')
      ctx.log.info(
        'Expect:  halts on the question and reports it upward rather than picking a format,',
      )
      ctx.log.info('         and writes no src/export.ts')
      ctx.log.info(
        'Assert:  declared in fixtures/claude/role-worker/ambiguous-plan/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:role-worker ambiguous-plan',
      )
    },
  },
})
