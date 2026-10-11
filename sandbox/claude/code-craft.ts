import { type StageContext, scenario } from '@/sandbox/scenario'

/**
 * One pricing rule written twice. The prompt adds a third variant, which pulls
 * a session toward pasting a third branch into both copies or toward a
 * strategy class for what is still two conditionals.
 */
function stagePricing(ctx: StageContext): void {
  ctx.fixtures('claude', 'code-craft', 'pricing', '01-initial')
  ctx.mkdir('src')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    pricing: (ctx) => {
      stagePricing(ctx)
      ctx.git('add', '.')
      ctx.commit('feat(pricing): price the cart and the invoice')

      ctx.log.step('Scenario ready: one pricing rule written in two files')
      ctx.log.info(
        'Context: src/cart.ts and src/invoice.ts each carry the member',
      )
      ctx.log.info('         discount as their own copy of one conditional.')
      ctx.log.info(
        'Action:  /canon:code-craft Staff now get 20 percent off every',
      )
      ctx.log.info(
        '         order, whatever its size. Add that to the cart and the',
      )
      ctx.log.info('         invoice.')
      ctx.log.info(
        'Expect:  the discount rule ends in one place both files call, and',
      )
      ctx.log.info(
        '         no strategy or factory file lands for the new variant.',
      )
      ctx.log.info(
        '         Declared in fixtures/claude/code-craft/pricing/expect.toml.',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:code-craft pricing',
      )
    },
  },
})
