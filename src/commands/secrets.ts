import { resolve } from 'node:path'
import type { Command } from 'commander'
import { type ScanRefusal, scanShippedTree } from '@/secrets/scan'
import {
  intro,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  plural,
} from '@/cli/ui'

interface ScanCommandOptions {
  readonly json?: boolean
}

/** What a reader does about each way the corpus fails to build. */
const REFUSALS: Record<ScanRefusal, string> = {
  'no-manifest':
    'No package.json here, so nothing is published from this tree.',
  'no-publish':
    'The manifest declares private, so this project publishes nothing.',
  // Stated as an unread corpus rather than an absent one. A publish with no
  // files field packs the whole tree, so this is the package that ships the
  // most, and calling it nothing to read is the denial the reasoning in
  // src/secrets/shipped.ts warns against.
  'no-files-field':
    'package.json declares no files field, so a publish would pack the whole tree. This check reads a declared corpus and left that one unread.',
  'no-git': 'git could not list this tree, so the corpus is unknown.',
  'no-shipped-files':
    'The files field matched nothing git lists, so nothing would be scanned.',
}

export function register(program: Command): void {
  const secrets = program
    .command('secrets')
    .description('Read committed state for credentials that ship to a target')
    .helpOption('-h, --help', 'Show this help message')

  secrets
    .command('scan')
    .description('Report credential-shaped values in the tree this repo ships')
    .argument(
      '[path]',
      'Repository to scan, defaulting to the current directory',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        "  The package's own files field, so the corpus is what npm packs",
        '  and what the plugin ships. Nothing outside it is read.',
        '',
        'Exit codes:',
        '  0  the shipped tree carries no credential-shaped value',
        '  1  refused, with the reason on stderr',
        '  2  at least one value was found',
        '',
        'Examples:',
        '  canon secrets scan',
        '  canon secrets scan --json',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: ScanCommandOptions) => {
      process.exitCode = await runScan(path, opts)
    })
}

async function runScan(
  path: string | undefined,
  opts: ScanCommandOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon secrets scan')

  const scan = await scanShippedTree(root)

  if (scan.kind === 'refused') {
    logStep('Refused')
    logWarn(REFUSALS[scan.reason])
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: scan.reason,
          message: REFUSALS[scan.reason],
        })}\n`,
      )
    }
    return 1
  }

  logStep('Corpus')
  logInfo(
    `${plural(scan.files, 'file')} read, ${scan.skipped} skipped as binary or unreadable`,
  )
  // Stated on every run, including a clean one. The corpus answers what the
  // package publishes, and a reader who sees only the passing count reads the
  // verdict as covering the repository.
  logInfo(
    `${scan.listed - scan.files - scan.skipped} of ${scan.listed} listed files sit outside the published corpus and were not read`,
  )

  logStep('Findings')
  if (scan.findings.length === 0) {
    logInfo('No credential-shaped value in the shipped tree.')
  } else {
    logError(plural(scan.findings.length, 'value'))
    for (const finding of scan.findings) {
      logWarn(
        `${finding.file}:${finding.line}:${finding.column}  ${finding.label}  ${finding.preview}`,
      )
    }
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        files: scan.files,
        skipped: scan.skipped,
        listed: scan.listed,
        findings: scan.findings,
      })}\n`,
    )
  }

  return scan.findings.length === 0 ? 0 : 2
}
