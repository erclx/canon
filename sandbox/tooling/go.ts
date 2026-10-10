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
      if (!hasCommand(ctx, 'go'))
        ctx.fail('go is not installed. Install from https://go.dev/dl/')
      if (!hasCommand(ctx, 'golangci-lint'))
        ctx.fail(
          "golangci-lint is not installed. Run 'go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest'",
        )

      ctx.log.step('Scaffolding go (go mod init)')
      ctx.run('go', ['mod', 'init', 'example.com/sandbox-go'], QUIET)
      ctx.run('go', ['mod', 'edit', '-ignore=./node_modules'])
      ctx.log.info('go mod init complete, node_modules ignored')

      ctx.log.step('Seeding package.json (bun init -y)')
      ctx.run('bun', ['init', '-y'], QUIET)
      ctx.log.info('package.json created')

      ctx.log.step('Applying go stack (base + go via extends)')
      ctx.run('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'tooling',
        'inject',
        'go',
        '.',
        '--nested',
      ])

      ctx.log.step('Initializing Husky')
      ctx.run('bunx', ['husky'])

      ctx.log.step('Setting script permissions')
      makeScriptsExecutable(ctx)
      ctx.log.info('Scripts made executable')

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

      ctx.log.step('Scenario ready: go tooling test')
      ctx.log.info(
        'Context: golden configs from tooling/base + tooling/go applied',
      )
      ctx.log.info("Action:  inspect configs, run 'bun run check' to verify")
    },
  },
})
