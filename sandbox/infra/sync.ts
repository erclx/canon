import { existsSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

const STALE_LIMIT = 2

function findMarkdown(ctx: StageContext, rulesDir: string): string[] {
  const found = ctx.read('find', [rulesDir, '-type', 'f', '-name', '*.md'])

  return ctx
    .capture('sort', [], { input: found })
    .stdout.split('\n')
    .filter((line) => line !== '')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_GOV: 'true',
  },
  anchor: true,
  arms: {
    default: (ctx) => {
      const rulesDir = join(ctx.root, 'governance', 'rules')

      ctx.anchorRemote()

      // Governance is the one domain staged stale here. Standards left the sync
      // domains with the install channel, so a target holds no copy for a sync
      // to reconcile.
      const staleRules: string[] = []
      for (const file of findMarkdown(ctx, rulesDir)) {
        const subdir = dirname(relative(rulesDir, file))
        const rule = basename(file, '.md')
        const dest =
          subdir === '.'
            ? `.claude/rules/canon/${rule}.md`
            : `.claude/rules/canon/${subdir}/${rule}.md`
        if (!existsSync(join(ctx.dir, dest))) continue
        ctx.append(dest, '# stale\n')
        staleRules.push(dest.slice('.claude/rules/canon/'.length))
        if (staleRules.length === STALE_LIMIT) break
      }

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): make governance stale')

      ctx.git('push', '--force', 'origin', 'HEAD:main', '-q')
      const branches = ctx
        .read('git', ['ls-remote', '--heads', 'origin', 'chore/canon-sync*'], {
          stderr: 'ignore',
        })
        .split('\n')
        .map((line) => line.trim().split(/\s+/)[1])
        .filter((ref): ref is string => ref !== undefined && ref !== '')
        .map((ref) => ref.replace(/^refs\/heads\//, ''))
      for (const branch of branches)
        ctx.run('git', ['push', 'origin', '--delete', branch, '-q'], {
          stderr: 'ignore',
          allowFailure: true,
        })

      ctx.log.step('Sync sandbox')
      ctx.log.info(`Anchor: ${ctx.env.ANCHOR_REPO}`)
      ctx.log.info(`Stale rules: ${staleRules.join(' ')}`)
      ctx.log.info(
        `Remote: https://github.com/${ctx.env.GITHUB_ORG}/${ctx.env.ANCHOR_REPO}.git`,
      )

      ctx.log.step('Running: canon sync')
      ctx.exec('bun', [join(ctx.root, 'src', 'cli.ts'), 'sync', '.'])
    },
  },
})
