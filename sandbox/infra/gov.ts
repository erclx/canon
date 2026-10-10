import { basename, dirname, join, relative } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

const STALE_LIMIT = 2

function sortLines(ctx: StageContext, text: string): string[] {
  return ctx
    .capture('sort', [], { input: text })
    .stdout.split('\n')
    .filter((line) => line !== '')
}

function findMarkdown(ctx: StageContext, dir: string): string[] {
  return sortLines(
    ctx,
    ctx.read('find', [dir, '-type', 'f', '-name', '*.md']),
  )
}

/** Where a rule lands under a consumed root, keeping the folder it sits in at the source. */
function ruleDest(rulesDir: string, file: string, base: string): string {
  const subdir = dirname(relative(rulesDir, file))
  const rule = basename(file, '.md')

  return subdir === '.' ? `${base}/${rule}.md` : `${base}/${subdir}/${rule}.md`
}

function copyRule(ctx: StageContext, file: string, dest: string): void {
  ctx.mkdir(dirname(dest))
  ctx.run('cp', [file, dest])
}

function commitIn(ctx: StageContext, message: string): void {
  ctx.git('-C', 'test-order', 'add', '.')
  ctx.git('-C', 'test-order', 'commit', '-q', '-m', message)
}

function seedTestOrderHistory(ctx: StageContext): void {
  ctx.git('init', '-q', '--initial-branch=main', 'test-order')
  ctx.git('-C', 'test-order', 'config', 'user.email', 'sandbox@example.com')
  ctx.git('-C', 'test-order', 'config', 'user.name', 'Sandbox')

  ctx.write('test-order/src/seed.ts', 'export const seed = 1\n')
  ctx.write('test-order/src/seed.test.ts', '// covers seed\n')
  commitIn(ctx, 'chore: seed the tree')
  ctx.git('-C', 'test-order', 'checkout', '-q', '-b', 'feat/parser')

  ctx.write('test-order/src/parser.ts', 'export const parser = 1\n')
  commitIn(ctx, 'feat: add the parser')

  ctx.write('test-order/src/parser.test.ts', '// covers parser\n')
  commitIn(ctx, 'test: cover the parser')

  ctx.write('test-order/src/reader.test.ts', '// covers reader\n')
  commitIn(ctx, 'test: cover the reader')

  ctx.write('test-order/src/reader.ts', 'export const reader = 1\n')
  commitIn(ctx, 'feat: add the reader')

  ctx.write('test-order/src/seed.ts', 'export const seed = 2\n')
  commitIn(ctx, 'refactor: rewrite the seed')
}

function verb(ctx: StageContext, ...args: string[]): never {
  return ctx.exec('bun', [join(ctx.root, 'src', 'cli.ts'), ...args])
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  prepare: (ctx) => {
    ctx.mkdir('install')
    ctx.write('install/.gitkeep', '')

    const rulesDir = join(ctx.root, 'governance', 'rules')
    const rules = findMarkdown(ctx, rulesDir)

    for (const file of rules.slice(0, STALE_LIMIT)) {
      const dest = ruleDest(rulesDir, file, 'sync/.claude/rules/canon')
      copyRule(ctx, file, dest)
      ctx.append(dest, '# stale\n')
    }

    ctx.mkdir('sync/.claude/rules/canon/core')
    ctx.mkdir('sync/.claude/rules/project/core')
    ctx.write(
      'sync/.claude/rules/canon/core/999-retired.md',
      '# A rule the toolkit retired\n',
    )
    ctx.write(
      'sync/.claude/rules/project/core/900-local.md',
      '# A rule the project wrote\n',
    )

    for (const file of rules)
      copyRule(ctx, file, ruleDest(rulesDir, file, 'build/.claude/rules/canon'))

    // `regen/` is the one arm shaped like the toolkit rather than like a target,
    // because `gov regen` produces a repository's own consumed copy and refuses
    // nothing. It needs a stack catalog, a record, and an internal rule to reach
    // every branch the producer has.
    ctx.mkdir('regen/internal/rules/claude')
    ctx.mkdir('regen/.claude/rules/canon/claude')
    ctx.run('cp', ['-R', join(ctx.root, 'governance'), 'regen/governance'])

    ctx.fixtures('infra', 'gov', 'shared', 'regen')

    // A destination-only file the regen must delete, and a drifted copy it must
    // overwrite. Together they are the before state the run is judged against.
    ctx.write(
      'regen/.claude/rules/canon/claude/999-orphan.md',
      '# orphan, no source anywhere\n',
    )
    ctx.mkdir('regen/.claude/rules/canon/claude')
    ctx.run('cp', [
      join(rulesDir, 'claude', '566-output.md'),
      'regen/.claude/rules/canon/claude/566-output.md',
    ])
    ctx.append('regen/.claude/rules/canon/claude/566-output.md', '# stale\n')

    ctx.git('add', '.')
    ctx.commit('chore(sandbox): scaffold gov test directories')

    // A repository of its own, built after the outer commit so the outer tree
    // never records it as a gitlink. `test-order` reads history rather than a
    // tree, so its fixture has to be commits in an order rather than files in a
    // directory. The three commits below produce one verdict each.
    seedTestOrderHistory(ctx)

    ctx.log.step('Governance sandbox')
    ctx.log.info('install/ : clean target, no rules present')
    ctx.log.info(
      'sync/    : stale .claude/rules/canon/ present, canon/core/999-retired.md deleted, project/core/900-local.md kept',
    )
    ctx.log.info(
      'build/   : full .claude/rules/ present, generates .canon/tmp/gov/rules.md',
    )
    ctx.log.info('list     : read-only catalog dump, no target needed')
    ctx.log.info('regen/   : toolkit-shaped root, orphan and drifted rule present')
    ctx.log.info(
      'test-order/ : own history, one pair per verdict on feat/parser',
    )
  },
  arms: {
    install: (ctx) => {
      ctx.log.step('Running: canon gov install astro --add 200-react install/')
      verb(ctx, 'gov', 'install', 'astro', '--add', '200-react', 'install/')
    },
    sync: (ctx) => {
      ctx.log.step('Running: canon gov sync')
      verb(ctx, 'gov', 'sync', 'sync/')
    },
    build: (ctx) => {
      ctx.log.step('Running: canon gov build')
      verb(ctx, 'gov', 'build', 'build/')
    },
    list: (ctx) => {
      ctx.log.step('Running: canon gov list')
      verb(ctx, 'gov', 'list')
    },
    regen: (ctx) => {
      ctx.log.step('Running: canon gov regen --root regen/')
      // The command prints nothing on success, so the tree after it is the whole
      // result. Listed rather than exec'd for that reason.
      ctx.run('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'gov',
        'regen',
        '--root',
        'regen/',
      ])
      ctx.log.step('Produced regen/.claude/rules')
      const found = ctx.read('find', [
        'regen/.claude/rules',
        '-type',
        'f',
        '-name',
        '*.md',
      ])
      ctx.print(
        sortLines(ctx, found)
          .map((line) => `${line.replace(/^regen\/\.claude\/rules\//, '')}\n`)
          .join(''),
      )
      ctx.log.info(
        '599-sandbox-local.md present, 999-orphan.md gone, 566-output.md restored',
      )
    },
    'test-order': (ctx) => {
      // Both streams and the status land on disk, because `canon sandbox check`
      // reads the tree and nothing else. The record carries a verdict per module
      // and the status carries the exit, so the arm asserts the classification
      // separately from the code a finding is meant to produce.
      //
      // The status is held rather than left to stop the arm. A finding exits 2 by
      // design, so an abort would kill the scenario on the outcome the arm exists
      // to observe. The five arms above exec and leave theirs on the terminal.
      ctx.log.step('Running: canon gov test-order --root test-order')
      const result = ctx.capture('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'gov',
        'test-order',
        '--root',
        'test-order',
        '--json',
      ])
      ctx.write('test-order-record.json', result.stdout)
      ctx.write('test-order-frame.log', result.stderr)
      ctx.write('test-order-status.txt', `${result.status}\n`)
      ctx.print(result.stderr, 'stderr')
      ctx.log.info('test-order-record.json carries a verdict per module')
      ctx.log.info('test-order-status.txt  carries the exit the run produced')
      ctx.log.info('Expect: declared in fixtures/infra/gov/test-order/expect.toml')
      ctx.log.info('        Check it with: canon sandbox check infra:gov test-order')
    },
  },
})
