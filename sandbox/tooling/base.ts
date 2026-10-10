import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

/** `chmod +x scripts/*.sh`, passing the pattern through unexpanded when nothing matches, as the shell did. */
function makeScriptsExecutable(ctx: StageContext): void {
  const scripts = readdirSync(join(ctx.dir, 'scripts'))
    .filter((name) => name.endsWith('.sh'))
    .sort()
    .map((name) => `scripts/${name}`)
  ctx.run('chmod', ['+x', ...(scripts.length > 0 ? scripts : ['scripts/*.sh'])])
}

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

      ctx.log.step('Setting script permissions')
      makeScriptsExecutable(ctx)
      ctx.log.info('Scripts made executable')

      ctx.log.step('Running verification')
      if (ctx.run('bash', ['scripts/verify.sh'], { allowFailure: true }) === 0)
        ctx.log.info('All checks passed')
      else ctx.log.warn('Verification failed, check configs')

      ctx.log.step('Scenario ready: base tooling test')
      ctx.log.info('Context: golden configs from tooling/base applied')
      ctx.log.info("Action:  inspect configs, run 'bun run check' to verify")
    },
  },
})
