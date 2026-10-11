import { type StageContext, scenario } from '@/sandbox/scenario'

/** What every arm prints once its host signal is committed. */
function logReady(ctx: StageContext): void {
  ctx.log.step(`Scenario ready: pick-only, ${ctx.arm} signal`)
  ctx.log.info(
    'Action:  /canon:deploy-app Pick the host, then stop before running any command.',
  )
  ctx.log.info(
    'Tools:   drive it with no shell, so no wrangler, vercel, or gh call can run:',
  )
  ctx.log.info('         CANON_SKILL_TEST_TOOLS=Read,Glob,Grep,Skill')
  ctx.log.info('         CANON_SKILL_TEST_PERMISSION_MODE=dontAsk')
  ctx.log.info(
    `Expect:  declared in fixtures/claude/deploy-app/${ctx.arm}/expect.toml`,
  )
  ctx.log.info(
    `         Check it with: canon sandbox check claude:deploy-app ${ctx.arm}`,
  )
}

// Two pick-only arms, one host signal each. Both host procedures call live
// `wrangler`, `vercel`, and `gh` against real accounts, so neither arm drives
// past the Pick step. Run each under a permission mode that denies every tool
// outside the read set, which is what keeps the session off any account rather
// than the prompt asking it to stop.
//
// No arm stages both hosts or neither. That branch ends in the structured
// question, which `dontAsk` denies and a `claude -p` run has nobody to answer,
// so an arm there would score a denial rather than the ask.
export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  prepare: (ctx) => {
    ctx.log.info(
      'cloudflare : a wrangler.toml and nothing for Vercel, skill picks cloudflare',
    )
    ctx.log.info(
      'vercel     : a vercel.json and nothing for Cloudflare, skill picks vercel',
    )
  },
  arms: {
    cloudflare: (ctx) => {
      ctx.fixtures('claude', 'deploy-app', 'shared', '01-package')
      ctx.fixtures('claude', 'deploy-app', 'cloudflare', '01-host')
      ctx.git('add', '.')
      ctx.commit('chore(deploy): add the wrangler config')
      logReady(ctx)
    },
    vercel: (ctx) => {
      ctx.fixtures('claude', 'deploy-app', 'shared', '01-package')
      ctx.fixtures('claude', 'deploy-app', 'vercel', '01-host')
      ctx.git('add', '.')
      ctx.commit('chore(deploy): add the vercel config')
      logReady(ctx)
    },
  },
})
