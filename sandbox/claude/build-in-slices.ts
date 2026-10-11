import { type StageContext, scenario } from '@/sandbox/scenario'

function stageStats(ctx: StageContext): void {
  // Two behaviors, so a run that builds both in one pass leaves one commit
  // where the skill asks for at least two.
  // The out-of-scope defect. `legacyPad` is exported and imported nowhere, in
  // a file the plan does not name, so a run that removes it widened the branch.
  ctx.fixtures('claude', 'build-in-slices', 'stats', '01-initial')

  ctx.mkdir('src')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    stats: (ctx) => {
      stageStats(ctx)
      ctx.git('add', '.')
      ctx.commit('feat(format): pad values for display')

      ctx.log.step(
        'Scenario ready: a two-behavior plan beside an unused export',
      )
      ctx.log.info(
        'Context: PLAN.md asks for wordCount and lineCount in src/stats.ts.',
      )
      ctx.log.info(
        '         src/format.ts exports legacyPad, which nothing imports.',
      )
      ctx.log.info(
        'Action:  /canon:build-in-slices Build PLAN.md on this branch.',
      )
      ctx.log.info(
        'Expect:  at least two new commits, src/format.ts unchanged, and',
      )
      ctx.log.info(
        '         legacyPad named in the reply as noticed, not fixed.',
      )
      ctx.log.info(
        '         Declared in fixtures/claude/build-in-slices/stats/expect.toml.',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:build-in-slices stats',
      )
    },
  },
})
