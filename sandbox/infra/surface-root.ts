import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

// The old root sits in a constant so the sweep this sandbox exercises never
// reads its own seeding lines as citations to rewrite when it runs over the
// toolkit.
const OLD_ROOT = '.claude'

// Tracked surfaces at the old root, one citing file outside them, and one
// vendor-read folder the move must leave where it is. Staged rather than
// committed, since `git mv` needs the paths tracked and nothing more.
function seedSurfaces(ctx: StageContext): void {
  ctx.write(`${OLD_ROOT}/ARCHITECTURE.md`, '# Architecture\n')
  ctx.write(
    `${OLD_ROOT}/context/index.md`,
    '---\ntitle: Context\ndescription: Per-domain narrative\n---\n\n# Context\n',
  )
  ctx.write(
    `${OLD_ROOT}/wireframes/index.md`,
    `# Wireframes\n\nSee \`${OLD_ROOT}/context/index.md\`.\n`,
  )
  ctx.write(`${OLD_ROOT}/rules/core/005-behavior.md`, '# Behavior\n')
  ctx.write('docs/guide.md', `Start at \`${OLD_ROOT}/context/index.md\`.\n`)

  ctx.git('add', '-A')
}

function runCli(ctx: StageContext, ...args: string[]): void {
  const status = ctx.run('bun', [join(ctx.root, 'src', 'cli.ts'), ...args], {
    allowFailure: true,
  })
  ctx.log.info(`Exit code: ${status}`)
}

function listFiles(ctx: StageContext): void {
  const found = ctx.read('find', [
    '.',
    '-not',
    '-path',
    './.git/*',
    '-type',
    'f',
  ])
  ctx.print(ctx.capture('sort', [], { input: found }).stdout)
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  prepare: (ctx) => {
    ctx.log.step('Surface root sandbox')
    ctx.log.info(
      'report     : the plan against an unmoved tree, nothing written',
    )
    ctx.log.info(
      'write      : the move applied with git mv and the citations rewritten',
    )
    ctx.log.info(
      'idempotent : a second run over the moved tree, rewriting nothing',
    )
    ctx.log.info(
      'unmoved    : a tree the verb never ran in, still resolving the old root',
    )
  },
  arms: {
    report: (ctx) => {
      seedSurfaces(ctx)
      ctx.log.step('Running: canon migrate surface-roots --root .')
      runCli(ctx, 'migrate', 'surface-roots', '--root', '.', '--json')
      ctx.log.info('Expect: exit 2, moves 3, and wrote false')
      ctx.log.info(
        'Expect: docs/guide.md and the wireframes index each carrying 1 rewrite',
      )
      listFiles(ctx)
      ctx.log.info('Expect: every surface still under the old root')
    },
    write: (ctx) => {
      seedSurfaces(ctx)
      ctx.log.step('Running: canon migrate surface-roots --root . --write')
      runCli(
        ctx,
        'migrate',
        'surface-roots',
        '--root',
        '.',
        '--write',
        '--json',
      )
      ctx.log.step('Reading the index back')
      ctx.run('git', ['status', '--short'])
      ctx.log.info(
        'Expect: three renames into canon/, reported by git as R rather than a delete and an add',
      )
      ctx.print(ctx.readFile('docs/guide.md'))
      ctx.log.info('Expect: the citation spelling canon/context/index.md')
      listFiles(ctx)
      ctx.log.info(
        'Expect: rules/core/005-behavior.md still under the old root',
      )
    },
    idempotent: (ctx) => {
      seedSurfaces(ctx)
      runCli(
        ctx,
        'migrate',
        'surface-roots',
        '--root',
        '.',
        '--write',
        '--json',
      )
      ctx.git('add', '-A')
      ctx.log.step('Running: canon migrate surface-roots --root . (second run)')
      runCli(ctx, 'migrate', 'surface-roots', '--root', '.', '--json')
      ctx.log.info(
        'Expect: exit 0, moves 0, rewritten 0, and an empty paths list',
      )
    },
    unmoved: (ctx) => {
      seedSurfaces(ctx)
      ctx.log.step('Running: canon context audit . --json')
      runCli(ctx, 'context', 'audit', '.', '--json')
      ctx.log.info(
        'Expect: the context folder resolved under the old root, since nothing moved it',
      )
    },
  },
})
