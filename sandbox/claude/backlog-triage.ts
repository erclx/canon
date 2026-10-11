import { type StageContext, scenario } from '@/sandbox/scenario'

function stageHistory(ctx: StageContext): void {
  ctx.fixtures('claude', 'backlog-triage', 'file', '01-initial')
  ctx.git('add', '.')
  ctx.commit('feat(api): serve the task list')

  ctx.fixtures('claude', 'backlog-triage', 'file', '02-paginate')
  ctx.git('add', '.')
  ctx.commit('feat(api): paginate the task list (#61)')

  ctx.fixtures('claude', 'backlog-triage', 'file', '03-export')
  ctx.git('add', '.')
  ctx.commit('feat(api): add a CSV export for the weekly report (#58)')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.info(
      'file  : seven backlog rows, one per verdict shape, and a tree to measure them against',
    )
    ctx.log.info(
      'apply : the same board plus an answered triage folder carrying one override',
    )
  },
  arms: {
    file: (ctx) => {
      stageHistory(ctx)

      ctx.log.step('Scenario ready: every backlog row filed with a verdict')
      ctx.log.info(
        'Context: .canon/tasks/backlog.md lists seven rows, and priority.md holds',
      )
      ctx.log.info('  one control row, v07.0, that a triage never files')
      ctx.log.info('  v01.0 names console.log calls the tree no longer holds')
      ctx.log.info("  v02.0's outcomes shipped in #58 under other work")
      ctx.log.info(
        "  v03.0's missing rate limit reproduces on routes every client calls",
      )
      ctx.log.info('  v04.0 waited on pagination, which landed in #61')
      ctx.log.info(
        '  v05.0 and v06.0 carry no argument, since no interface or webhook exists',
      )
      ctx.log.info("  v08.0's unused export reproduces but names no cost")
      ctx.log.info('')
      ctx.log.info('Action:  /canon:backlog-triage')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/backlog-triage/file/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:backlog-triage file',
      )
      ctx.log.info(
        '         A folder at .canon/intake/01-backlog-triage/ with one item per',
      )
      ctx.log.info(
        '         row, a verdict token opening every Suggested: line, and every',
      )
      ctx.log.info('         You: slot empty. The board is untouched.')
      ctx.log.info('         Then: canon intake list 01-backlog-triage --json')
    },
    apply: (ctx) => {
      stageHistory(ctx)
      ctx.fixtures('claude', 'backlog-triage', 'apply', '01-answered')

      ctx.log.step(
        'Scenario ready: an answered triage folder applied to the board',
      )
      ctx.log.info(
        'Context: .canon/intake/01-backlog-triage/ carries six answered items',
      )
      ctx.log.info(
        '  Four accept their suggestion with ok: decline v01.0, archive v02.0',
      )
      ctx.log.info('  at positions 1 and 2, keep v03.0, and promote v04.0')
      ctx.log.info('  v05.0 overrides a suggested decline with keep')
      ctx.log.info(
        '  v06.0 carries a free-text answer, which apply must skip, not guess',
      )
      ctx.log.info('')
      ctx.log.info('Action:  /canon:backlog-triage')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/backlog-triage/apply/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:backlog-triage apply',
      )
      ctx.log.info(
        '         v01.0 under declined/, v02.0 under archive/ with both outcomes',
      )
      ctx.log.info(
        '         closed, v04.0 at the bottom of Needs a plan, v03.0 and v05.0',
      )
      ctx.log.info(
        '         still live with a triage Findings line, v06.0 untouched.',
      )
      ctx.log.info(
        '         Then: canon tasks list --json and canon tasks validate',
      )
    },
  },
})
