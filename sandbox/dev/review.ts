import { scenario } from '@/sandbox/scenario'

export default scenario({
  arms: {
    default: (ctx) => {
      ctx.run('git', ['checkout', '-b', 'feat/orders'], {
        stdout: 'ignore',
        stderr: 'ignore',
      })

      ctx.fixtures('dev', 'review', 'shared', 'orders')

      ctx.git('add', 'src/api/orders.ts')
      ctx.run(
        'git',
        ['commit', '-m', 'feat(api): add orders API', '--no-verify'],
        { stdout: 'ignore' },
      )

      ctx.log.step('Scenario ready: branch diff review')
      ctx.log.info(
        'Context: on feat/orders, one commit ahead of main with three reviewable bugs',
      )
      ctx.log.info('Action:  /canon:review-branch')
      ctx.log.info(
        'Expect:  findings report against branch diff, no args needed',
      )
    },
  },
})
