import { join } from 'node:path'
import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_GOV: 'true',
  },
  prepare: (ctx) => {
    ctx.fixtures('infra', 'init', 'shared', 'scaffold')

    ctx.run('chmod', ['+x', 'scripts/placeholder.sh'])

    ctx.git('add', '.')
    ctx.commit('chore(sandbox): scaffold init infra test directory')

    ctx.log.step('Init sandbox')
    ctx.log.info(
      'default     : interactive full init (prompts for optional domains)',
    )
    ctx.log.info('with-flags  : non-interactive init with --stack, --skip')
  },
  arms: {
    default: (ctx) => {
      ctx.log.step('Running: canon init .')
      ctx.exec('bun', [join(ctx.root, 'src', 'cli.ts'), 'init', '.'])
    },
    'with-flags': (ctx) => {
      ctx.log.step('Running: canon init --stack base --skip wiki .')
      ctx.env.CANON_NON_INTERACTIVE = '1'
      ctx.exec('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'init',
        '--stack',
        'base',
        '--skip',
        'wiki',
        '.',
      ])
    },
  },
})
