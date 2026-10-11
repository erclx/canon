import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'role-orchestrator', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs(project): requirements, tasks, and log-entry plan')

      ctx.log.step('Scenario ready: orchestrator board readout')
      ctx.log.info(
        'Context: priority.md groups the board, a plan for log-entry, none for streak-view',
      )
      ctx.log.info('Action:  /role-orchestrator')
      ctx.log.info('Expect:  no version line at all, since no file states one,')
      ctx.log.info(
        '         order read from priority.md rather than inferred from index.md,',
      )
      ctx.log.info(
        '         log-entry ready to hand to a worker (has plan), streak-view needs /plan-feature first,',
      )
      ctx.log.info(
        '         a single Next action, and In review omitted (no open PRs in this fixture)',
      )
      ctx.log.info(
        'Assert:  declared in fixtures/claude/role-orchestrator/expect.toml',
      )
    },
  },
})
