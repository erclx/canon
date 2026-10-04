import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  arms: {
    default: (ctx) => {
      ctx.identity()

      ctx.write('config.js', 'export const MAX_CONNECTIONS = "5";\n')
      ctx.git('add', '.')
      ctx.commit('feat(git): initial config')

      ctx.write('config.js', 'export const MAX_CONNECTIONS = 5;\n')
      ctx.git('add', 'config.js')

      ctx.log.step('Scenario ready: staged changes (config update)')
      ctx.log.info(
        "Context: modified 'config.js' (MAX_CONNECTIONS string -> number)",
      )
      ctx.log.info('Action:  /canon:git-commit')
      ctx.log.info('Expect:  generates conventional commit message')
    },
  },
})
