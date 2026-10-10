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

function hasCommand(ctx: StageContext, name: string): boolean {
  return Bun.which(name, { PATH: ctx.env.PATH }) !== null
}

export default scenario({
  arms: {
    default: (ctx) => {
      if (!hasCommand(ctx, 'php'))
        ctx.fail('php is not installed. Install PHP 8.3 or later')
      if (!hasCommand(ctx, 'composer'))
        ctx.fail(
          'composer is not installed. Install from https://getcomposer.org/',
        )

      ctx.log.step('Scaffolding php (composer init)')
      ctx.run(
        'composer',
        ['init', '-n', '--name', 'example/sandbox-php', '--autoload', 'src/'],
        QUIET,
      )
      ctx.log.info('composer init complete')

      ctx.log.step('Seeding package.json (bun init -y)')
      ctx.run('bun', ['init', '-y'], QUIET)
      ctx.log.info('package.json created')

      ctx.log.step('Applying php stack (base + php via extends)')
      ctx.run('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'tooling',
        'inject',
        'php',
        '.',
        '--nested',
      ])

      ctx.log.step('Initializing Husky')
      ctx.run('bunx', ['husky'])

      ctx.log.step('Setting script permissions')
      makeScriptsExecutable(ctx)
      ctx.log.info('Scripts made executable')

      ctx.log.step('Installing php tooling deps')
      ctx.log.info(
        "Manifest does not declare these because inject hardcodes 'bun add -D'",
      )
      ctx.run(
        'composer',
        [
          'require',
          '--dev',
          'friendsofphp/php-cs-fixer',
          'phpstan/phpstan',
          'phpunit/phpunit',
        ],
        QUIET,
      )
      ctx.log.info('php-cs-fixer, phpstan, phpunit added')

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

      ctx.log.step('Scenario ready: php tooling test')
      ctx.log.info(
        'Context: golden configs from tooling/base + tooling/php applied',
      )
      ctx.log.info("Action:  inspect configs, run 'bun run check' to verify")
    },
  },
})
