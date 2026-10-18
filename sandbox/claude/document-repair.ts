import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      // docs/overview.md fails two density limits, a long paragraph and a long
      // bullet, and states the reason the handler scan caches. canon/context/
      // already passes, so it gates with no rewrite.
      ctx.fixtures('claude', 'document-repair', 'shared', '01-initial')

      ctx.git('add', '.')
      ctx.commit('docs(project): initial project scaffold')

      ctx.log.step('Scenario ready: one failing folder and one passing folder')
      ctx.log.info('Context: an older project with no gated list yet:')
      ctx.log.info(
        '  1. docs/overview.md carries a paragraph and a bullet past the density limits',
      )
      ctx.log.info('  2. canon/context/ already passes every density limit')
      ctx.log.info('Action:  /document-repair')
      ctx.log.info(
        'Expect:  docs/overview.md rewritten until canon markdown audit docs/ exits 0,',
      )
      ctx.log.info(
        '         then canon/config/markdown.toml lists docs/ and canon/context/, both',
      )
      ctx.log.info(
        '         written by canon markdown gated add, never by hand. The rewrite keeps',
      )
      ctx.log.info(
        '         the reason the scan caches, and the skill states no limit number.',
      )
    },
  },
})
