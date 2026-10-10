import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

const QUIET = { stdout: 'ignore', stderr: 'ignore' } as const

/** `chmod +x scripts/*.sh`, passing the pattern through unexpanded when nothing matches, as the shell did. */
function makeScriptsExecutable(ctx: StageContext): void {
  const scripts = readdirSync(join(ctx.dir, 'scripts'))
    .filter((name) => name.endsWith('.sh'))
    .sort()
    .map((name) => `scripts/${name}`)
  ctx.run('chmod', ['+x', ...(scripts.length > 0 ? scripts : ['scripts/*.sh'])])
}

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

      ctx.log.step('Setting script permissions')
      makeScriptsExecutable(ctx)
      ctx.log.info('Scripts made executable')

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
      if (ctx.run('bash', ['scripts/verify.sh'], { allowFailure: true }) === 0)
        ctx.log.info('All checks passed')
      else ctx.log.warn('Verification failed, check configs')

      ctx.log.step('Scenario ready: python tooling test')
      ctx.log.info(
        'Context: golden configs from tooling/base + tooling/python applied',
      )
      ctx.log.info("Action:  inspect configs, run 'bun run check' to verify")
    },
  },
})
