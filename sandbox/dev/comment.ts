import { scenario } from '@/sandbox/scenario'

export default scenario({
  arms: {
    default: (ctx) => {
      ctx.fixtures('dev', 'comment', 'shared', 'orders')

      ctx.log.step('Scenario ready: dev:comment above-block comments test')
      ctx.log.info(
        "Context: 'src/api/orders.ts' has three functions, no existing comments",
      )
      ctx.log.info('Action:  /dev:comment src/api/orders.ts')
      ctx.log.info(
        'Expect:  comment added to MAX_BULK and bulkFulfil. getOrder and cancelOrder left clean',
      )
    },
  },
})
