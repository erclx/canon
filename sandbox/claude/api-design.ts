import { type StageContext, scenario } from '@/sandbox/scenario'

/**
 * The exported function hands back the stored row, so its storage column names
 * are already part of what a caller sees. The command copies one of them,
 * `buyer`, straight into its JSON, and the nightly script parses it. A rename
 * in place breaks that script, which the prompt never mentions.
 */
function stageRename(ctx: StageContext): void {
  ctx.fixtures('claude', 'api-design', 'rename', '01-initial')
  ctx.mkdir('src')
  ctx.mkdir('scripts')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    rename: (ctx) => {
      stageRename(ctx)
      ctx.git('add', '.')
      ctx.commit('feat(orders): add the show command')

      ctx.log.step(
        'Scenario ready: a command whose JSON a script outside it parses',
      )
      ctx.log.info('Context: src/cli.ts prints { id, buyer, total }, and')
      ctx.log.info(
        '         scripts/nightly-report.sh reads .buyer out of it with jq.',
      )
      ctx.log.info(
        'Action:  /canon:api-design Rename the buyer field in the JSON that',
      )
      ctx.log.info('         orders show prints to customerId.')
      ctx.log.info(
        'Expect:  customerId added beside buyer rather than replacing it, and',
      )
      ctx.log.info(
        '         the nightly script left reading .buyer. Declared in',
      )
      ctx.log.info('         fixtures/claude/api-design/rename/expect.toml.')
      ctx.log.info(
        '         Check it with: canon sandbox check claude:api-design rename',
      )
    },
  },
})
