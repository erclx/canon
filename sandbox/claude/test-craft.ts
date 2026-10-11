import { type StageContext, scenario } from '@/sandbox/scenario'

function stageShopConfig(ctx: StageContext): void {
  ctx.fixtures('claude', 'test-craft', 'shared', 'shop-config')
}

/**
 * One behavior per layer, so a correct run has exactly one right home for
 * each. The helper is pure, which makes it a unit test. The list's loading,
 * empty, and error states render without leaving the component, which makes
 * them a component test however much the diff looks like UI. The checkout
 * crosses three routes, which is the one journey here that earns a browser.
 */
function stageLayers(ctx: StageContext): void {
  ctx.mkdir('src/lib')
  ctx.mkdir('src/components')
  ctx.mkdir('src/pages')
  ctx.mkdir('e2e')

  ctx.fixtures('claude', 'test-craft', 'layers', '01-initial')
}

/**
 * The page already carries an end to end spec, which is the pull. A session
 * adding to a page with a spec beside it is tempted to extend that spec. The
 * loading state renders without leaving the component, so the right home is a
 * component test, and the spec must stay free of it.
 */
function stagePull(ctx: StageContext): void {
  ctx.mkdir('src/pages')
  ctx.mkdir('e2e')

  ctx.fixtures('claude', 'test-craft', 'pull', '01-initial')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    layers: (ctx) => {
      stageShopConfig(ctx)
      stageLayers(ctx)
      ctx.git('add', '.')
      ctx.commit('feat(shop): add prices, the order list, and checkout')

      ctx.log.step('Scenario ready: three untested behaviors, one per layer')
      ctx.log.info(
        'Context: src/lib/price.ts is pure, src/components/OrderList.tsx has a',
      )
      ctx.log.info(
        '         loading, empty, and error state, and src/App.tsx routes a checkout',
      )
      ctx.log.info(
        '         from /cart through /checkout to /confirmation. Nothing is tested.',
      )
      ctx.log.info(
        'Action:  /canon:test-craft Write the tests formatPrice, the OrderList',
      )
      ctx.log.info('         states, and the checkout flow need.')
      ctx.log.info(
        'Expect:  a unit test beside price.ts, a component test beside OrderList',
      )
      ctx.log.info(
        '         covering its three states, and one Playwright spec under e2e/',
      )
      ctx.log.info(
        '         walking the checkout. No browser test asserts the loading state.',
      )
      ctx.log.info(
        '         Declared in fixtures/claude/test-craft/layers/expect.toml.',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:test-craft layers',
      )
      ctx.log.info('')
      ctx.log.info(
        'Nothing installs, so no test can run. The arm asserts where each test',
      )
      ctx.log.info('landed, not whether it passed.')
    },
    pull: (ctx) => {
      stageShopConfig(ctx)
      stagePull(ctx)
      ctx.git('add', '.')
      ctx.commit('feat(shop): add the orders page and its spec')

      ctx.log.step(
        'Scenario ready: a page under end to end coverage, a state to add',
      )
      ctx.log.info('Context: src/pages/Orders.tsx has no loading state, and')
      ctx.log.info(
        '         e2e/orders.spec.ts already covers the list in a browser.',
      )
      ctx.log.info(
        'Action:  /canon:test-craft Add a loading state to the Orders page and',
      )
      ctx.log.info('         write the tests it needs.')
      ctx.log.info(
        'Expect:  a component test beside Orders asserting the loading state,',
      )
      ctx.log.info('         and no mention of it in e2e/orders.spec.ts.')
      ctx.log.info(
        '         Declared in fixtures/claude/test-craft/pull/expect.toml.',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:test-craft pull',
      )
      ctx.log.info('')
      ctx.log.info(
        'Naming an arm is what makes the check assert anything. Without one,',
      )
      ctx.log.info(
        'canon sandbox check claude:test-craft reports clean with nothing read.',
      )
      ctx.log.info(
        'The without arm is a hand run against a scratch plugin dir lacking',
      )
      ctx.log.info(
        'skills/test-craft, since run.sh hardcodes --plugin-dir claude, and it',
      )
      ctx.log.info(
        'is scored by reading the files it wrote, not by this check.',
      )
    },
  },
})
