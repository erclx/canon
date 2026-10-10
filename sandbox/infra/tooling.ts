import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

const HEADLESS = { CANON_NON_INTERACTIVE: '1' }

function cli(ctx: StageContext, ...args: string[]): string[] {
  return [join(ctx.root, 'src', 'cli.ts'), ...args]
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  prepare: (ctx) => {
    ctx.fixtures('infra', 'tooling', 'shared', 'package')

    ctx.git('add', '.')
    ctx.commit('chore(sandbox): scaffold tooling infra test directory')

    ctx.log.step('Tooling sandbox')
    ctx.log.info(
      'sync        : syncs configs, seeds, deps, and gitignore entries for a stack',
    )
    ctx.log.info(
      'sync-drift  : sync with a pre-drifted markdown seed in place; seed must stay unchanged',
    )
    ctx.log.info(
      'sync-headless: headless run refuses to write without --write, then applies with it',
    )
    ctx.log.info(
      "reference   : prints a stack's reference doc, nothing written",
    )
    ctx.log.info(
      'reference-stale: an old installed copy sits in .claude/tooling/; the verb ignores it and sync leaves it alone',
    )
    ctx.log.info(
      'monorepo    : base at root, subtree synced with --skip base; only one .husky expected',
    )
    ctx.log.info('list        : read-only catalog dump, no target needed')
  },
  arms: {
    sync: (ctx) => {
      ctx.log.step('Running: canon tooling sync')
      ctx.log.info(
        'Expected: the report lists every path, then a prompt asks before anything is written.',
      )
      ctx.exec('bun', cli(ctx, 'tooling', 'sync', 'base', '.'))
    },
    'sync-drift': (ctx) => {
      ctx.fixtures('infra', 'tooling', 'sync-drift', '01-development')
      ctx.git('add', 'docs/development.md')
      ctx.commit('chore(sandbox): seed drifted docs/development.md')

      ctx.log.step('Running: canon tooling sync base')
      ctx.log.info('docs/development.md is pre-populated with a drifted copy.')
      ctx.log.info(
        'After sync, diff HEAD -- docs/development.md should be empty.',
      )
      ctx.log.info(
        'The report names it before the prompt, so the drift is visible ahead of the write.',
      )
      ctx.exec('bun', cli(ctx, 'tooling', 'sync', 'base', '.'))
    },
    'sync-headless': (ctx) => {
      ctx.log.step('Running: CANON_NON_INTERACTIVE=1 canon tooling sync base .')
      ctx.log.info(
        'Expected: the report lists every path, nothing is written, and the exit is 1.',
      )
      const status = ctx.run('bun', cli(ctx, 'tooling', 'sync', 'base', '.'), {
        env: HEADLESS,
        allowFailure: true,
      })
      if (status !== 0) ctx.log.info(`Exit: ${status}`)
      ctx.log.info(
        'Expected: git status is clean, since the refusal wrote nothing.',
      )
      ctx.git('status', '--short')

      ctx.log.step('Running the same command with --write')
      ctx.log.info('Expected: every reported path lands and the exit is 0.')
      ctx.exec('bun', cli(ctx, 'tooling', 'sync', 'base', '.', '--write'))
    },
    reference: (ctx) => {
      ctx.log.step('Running: canon tooling reference base')
      ctx.log.info(
        'Expected: the reference doc prints to stdout. Nothing is written.',
      )
      ctx.exec('bun', cli(ctx, 'tooling', 'reference', 'base'))
    },
    'reference-stale': (ctx) => {
      ctx.log.step('Staging a stale installed reference copy')
      ctx.fixtures('infra', 'tooling', 'reference-stale', '01-installed-copy')
      ctx.git('add', '.claude/tooling/base.md')
      ctx.commit('chore(sandbox): seed a stale installed reference copy')

      ctx.log.step('Running: canon tooling reference base')
      ctx.log.info(
        'Expected: prints the current tooling/base/reference.md doc, not the stale file above.',
      )
      ctx.run('bun', cli(ctx, 'tooling', 'reference', 'base'))

      ctx.log.step(
        'Running: CANON_NON_INTERACTIVE=1 canon tooling sync base . --write',
      )
      ctx.log.info(
        'Expected: the stale .claude/tooling/base.md is left untouched. diff HEAD -- .claude/tooling/base.md should be empty.',
      )
      ctx.run('bun', cli(ctx, 'tooling', 'sync', 'base', '.', '--write'), {
        env: HEADLESS,
      })
      ctx.log.step('Diffing the stale copy against HEAD')
      ctx.exec('git', ['diff', 'HEAD', '--', '.claude/tooling/base.md'])
    },
    monorepo: (ctx) => {
      ctx.log.step('Staging base tooling at repo root')
      ctx.run('bun', cli(ctx, 'tooling', 'sync', 'base', '.', '--write'), {
        env: HEADLESS,
      })
      ctx.run('bunx', ['husky'])
      ctx.mkdir('frontend')

      ctx.log.step(
        'Running: canon tooling sync vite-react ./frontend --skip base',
      )
      ctx.log.info(
        'Expected: frontend gets web and vite-react configs, no base configs.',
      )
      ctx.log.info('Expected: only the root .husky exists, no frontend/.husky.')
      ctx.log.info(
        "Expected: .github/ is withheld and named with 'working-directory: frontend', and frontend/cspell.json lands.",
      )
      ctx.exec(
        'bun',
        cli(
          ctx,
          'tooling',
          'sync',
          'vite-react',
          './frontend',
          '--skip',
          'base',
        ),
      )
    },
    list: (ctx) => {
      ctx.log.step('Running: canon tooling list')
      ctx.exec('bun', cli(ctx, 'tooling', 'list'))
    },
  },
})
