import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.info(
      'create  : board with three tasks and an unlinked plan, no task for it yet',
    )
    ctx.log.info(
      'decline : board with one task decided against and one still open',
    )
  },
  arms: {
    create: (ctx) => {
      ctx.fixtures('claude', 'task-board', 'create', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(api): serve the task list')

      ctx.log.step(
        'Scenario ready: a task written onto a board that already has three',
      )
      ctx.log.info(
        'Context: .canon/tasks/ carries v01.0, v02.0, and v03.0 with no gaps',
      )
      ctx.log.info(
        '  .canon/plans/feature-csv-export.md exists and no task cites it',
      )
      ctx.log.info(
        '  The labels are contiguous, so the next one the board admits is v03.1',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:task-board create a task for the CSV export endpoint,',
      )
      ctx.log.info(
        '         from the plan at .canon/plans/feature-csv-export.md',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/task-board/create/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:task-board create',
      )
      ctx.log.info(
        '         A v03.1 task carrying both frontmatter fields, a Plan: link',
      )
      ctx.log.info(
        '         relative to the board, an open outcome, and a test strategy.',
      )
      ctx.log.info(
        '         The label is claimed from the board, not from a version file.',
      )
      ctx.log.info('         The three existing tasks survive untouched.')
      ctx.log.info(
        '         Two expectations need a reader and report as unchecked.',
      )
    },
    decline: (ctx) => {
      ctx.fixtures('claude', 'task-board', 'decline', '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat(api): serve the task list')

      ctx.fixtures('claude', 'task-board', 'decline', '02-csv-spike')
      ctx.git('add', '.')
      ctx.commit('feat(api): sketch a CSV export endpoint (#58)')

      ctx.log.step(
        'Scenario ready: one task decided against on a two-task board',
      )
      ctx.log.info('Context: v01.0-csv-export is open, names #58, and its own')
      ctx.log.info(
        "  Findings already record the decision: v02.0's planned response",
      )
      ctx.log.info(
        '  covers the same request, so the export duplicates it. The spike',
      )
      ctx.log.info('  at src/routes/export.ts wires into no route table.')
      ctx.log.info(
        '  v02.0-pagination is the control. Its outcomes stay open, and it',
      )
      ctx.log.info('  must end the run exactly where it started.')
      ctx.log.info('')
      ctx.log.info('Action:  /canon:task-board decline v01.0-csv-export, since')
      ctx.log.info('         v02.0 already plans the response it duplicates')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/task-board/decline/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:task-board decline',
      )
      ctx.log.info(
        '         The task moved under .canon/tasks/declined/, carrying a',
      )
      ctx.log.info(
        '         Declined: line naming the reason and who decided, its',
      )
      ctx.log.info(
        '         ordering row cleared, and the control left where it was.',
      )
      ctx.log.info(
        '         Unlike an archive, decline carries no outcome-state gate, so',
      )
      ctx.log.info('         the task moves with both outcomes still open.')
      ctx.log.info(
        '         One expectation needs a reader and reports as unchecked.',
      )
    },
  },
})
