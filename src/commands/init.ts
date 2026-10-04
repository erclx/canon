import type { Command } from 'commander'
import { cliPath, cliRun } from '@/cli/run'
import { PROJECT_ROOT } from '@/roots/project'
import { applyInitOptions, flagsProvided } from '@/init/flags'
import { type InitFlags, parseSkip, planInit } from '@/init/plan'
import { runDomains } from '@/init/run'
import { buildSteps } from '@/init/steps'
import { resolveTarget } from '@/targets/validate'
import {
  intro,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
  select,
} from '@/cli/ui'

interface InitOptions {
  /** Always present: the option falls back to `DEFAULT_STACK`. */
  readonly stack: string
  readonly add?: string
  readonly skip?: string
}

export function register(program: Command): void {
  const command = program
    .command('init')
    .description('Bootstrap a project with base tooling and toolkit domains')
    .argument('[target]', 'Target directory', '.')

  applyInitOptions(command)
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'Passing any option skips the confirmation prompt.',
        '',
        'Examples:',
        '  canon init',
        '  canon init ../my-app',
        '  canon init --stack astro --add 260-shadcn ../my-app',
        '  canon init --skip governance ../my-app',
        '',
      ].join('\n'),
    )
    .action(async (target: string, options: InitOptions, cmd: Command) => {
      process.exitCode = await runInit(target, options, flagsProvided(cmd))
    })
}

async function runInit(
  target: string,
  options: InitOptions,
  skipPrompt: boolean,
): Promise<number> {
  intro('canon init')

  const resolved = resolveTarget(target, PROJECT_ROOT)
  if (typeof resolved === 'number') return resolved

  const skip = parseSkip(options.skip)
  for (const value of skip.unknown) {
    logWarn(`Unknown --skip value: ${value} (ignoring)`)
  }

  const flags: InitFlags = {
    stack: options.stack,
    add: options.add,
    skip,
  }

  const plan = planInit(flags)

  logStep('Core domains')
  for (const line of plan.preview) {
    if (line.level === 'info') logInfo(line.text)
    else logWarn(line.text)
  }

  if (!skipPrompt) {
    const shouldInstall = await select({
      message: `Install ${plan.total} domains to ${target}?`,
      options: [
        { value: true, label: 'Yes' },
        { value: false, label: 'Cancel' },
      ],
      nonInteractiveDefault: true,
    })

    if (!shouldInstall) {
      logWarn('Cancelled')
      outro()
      return 0
    }
  }

  const path = cliPath(PROJECT_ROOT)
  const child = (args: readonly string[]): (() => Promise<boolean>) =>
    cliRun(path, args, { nonInteractive: true, stdin: 'ignore' })

  const failed = await runDomains(buildSteps(target, resolved, flags, child))

  outro()
  process.stderr.write('\n')

  const { GREEN, NC, YELLOW } = palette(process.stderr)

  if (failed.length === 0) {
    process.stderr.write(
      `${GREEN}✓ Project initialized (${plan.total} domains)${NC}\n`,
    )
    return 0
  }

  process.stderr.write(
    `${YELLOW}! Project initialized with ${failed.length} failure(s): ${failed.join(', ')}${NC}\n`,
  )
  return 1
}
