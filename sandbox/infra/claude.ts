import { join } from 'node:path'
import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_GOV: 'true',
  },
  prepare: (ctx) => {
    ctx.fixtures('infra', 'claude', 'shared', 'package')

    ctx.git('add', '.')
    ctx.commit('chore(sandbox): scaffold claude infra test directory')

    ctx.log.step('Claude sandbox')
    ctx.log.info('init        : seeds .claude/ project docs')
    ctx.log.info('seeds-list  : lists seed doc sources as JSON')
    ctx.log.info('sync        : reconciles .gitignore against the claude manifest')
    ctx.log.info('setup       : installs user-level config to ./home/.claude/')
  },
  arms: {
    init: (ctx) => {
      ctx.log.step('Running: canon claude init')
      ctx.exec('bun', [join(ctx.root, 'src', 'cli.ts'), 'claude', 'init', '.'])
    },
    'seeds-list': (ctx) => {
      ctx.log.step('Running: canon claude seeds list --json')
      ctx.exec('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'claude',
        'seeds',
        'list',
        '--json',
      ])
    },
    sync: (ctx) => {
      ctx.log.step('Running: canon claude sync')
      ctx.exec('bun', [join(ctx.root, 'src', 'cli.ts'), 'claude', 'sync', '.'])
    },
    setup: (ctx) => {
      // Aimed at a sandbox-local directory. The verb defaults to $HOME/.claude,
      // and a scenario that took the default would edit the operator's own config.
      ctx.log.step('Running: canon claude setup ./home/.claude')
      ctx.exec('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'claude',
        'setup',
        join(ctx.dir, 'home', '.claude'),
      ])
    },
  },
})
