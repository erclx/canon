import { type StageContext, scenario } from '@/sandbox/scenario'

/**
 * The deprecated helper has two callers. One imports it by name, which a search
 * for the name finds. The other reaches it through a string in a config file,
 * looked up on the module at runtime, which a search for an import never
 * finds. The prompt names neither caller.
 */
function stageCallers(ctx: StageContext): void {
  ctx.fixtures('claude', 'deprecation-migration', 'callers', '01-initial')
  ctx.mkdir('src')
  ctx.mkdir('config')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    callers: (ctx) => {
      stageCallers(ctx)
      ctx.git('add', '.')
      ctx.commit('feat(reports): add the report and the job runner')

      ctx.log.step(
        'Scenario ready: a deprecated helper with a caller a name search misses',
      )
      ctx.log.info(
        'Context: src/report.ts imports formatLegacy, and config/jobs.json',
      )
      ctx.log.info(
        '         names it as a string src/jobs.ts looks up at runtime.',
      )
      ctx.log.info(
        'Action:  /canon:deprecation-migration Delete the deprecated',
      )
      ctx.log.info(
        '         formatLegacy helper in src/dates.ts, formatDate replaced it.',
      )
      ctx.log.info(
        'Expect:  both callers named before any removal, and formatLegacy',
      )
      ctx.log.info(
        '         left in place while either still reaches it. Declared in',
      )
      ctx.log.info(
        '         fixtures/claude/deprecation-migration/callers/expect.toml.',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:deprecation-migration callers',
      )
    },
  },
})
