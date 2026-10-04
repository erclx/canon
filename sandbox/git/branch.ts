import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  arms: {
    default: (ctx) => {
      ctx.write('README.md', 'Base project\n')
      ctx.git('add', '.')
      ctx.commit('chore(project): init base')

      ctx.git('checkout', '-b', 'feat/clean-feature', '-q')
      ctx.write('feature.js', 'valid code\n')
      ctx.git('add', '.')
      ctx.commit('feat(core): compliant feature work')

      ctx.git('checkout', '-b', 'temp/wip-stuff', '-q')
      ctx.write('wip.js', 'messy code\n')
      ctx.git('add', '.')
      ctx.commit('feat(wip): messy work in progress')

      ctx.log.step('Scenario ready: branch naming compliance')

      ctx.log.info("Test A (current branch): 'temp/wip-stuff'")
      ctx.log.info('  Action: /canon:git-branch')
      ctx.log.info("  Expect: Suggest rename to 'feat/wip-messy-work'")

      ctx.log.bar()

      ctx.log.info("Test B (toggle): 'git checkout feat/clean-feature'")
      ctx.log.info('  Action: /canon:git-branch')
      ctx.log.info("  Expect: '✅ Branch name already follows conventions'")
    },
  },
})
