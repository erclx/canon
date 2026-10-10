import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

// A record tree at whichever root the caller names, so one seeder serves both
// sides of the fallback. The arms below differ only in that argument, which is
// what keeps a difference in outcome attributable to the resolution rather than
// to two fixtures that drifted apart. The records are stored once under a
// neutral folder and moved to the named root, since a stored `.canon/` path
// would be ignored and a stored `.claude/` path would pin the fallback's other
// branch.
function seedRecords(ctx: StageContext, root: string, scratch: string): void {
  ctx.mkdir(`${root}/plans/archive`)
  ctx.mkdir(`${root}/tasks`)
  ctx.mkdir(`${root}/memory`)
  ctx.mkdir(`${root}/${scratch}`)

  ctx.fixtures('infra', 'record-root', 'shared', 'records')
  ctx.run('cp', ['-R', 'seed-records/.', `${root}/`])
  ctx.run('rm', ['-rf', 'seed-records'])

  // A second plan, already archived, is what the task points at. A live target
  // would have `tasks archive` carry the plan across as well, which moves a file
  // this arm is measuring the root of and answers nothing about where it
  // resolved. The live one beside it is what gives `records validate plans` a
  // record to count, since the walk skips the archive.
  ctx.run('cp', [
    `${root}/plans/feature-live-row.md`,
    `${root}/plans/archive/feature-shipped-row.md`,
  ])

  ctx.write(`${root}/${scratch}/note.txt`, 'scratch\n')
}

function runCli(ctx: StageContext, ...args: string[]): void {
  const status = ctx.run('bun', [join(ctx.root, 'src', 'cli.ts'), ...args], {
    allowFailure: true,
  })
  ctx.log.info(`Exit code: ${status}`)
}

/** `find` exits non-zero on an absent argument, so the arm names none it expects missing. */
function listTree(ctx: StageContext): void {
  const found = ctx.read('find', ['.', '-not', '-path', './.git/*'])
  ctx.print(ctx.capture('sort', [], { input: found }).stdout)
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  prepare: (ctx) => {
    ctx.log.step('Record root sandbox')
    ctx.log.info(
      'migrated        : records staged at .canon/, every verb resolves there',
    )
    ctx.log.info(
      "unmigrated      : the same records at .claude/, the fallback's other branch",
    )
    ctx.log.info(
      'refusal         : neither root carries the folder, so both are named',
    )
    ctx.log.info(
      'migrate         : the verb moving an unmigrated tree, then re-running clean',
    )
    ctx.log.info(
      'migrate-refusal : the same tree with no .canon/ ignore entry to land under',
    )
    ctx.log.info(
      'record-tree     : the sweep inside the records, live against archive and trail',
    )
    ctx.log.info(
      'records-push    : push and pull across the moved history, and the split-root refusal',
    )
  },
  arms: {
    migrated: (ctx) => {
      seedRecords(ctx, '.canon', 'tmp')
      ctx.log.step('Running: canon records validate plans --root .')
      runCli(ctx, 'records', 'validate', 'plans', '--root', '.', '--json')
      ctx.log.info('Expect: 1 record read, the live plan under .canon/plans')
      ctx.log.info(
        'Expect: ok true rather than a no-folder refusal, which is the resolution',
      )
      ctx.log.step('Running: canon records size --root . --json')
      runCli(ctx, 'records', 'size', '--root', '.', '--json')
      ctx.log.info(
        'Expect: plans, tasks, and memory present, read under .canon/',
      )
      ctx.log.info('Expect: the .tmp entry present, read from .canon/tmp')
      ctx.log.step('Running: canon tasks archive v1.1-staged-row --root .')
      runCli(
        ctx,
        'tasks',
        'archive',
        'v1.1-staged-row',
        '--root',
        '.',
        '--json',
      )
      ctx.log.info(
        'Expect: from and to both spelling .canon/tasks/, not a flat sibling',
      )
      ctx.log.step('Reading the tree back')
      listTree(ctx)
      ctx.log.info(
        'Expect: no .claude/ directory, since nothing on this branch creates one',
      )
    },
    unmigrated: (ctx) => {
      seedRecords(ctx, '.claude', '.tmp')
      ctx.log.step('Running: canon records validate plans --root .')
      runCli(ctx, 'records', 'validate', 'plans', '--root', '.', '--json')
      // This arm asserts the fallback, so the old root is the answer it checks
      // for. A sweep rewriting it leaves the branch reading as covered while
      // checking the migrated case twice.
      ctx.log.info(
        'Expect: 1 record read, the live plan under .claude/plans', // canon-keep-record-root
      )
      ctx.log.step('Running: canon tasks archive v1.1-staged-row --root .')
      runCli(
        ctx,
        'tasks',
        'archive',
        'v1.1-staged-row',
        '--root',
        '.',
        '--json',
      )
      ctx.log.info(
        'Expect: from and to both spelling .claude/tasks/, behavior unchanged', // canon-keep-record-root
      )
    },
    refusal: (ctx) => {
      seedRecords(ctx, '.canon', 'tmp')
      ctx.run('rm', ['-rf', '.canon/memory'])
      ctx.log.step('Running: canon records validate memory --root .')
      runCli(ctx, 'records', 'validate', 'memory', '--root', '.', '--json')
      ctx.log.info(
        'Expect: no-folder naming .canon/memory or .claude/memory', // canon-keep-record-root
      )
      ctx.log.info(
        'Expect: the creation default named second, which is where a write lands',
      )
    },
    migrate: (ctx) => {
      seedRecords(ctx, '.claude', '.tmp')
      ctx.write('.gitignore', '.canon/\n')

      // A record carrying a citation, which nothing else in this fixture has.
      // The ignore file above names the new root alone, which is what the
      // documented first-run order produces, so every record still at the old
      // root is visible to the sweep as though it were source. Without the
      // record-root skip this one file is what the verb reports and rewrites.
      //
      // The seeding line spells the old root twice and is protected for it, so
      // the arm demonstrates the defect it measures rather than becoming an
      // instance.
      ctx.write(
        '.claude/memory/pen-entry.md', // canon-keep-record-root
        'The row is at .claude/plans/feature-live-row.md\n', // canon-keep-record-root
      )

      ctx.log.step('Running: canon migrate records --root .')
      runCli(ctx, 'migrate', 'records', '--root', '.', '--json')
      ctx.log.info(
        'Expect: 12 entries considered, the 4 on disk named as folders to move',
      )
      ctx.log.info(
        'Expect: exit 2 and nothing written, since --write was not passed',
      )
      ctx.log.info(
        'Expect: the pen entry in neither paths nor files, and records counting it',
      )
      ctx.log.step('Running: canon migrate records --root . --write')
      runCli(ctx, 'migrate', 'records', '--root', '.', '--write', '--json')
      ctx.log.step('Reading the tree back')
      listTree(ctx)
      ctx.log.info(
        'Expect: plans, tasks, and memory now under .canon/, and .claude/.tmp as .canon/tmp', // canon-keep-record-root
      )
      ctx.log.info(
        'Expect: no .claude/ directory left, since every seeded entry moved', // canon-keep-record-root
      )
      ctx.log.step('Running: canon records validate plans --root .')
      runCli(ctx, 'records', 'validate', 'plans', '--root', '.', '--json')
      ctx.log.info(
        'Expect: 1 record read, resolved at the root the move produced',
      )
      ctx.log.step('Reading the pen entry back')
      ctx.print(ctx.readFile('.canon/memory/pen-entry.md'))
      ctx.log.info(
        'Expect: the citation still spelling .claude/plans, since a record is never swept', // canon-keep-record-root
      )
      ctx.log.step('Running: canon migrate records --root .')
      runCli(ctx, 'migrate', 'records', '--root', '.', '--json')
      ctx.log.info(
        'Expect: 0 folders and 0 citations, which is the idempotence check',
      )
    },
    'migrate-refusal': (ctx) => {
      seedRecords(ctx, '.claude', '.tmp')
      ctx.write('.gitignore', 'node_modules/\n')
      ctx.log.step('Running: canon migrate records --root .')
      runCli(ctx, 'migrate', 'records', '--root', '.', '--json')
      ctx.log.info(
        'Expect: exit 1 refusing, since this project does not ignore .canon/',
      )
      ctx.log.info(
        'Expect: the repair names canon tooling sync rather than an edit by hand',
      )
      ctx.log.info(
        'Expect: the records still under .claude/, untouched by a refused run', // canon-keep-record-root
      )
      listTree(ctx)
    },
    'record-tree': (ctx) => {
      seedRecords(ctx, '.canon', 'tmp')
      ctx.mkdir('.canon/groundwork/01-closed-trail')

      // One citation of each class the scope has to separate: a live pointer, an
      // archived one, one inside a closed trail, one in scratch, and one a marker
      // protects. Every seeding line spells the old root on purpose and is
      // protected for it, so the tracked sweep leaves this fixture building the
      // state the arm is about rather than turning it into an instance of the
      // defect.
      ctx.append(
        '.canon/tasks/v1.1-staged-row.md',
        'Origin: .claude/groundwork/01-closed-trail/notes.md\n', // canon-keep-record-root
      )
      ctx.write(
        '.canon/plans/archive/feature-shipped-row.md',
        'Superseded by .claude/plans/feature-old.md\n', // canon-keep-record-root
      )
      ctx.write(
        '.canon/groundwork/01-closed-trail/notes.md',
        'Measured in .claude/memory/entry.md\n', // canon-keep-record-root
      )
      ctx.write(
        '.canon/tmp/note.txt',
        'Scratch names .claude/tasks/priority.md\n', // canon-keep-record-root
      )
      ctx.write(
        '.canon/memory/dated.md',
        '<!-- canon-keep-record-root -->\nThe defect landed in .claude/tasks/ back then.\n',
      )

      ctx.log.step('Running: canon migrate record-tree --root .')
      runCli(ctx, 'migrate', 'record-tree', '--root', '.', '--json')
      ctx.log.info(
        'Expect: exit 2, 1 file to change and 1 citation, named with its line text',
      )
      ctx.log.info(
        'Expect: groundwork, tmp, and plans/archive each a count rather than a path list',
      )
      ctx.log.info(
        'Expect: 1 citation marked to keep the old root, which is the dated memory entry',
      )
      ctx.log.step('Running: canon migrate record-tree --root . --write')
      runCli(ctx, 'migrate', 'record-tree', '--root', '.', '--write', '--json')
      ctx.log.step('Running: canon migrate record-tree --root .')
      runCli(ctx, 'migrate', 'record-tree', '--root', '.', '--json')
      ctx.log.info(
        'Expect: exit 0 and 0 citations, which is the idempotence check',
      )
      ctx.log.step('Reading the five seeded citations back')
      ctx.print(ctx.readFile('.canon/tasks/v1.1-staged-row.md'))
      ctx.print(ctx.readFile('.canon/plans/archive/feature-shipped-row.md'))
      ctx.print(ctx.readFile('.canon/groundwork/01-closed-trail/notes.md'))
      ctx.print(ctx.readFile('.canon/tmp/note.txt'))
      ctx.print(ctx.readFile('.canon/memory/dated.md'))
      ctx.log.info(
        'Expect: only the task line at the new root, the other four unchanged',
      )
    },
    'records-push': (ctx) => {
      seedRecords(ctx, '.claude', '.tmp')
      ctx.write('.gitignore', '.canon/\n')

      // A bare repository on this disk stands in for the private records
      // remote. The gate this has to clear compares the records origin against
      // every remote of the project, and a sandbox project has none, so a local
      // path passes it the way a real private repository would.
      const origin = `${ctx.dir}/../records-origin.git`
      rmSync(origin, { recursive: true, force: true })
      ctx.git('init', '--quiet', '--bare', origin)

      // A push lands on one branch per project, named from the project's own
      // origin or directory, so the read follows whichever branch the push made
      // rather than naming one.
      const originTree = (): void => {
        const branch = ctx
          .read('git', [
            '-C',
            origin,
            'for-each-ref',
            '--count=1',
            '--format=%(refname:short)',
            'refs/heads',
          ])
          .trim()
        const listing = ctx.read('git', [
          '-C',
          origin,
          'ls-tree',
          '-r',
          '--name-only',
          branch,
        ])
        ctx.print(ctx.capture('sort', [], { input: listing }).stdout)
      }

      // The history is opened at the old root because this arm builds an
      // unmigrated tree, which is what gives the split-root refusal below
      // something to refuse. A sweep rewriting either line would have the arm
      // push a tree that was never split.
      ctx.git(
        '--git-dir=.claude/.records.git', // canon-keep-record-root
        'init',
        '--quiet',
      )
      ctx.git(
        '--git-dir=.claude/.records.git', // canon-keep-record-root
        'remote',
        'add',
        'origin',
        origin,
      )

      ctx.log.step('Running: canon records push --root .')
      runCli(ctx, 'records', 'push', '--root', '.', '--json')
      ctx.log.info(
        'Expect: ok true, the three seeded folders, and a commit on the bare origin',
      )
      ctx.log.step('Reading the origin back')
      originTree()
      ctx.log.info(
        'Expect: bare paths such as tasks/index.md, with no record root in any of them',
      )

      // Half a move is what a failed rename leaves, and it is the state the push
      // guard exists for. Moving one folder is enough: `recordRoot` then answers
      // `.canon` for the whole tree while the index still names the eight left
      // behind, so an unguarded `add -A` would stage every one of them as
      // deleted.
      ctx.log.step('Half-migrating the tree, one folder moved')
      ctx.mkdir('.canon')
      ctx.run('mv', [
        '.claude/memory', // canon-keep-record-root
        '.canon/memory',
      ])
      ctx.log.step('Running: canon records push --root .')
      runCli(ctx, 'records', 'push', '--root', '.', '--json')
      ctx.log.info(
        'Expect: ok false with reason split-roots, naming the two left at .claude/',
      )
      ctx.log.step('Reading the origin back')
      originTree()
      ctx.log.info(
        'Expect: unchanged, so the refusal is what kept the folders on the remote',
      )
      ctx.log.step('Running: canon records pull --root .')
      runCli(ctx, 'records', 'pull', '--root', '.', '--json')
      ctx.log.info(
        'Expect: ok false with reason split-roots, the same reading from the other verb',
      )

      ctx.log.step('Finishing the move')
      runCli(ctx, 'migrate', 'records', '--root', '.', '--write', '--json')
      ctx.log.step('Running: canon records push --root .')
      runCli(ctx, 'records', 'push', '--root', '.', '--json')
      ctx.log.info(
        'Expect: ok true again, the work tree now resolving at .canon/',
      )
      ctx.log.step('Reading the origin back')
      originTree()
      ctx.log.info(
        'Expect: the same paths and changed 0, since the history stores none of the root',
      )
    },
  },
})
