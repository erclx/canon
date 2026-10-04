import { resolve } from 'node:path'
import type { Command } from 'commander'
import { census, type CensusRefusal } from '@/census/count'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'

interface CensusCommandOptions {
  readonly json?: boolean
}

const REFUSALS: Record<CensusRefusal, string> = {
  'no-git': 'git could not list this tree, so the corpus is unknown.',
}

export function register(program: Command): void {
  program
    .command('census')
    .description(
      'Report tracked file count, a breakdown by extension, and line totals',
    )
    .argument('[path]', 'Tree to census, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        '  Tracked files plus untracked files git does not ignore, the same',
        '  corpus the citation check, the markdown corpus, and the secret',
        '  scan already read. A line total skips whatever reads as binary.',
        '',
        'Exit codes:',
        '  0  the census completed',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon census',
        '  canon census src --json',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: CensusCommandOptions) => {
      process.exitCode = await runCensus(path, opts)
    })
}

async function runCensus(
  path: string | undefined,
  opts: CensusCommandOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon census')

  const result = await census(root)

  if (result.kind === 'refused') {
    logStep('Refused')
    logWarn(REFUSALS[result.reason])
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: result.reason,
          message: REFUSALS[result.reason],
        })}\n`,
      )
    }
    return 1
  }

  logStep('Files')
  logInfo(
    `${plural(result.files, 'file')}, ${result.skipped} skipped as binary or unreadable`,
  )

  logStep('By extension')
  for (const entry of result.byExtension) {
    logInfo(
      `${entry.extension}: ${plural(entry.files, 'file')}, ${entry.lines} lines`,
    )
  }

  logStep('Lines')
  logInfo(`${result.lines} counted, skipping binary or unreadable files`)

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        files: result.files,
        skipped: result.skipped,
        lines: result.lines,
        byExtension: result.byExtension,
      })}\n`,
    )
  }

  return 0
}
