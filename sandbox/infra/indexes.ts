import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

function seedFolder(ctx: StageContext): void {
  ctx.fixtures('infra', 'indexes', 'shared', 'folder')
}

function seedNestedFolder(ctx: StageContext): void {
  seedFolder(ctx)
  ctx.fixtures('infra', 'indexes', 'nested', '01-guides')
}

function seedBareFolder(ctx: StageContext): void {
  ctx.fixtures('infra', 'indexes', 'bootstrap', '01-bare')
}

function seedNoCandidate(ctx: StageContext): void {
  ctx.fixtures('infra', 'indexes', 'no-candidate', '01-claude')
}

function seedGitRepo(ctx: StageContext): void {
  seedFolder(ctx)
  ctx.git('init', '-q')
  ctx.identity()
  ctx.git('add', '.')
  ctx.git('commit', '-q', '-m', 'chore: seed indexed docs')
  ctx.write(
    'docs/alpha.md',
    ctx
      .readFile('docs/alpha.md')
      .replace(
        /description: First sample entry/gm,
        'description: Updated first entry',
      ),
  )
  ctx.git('add', 'docs/alpha.md')
}

function regen(ctx: StageContext, ...args: string[]): number {
  return ctx.run('bun', [
    join(ctx.root, 'src', 'cli.ts'),
    'indexes',
    'regen',
    ...args,
  ])
}

function execRegen(ctx: StageContext, ...args: string[]): never {
  return ctx.exec('bun', [
    join(ctx.root, 'src', 'cli.ts'),
    'indexes',
    'regen',
    ...args,
  ])
}

/** Holds the status rather than stopping on it, for a verb that exits 2 on drift by design. */
function captureRegen(
  ctx: StageContext,
  args: string[],
): { status: number; stdout: string; stderr: string } {
  return ctx.capture('bun', [
    join(ctx.root, 'src', 'cli.ts'),
    'indexes',
    'regen',
    ...args,
  ])
}

function printStagedNames(ctx: StageContext, file: string): void {
  ctx.log.step('git diff --cached --name-only')
  const names = ctx.read('git', ['diff', '--cached', '--name-only'])
  ctx.write(file, names)
  ctx.print(names, 'stderr')
  ctx.log.step('git status --short')
  ctx.log.pipe(ctx.read('git', ['status', '--short']))
}

export default scenario({
  prepare: (ctx) => {
    ctx.log.step('Indexes sandbox')
    ctx.log.info('regen       : walks CWD and rewrites every index.md')
    ctx.log.info("nested      : parent index links a child folder's index.md")
    ctx.log.info(
      'dry-run     : reports drift without writing (exits 2 on drift)',
    )
    ctx.log.info('json        : emits machine-readable records on stdout')
    ctx.log.info('opt-out     : adds auto: false to index.md and confirms skip')
    ctx.log.info('path        : passes a positional file and confirms walk-up')
    ctx.log.info('lint-staged : stages sibling, regen stages regenerated index')
    ctx.log.info(
      'no-stage    : same as lint-staged but --no-stage skips git add',
    )
    ctx.log.info(
      'bootstrap   : seeds raw markdown for the indexes phase of the setup skill',
    )
    ctx.log.info(
      'no-candidate: bare CLAUDE.md, no markdown-heavy folder to bootstrap',
    )
  },
  arms: {
    regen: (ctx) => {
      seedFolder(ctx)
      ctx.log.step('Running: canon indexes regen')
      execRegen(ctx)
    },
    nested: (ctx) => {
      seedNestedFolder(ctx)
      ctx.log.step('Running: canon indexes regen')
      regen(ctx)
      ctx.log.step('Generated docs/index.md')
      ctx.log.pipe(ctx.readFile('docs/index.md'))
      ctx.log.info(
        'Expect: docs/index.md links guides/index.md after the sibling files',
      )
    },
    'dry-run': (ctx) => {
      seedFolder(ctx)
      ctx.log.step('Running: canon indexes regen --dry-run')
      // Captured rather than exec'd, mirroring infra:gov's test-order arm: the
      // status is held rather than left to stop the arm, since --dry-run exits 2
      // on drift by design and an abort here would kill the scenario on the
      // outcome the arm exists to observe.
      const result = captureRegen(ctx, ['--dry-run'])
      ctx.write('dry-run-output.log', result.stdout)
      ctx.write('dry-run-frame.log', result.stderr)
      ctx.write('dry-run-status.txt', `${result.status}\n`)
      ctx.print(result.stderr, 'stderr')
      ctx.log.info('dry-run-status.txt carries the exit the run produced')
      ctx.log.info(
        'Expect: declared in fixtures/infra/indexes/dry-run/expect.toml',
      )
    },
    json: (ctx) => {
      seedFolder(ctx)
      ctx.log.step('Running: canon indexes regen --dry-run --json')
      const result = captureRegen(ctx, ['--dry-run', '--json'])
      ctx.write('json-record.json', result.stdout)
      ctx.write('json-frame.log', result.stderr)
      ctx.write('json-status.txt', `${result.status}\n`)
      ctx.print(result.stderr, 'stderr')
      ctx.print(result.stdout, 'stderr')
      ctx.log.info(
        'json-record.json carries a machine-readable record per index',
      )
      ctx.log.info(
        'Expect: declared in fixtures/infra/indexes/json/expect.toml',
      )
    },
    'opt-out': (ctx) => {
      seedFolder(ctx)
      ctx.log.step('Setting auto: false on docs/index.md')
      const lines = ctx.readFile('docs/index.md').split('\n')
      lines.splice(1, 0, 'auto: false')
      ctx.write('docs/index.md', lines.join('\n'))
      ctx.log.step('Running: canon indexes regen')
      execRegen(ctx)
    },
    path: (ctx) => {
      seedFolder(ctx)
      ctx.log.step('Running: canon indexes regen docs/alpha.md')
      execRegen(ctx, 'docs/alpha.md')
    },
    'lint-staged': (ctx) => {
      seedGitRepo(ctx)
      ctx.log.step('Running: canon indexes regen docs/alpha.md')
      regen(ctx, 'docs/alpha.md')
      printStagedNames(ctx, 'lint-staged-diff.txt')
      ctx.log.info('lint-staged-diff.txt carries the cached diff name list')
      ctx.log.info(
        'Expect: docs/index.md present in the cached diff (auto-staged)',
      )
    },
    'no-stage': (ctx) => {
      seedGitRepo(ctx)
      ctx.log.step('Running: canon indexes regen --no-stage docs/alpha.md')
      regen(ctx, '--no-stage', 'docs/alpha.md')
      printStagedNames(ctx, 'no-stage-diff.txt')
      ctx.log.info('no-stage-diff.txt carries the cached diff name list')
      ctx.log.info(
        'Expect: docs/index.md modified in working tree but NOT in cached diff',
      )
    },
    bootstrap: (ctx) => {
      seedBareFolder(ctx)
      ctx.log.step(
        'Seeded docs/ with 5 raw markdown files (no frontmatter, no index.md)',
      )
      ctx.log.info(
        'Open Claude in this sandbox and invoke /canon:target-setup indexes',
      )
      ctx.log.info(
        'The skill should detect docs/ as a candidate and walk the bootstrap flow',
      )
    },
    'no-candidate': (ctx) => {
      seedNoCandidate(ctx)
      ctx.log.step(
        'Seeded a bare CLAUDE.md with no markdown-heavy folder anywhere',
      )
      ctx.log.info(
        'Open Claude in this sandbox and invoke /canon:target-setup indexes',
      )
      ctx.log.info(
        'The skill should report an empty scan and skip straight to the convention seed offer',
      )
    },
  },
})
