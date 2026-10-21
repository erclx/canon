import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { PROJECT_ROOT } from '@/roots/project'
import { readStamp } from '@/sync/stamp'
import {
  intro,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/cli/ui'
import { type ChangelogReport, resolveChangelog } from '@/version/changelog'
import { readInstalled, UNKNOWN_LABEL } from '@/version/installed'

interface ChangelogOptions {
  readonly since?: string
  readonly root?: string
  readonly json?: boolean
}

const REFUSALS = {
  'no-stamp':
    'the target carries no stamped version and --since named none, so there is no start to range from',
  'no-changelog':
    'the installed package carries no CHANGELOG.md with release entries to read',
  'unknown-version':
    'the changelog lists no such release, so the range would be a guess',
} as const

const HELP = [
  '',
  'Prints the release entries after a version, up to the running one, from the',
  'CHANGELOG.md the installed package ships. It reads no registry and needs no',
  '`gh`, so it answers offline.',
  '',
  'The start defaults to the oldest `version` across the target stamp domains,',
  'since the oldest domain is the one furthest behind. --since overrides it.',
  '',
  'Exit codes:',
  '  0  the range was read, empty when the target is already current',
  '  1  refused, with the reason on stderr',
  '',
  'A refusal names a "reason" rather than printing an empty range. no-stamp',
  'means no start was recorded or given, no-changelog means the file or its',
  'release headings are missing, and unknown-version means the start or the',
  'running version is absent from the file, which covers a pre-release and a',
  'start newer than the binary.',
  '',
  'The JSON carries "since", "running", and "entries", each an object with the',
  'release "version" and its raw "markdown". Read the record rather than the',
  'exit when a skill consumes this, since a shell function wrapping the binary',
  'may flatten the status.',
  '',
  'Examples:',
  '  canon changelog',
  '  canon changelog --since 5.47.0 --json',
  '  canon changelog --root ../frameboard',
  '',
].join('\n')

export function register(program: Command): void {
  program
    .command('changelog')
    .description(
      'Print the release entries after a version up to the running one',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--since <version>',
      'Start after this version instead of the stamp',
    )
    .option('--root <path>', 'Target whose stamp sets the start', '.')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText('after', HELP)
    .action((opts: ChangelogOptions) => {
      process.exitCode = runChangelog(opts)
    })
}

function readChangelogText(): string | undefined {
  const path = join(PROJECT_ROOT, 'CHANGELOG.md')

  return existsSync(path) ? readFileSync(path, 'utf8') : undefined
}

function stampedVersions(root: string): string[] {
  const stamp = readStamp(root)
  if (stamp === undefined) return []

  return Object.values(stamp.domains)
    .map((domain) => domain?.version)
    .filter((version): version is string => version !== undefined)
}

function runChangelog(opts: ChangelogOptions): number {
  intro('canon changelog')

  const root = resolve(opts.root ?? '.')
  const report = resolveChangelog({
    text: readChangelogText(),
    running: readInstalled().version ?? UNKNOWN_LABEL,
    since: opts.since,
    stamped: stampedVersions(root),
  })

  if (report.kind === 'range') {
    reportRange(report)
  } else {
    reportRefusal(report)
  }
  outro()

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report)}\n`)
  }

  return report.kind === 'range' ? 0 : 1
}

function reportRange(
  report: Extract<ChangelogReport, { kind: 'range' }>,
): void {
  logStep('Range')
  logInfo(`${report.since} to ${report.running}`)

  if (report.entries.length === 0) {
    logInfo('No release after the start, so nothing is pending')
    return
  }

  logStep(plural(report.entries.length, 'release'))
  for (const entry of report.entries) {
    pipeOutput(entry.markdown)
  }
}

function reportRefusal(
  report: Extract<ChangelogReport, { kind: 'refused' }>,
): void {
  logStep('Refused')
  const version = report.version === undefined ? '' : ` (${report.version})`
  logWarn(`${report.reason}${version}: ${REFUSALS[report.reason]}`)
}
