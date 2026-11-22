import { join } from 'node:path'
import { scenario } from '@/sandbox/scenario'

const QUIET = { stdout: 'ignore', stderr: 'ignore' } as const
const SUBFOLDER = 'backend'

export default scenario({
  arms: {
    default: (ctx) => {
      if (Bun.which('uv', { PATH: ctx.env.PATH }) === null)
        ctx.fail('uv is not installed. Install from https://docs.astral.sh/uv/')

      ctx.log.step('Scaffolding python (uv init --package)')
      ctx.run(
        'uv',
        ['init', '--package', '--name', 'sandbox-python', '--no-readme', '.'],
        { stdout: 'ignore' },
      )
      ctx.log.info('uv init complete')

      ctx.log.step('Seeding package.json (bun init -y)')
      ctx.run('bun', ['init', '-y'], QUIET)
      ctx.log.info('package.json created')

      ctx.log.step('Applying python stack (base + python via extends)')
      ctx.run('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'tooling',
        'inject',
        'python',
        '.',
        '--nested',
      ])

      ctx.log.step('Initializing Husky')
      ctx.run('bunx', ['husky'])

      ctx.log.step('Installing python tooling deps')
      ctx.log.info(
        "Manifest does not declare these because inject hardcodes 'bun add -D'",
      )
      ctx.run(
        'uv',
        ['add', '--dev', 'ruff', 'mypy', 'pytest', 'pytest-cov'],
        QUIET,
      )
      ctx.log.info('ruff, mypy, pytest, pytest-cov added')

      ctx.log.step('Syncing python venv')
      ctx.run('uv', ['sync'], QUIET)
      ctx.log.info('uv sync complete')

      ctx.log.step('Running lint:fix')
      if (
        ctx.run('bun', ['run', 'lint:fix'], {
          ...QUIET,
          allowFailure: true,
        }) === 0
      )
        ctx.log.info('Auto-fix applied')
      else ctx.log.warn('lint:fix had issues')

      ctx.log.step('Running verification')
      if (ctx.run('bun', ['scripts/verify.ts'], { allowFailure: true }) === 0)
        ctx.log.info('All checks passed')
      else ctx.log.warn('Verification failed, check configs')

      ctx.log.step('Scenario ready: python tooling test')
      ctx.log.info(
        'Context: golden configs from tooling/base + tooling/python applied',
      )
      ctx.log.info("Action:  inspect configs, run 'bun run check' to verify")
    },

    // A Bun root owning base, with python synced into a subfolder through
    // --skip base, so one root check has to reach the subfolder's phases.
    subfolder: (ctx) => {
      if (Bun.which('uv', { PATH: ctx.env.PATH }) === null)
        ctx.fail('uv is not installed. Install from https://docs.astral.sh/uv/')

      const cli = join(ctx.root, 'src', 'cli.ts')

      ctx.log.step('Applying base at the root')
      ctx.fixtures('tooling', 'base', 'shared', 'package')
      ctx.run('bun', [cli, 'tooling', 'inject', 'base', '.', '--nested'])
      ctx.run('bunx', ['husky'])

      ctx.log.step(`Scaffolding python in ${SUBFOLDER}`)
      ctx.run(
        'uv',
        [
          'init',
          '--package',
          '--vcs',
          'none',
          '--author-from',
          'none',
          '--name',
          'sandbox-python',
          '--no-readme',
          SUBFOLDER,
        ],
        { stdout: 'ignore' },
      )
      if (ctx.readFile(`${SUBFOLDER}/pyproject.toml`).includes('authors'))
        ctx.fail('pyproject.toml carries an authors field')
      ctx.log.info('pyproject.toml carries no authors field')

      ctx.log.step(`Syncing python into ${SUBFOLDER} without base`)
      ctx.run('bun', [
        cli,
        'tooling',
        'sync',
        'python',
        SUBFOLDER,
        '--skip',
        'base',
        '--write',
      ])
      if (!ctx.readFile(`${SUBFOLDER}/.gitignore`).includes('__pycache__/'))
        ctx.fail(`${SUBFOLDER}/.gitignore does not ignore __pycache__/`)
      ctx.log.info(`${SUBFOLDER}/.gitignore ignores __pycache__/`)

      ctx.log.step('Installing python tooling deps')
      ctx.run(
        'uv',
        [
          '--directory',
          SUBFOLDER,
          'add',
          '--dev',
          'ruff',
          'mypy',
          'pytest',
          'pytest-cov',
        ],
        QUIET,
      )
      ctx.run('bun', ['run', '--cwd', SUBFOLDER, 'lint:fix'], QUIET)
      // uv add rewrites pyproject.toml in its own layout, which the root
      // format check then reads.
      ctx.run('bun', ['run', 'format'], QUIET)
      ctx.git('add', '-A')

      ctx.log.step('Running the root check')
      const check = ctx.capture('bun', ['scripts/verify.ts'])
      ctx.log.pipe(check.stdout)
      if (!check.stdout.includes(`Nested root ${SUBFOLDER}`))
        ctx.fail(`The root check never ran ${SUBFOLDER}`)
      if (check.status === 0)
        ctx.log.info('Root check passed with the subfolder')
      else ctx.log.warn('Root check failed, check configs')

      ctx.log.step('Scenario ready: python subfolder of a base root')
      ctx.log.info(`Context: python synced into ${SUBFOLDER} with --skip base`)
      ctx.log.info("Action:  run 'bun run check' at the root to verify")
    },
  },
})
