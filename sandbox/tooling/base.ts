import { join } from 'node:path'
import { scenario } from '@/sandbox/scenario'

export default scenario({
  arms: {
    default: (ctx) => {
      ctx.log.step('Initializing package')
      ctx.fixtures('tooling', 'base', 'shared', 'package')
      ctx.log.info('package.json created')

      ctx.run('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'tooling',
        'inject',
        'base',
        '.',
        '--nested',
      ])

      ctx.log.step('Initializing Husky')
      ctx.run('bunx', ['husky'])

      ctx.log.step('Running verification')
      if (ctx.run('bun', ['scripts/verify.ts'], { allowFailure: true }) === 0)
        ctx.log.info('All checks passed')
      else ctx.log.warn('Verification failed, check configs')

      ctx.log.step('Scenario ready: base tooling test')
      ctx.log.info('Context: golden configs from tooling/base applied')
      ctx.log.info("Action:  inspect configs, run 'bun run check' to verify")
    },
  },
})
