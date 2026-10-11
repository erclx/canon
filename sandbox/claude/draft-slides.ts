import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    'with-context': (ctx) => {
      ctx.fixtures('claude', 'draft-slides', 'with-context', '01-initial')

      // Installed rather than staged, so the slides resolve the same token sheet
      // a target receives and the arm reads no copy that drifts from the source.
      ctx.run('canon', ['design', 'install', '.'], { stdout: 'ignore' })

      ctx.git('add', '.')
      ctx.commit('feat(ledger): v1 scope notes')

      ctx.log.step('Scenario ready: slides draft (with project context)')
      ctx.log.info(
        'Context: ledger CLI v1 with REQUIREMENTS, CLAUDE.md, and .claude/design/base.css present',
      )
      ctx.log.info("Action:  /canon:draft-slides 'ledger v1 overview deck'")
      ctx.log.info(
        'Expect:  a new folder under .canon/slides/ holding numbered .html slides drawn with var(--...) tokens',
      )
      ctx.log.info(
        '         and varied compositions, rendered to .canon/tmp/render/slides/, every ✗ line read back,',
      )
      ctx.log.info(
        '         and a one-pass QA check. Nothing written under .canon/slides/layouts/ or .claude/',
      )
    },
    bare: (ctx) => {
      ctx.fixtures('claude', 'draft-slides', 'bare', '01-initial')

      ctx.git('add', '.')
      ctx.commit('chore: initial state')

      ctx.log.step('Scenario ready: slides draft (no project context)')
      ctx.log.info(
        'Context: bare repo, no CLAUDE.md, REQUIREMENTS, or token stylesheet',
      )
      ctx.log.info("Action:  /canon:draft-slides 'toolbox launch deck'")
      ctx.log.info(
        'Expect:  the deck still lands in its own folder under .canon/slides/ and renders, the reply says',
      )
      ctx.log.info(
        '         it renders unstyled rather than inventing token values, and no software or font names',
      )
      ctx.log.info('         leak into content')
    },
  },
})
