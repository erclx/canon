import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  anchor: true,
  arms: {
    default: (ctx) => {
      ctx.log.step(`Configuring issue environment (${ctx.env.ANCHOR_REPO})`)

      ctx.anchorRemote()
      ctx.git('push', '--force', 'origin', 'HEAD:main')

      ctx.fixtures('git', 'issue', 'shared', '01-capitalize')

      ctx.git('add', 'utils.js')
      ctx.commit('feat(utils): add capitalize helper')

      ctx.log.step('Scenario ready: file an issue')
      ctx.log.info(
        'Context: a repo with a GitHub remote and a capitalize helper that crashes on an empty string',
      )
      ctx.log.info(
        'Action:  /canon:git-issue log a bug: capitalize throws on an empty string',
      )
      ctx.log.info(
        'Expect:  agent files a bug issue on the remote and prints the issue URL',
      )
    },
  },
})
