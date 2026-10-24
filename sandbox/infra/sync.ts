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

/** Appends to the first installed rules that have a source, so a sync has something to copy. */
function makeStale(ctx: StageContext): string[] {
  const rulesDir = join(ctx.root, 'governance', 'rules')

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
  return staleRules
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_GOV: 'true',
  },
  anchor: true,
  arms: {
    default: (ctx) => {
      ctx.anchorRemote()
      const staleRules = makeStale(ctx)

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
    coverage: (ctx) => {
      ctx.git('config', 'user.email', 'sandbox@example.com')
      ctx.git('config', 'user.name', 'Sandbox')
      const staleRules = makeStale(ctx)
      ctx.git('add', '.')
      ctx.commit('chore(sandbox): make governance stale')

      ctx.log.step('Running: canon gov sync --json')
      const run = ctx.capture('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'gov',
        'sync',
        '.',
        '--json',
      ])
      ctx.log.pipe(run.stderr)

      const record = JSON.parse(run.stdout) as {
        coverage?: { rule: string }[]
      }
      const reported = (record.coverage ?? []).map((entry) =>
        entry.rule.slice('.claude/rules/canon/'.length),
      )
      if (reported.join() !== staleRules.join())
        ctx.fail(
          `Coverage reported [${reported.join(' ')}], expected [${staleRules.join(' ')}]`,
        )

      ctx.log.info(`Coverage names ${staleRules.join(' ')}`)
    },
  },
})
