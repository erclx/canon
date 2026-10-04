import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  type Advisory,
  auditDependencies,
  type AuditRefusal,
  countBySeverity,
  SEVERITIES,
} from '@/deps/audit'
import {
  intro,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/cli/ui'

interface AuditCommandOptions {
  readonly json?: boolean
}

/** What a reader does about each way the advisory list fails to arrive. */
const REFUSALS: Record<AuditRefusal, string> = {
  'no-manifest': 'No package.json here, so there is no dependency set to read.',
  'no-lockfile':
    'No lockfile beside the manifest, so no dependency set is resolved yet. Install first.',
  'no-record':
    'The advisory lookup returned no record. Check the network, then re-run.',
}

export function register(program: Command): void {
  const deps = program
    .command('deps')
    .description('Read the installed dependency set for published advisories')
    .helpOption('-h, --help', 'Show this help message')

  deps
    .command('audit')
    .description('Report advisories against the dependencies already resolved')
    .argument('[path]', 'Project to audit, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        "  The resolved dependency set, read through the runtime's own",
        '  advisory command. This reaches a network, so a lookup that fails',
        '  refuses rather than reporting a clean tree.',
        '',
        'Exit codes:',
        '  0  no advisory against the resolved set',
        '  1  refused, with the reason on stderr',
        '  2  at least one advisory was published',
        '',
        'Examples:',
        '  canon deps audit',
        '  canon deps audit --json',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: AuditCommandOptions) => {
      process.exitCode = await runAudit(path, opts)
    })
}

function severityLine(counts: Record<string, number>): string {
  return SEVERITIES.filter((severity) => counts[severity] !== 0)
    .map((severity) => `${counts[severity]} ${severity}`)
    .join(', ')
}

/**
 * Groups by package, since one dependency commonly carries several advisories
 * and a flat list reads as more distinct upgrades than the tree actually owes.
 */
function byPackage(advisories: readonly Advisory[]): Map<string, Advisory[]> {
  const grouped = new Map<string, Advisory[]>()

  for (const advisory of advisories) {
    const held = grouped.get(advisory.package) ?? []
    held.push(advisory)
    grouped.set(advisory.package, held)
  }

  return grouped
}

async function runAudit(
  path: string | undefined,
  opts: AuditCommandOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon deps audit')

  const audit = await auditDependencies(root)

  if (audit.kind === 'refused') {
    logStep('Refused')
    logWarn(REFUSALS[audit.reason])
    if (audit.message !== undefined) logWarn(audit.message)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: audit.reason,
          message: audit.message ?? REFUSALS[audit.reason],
        })}\n`,
      )
    }
    return 1
  }

  const counts = countBySeverity(audit.advisories)

  logStep('Advisories')
  if (audit.advisories.length === 0) {
    logInfo('No advisory against the resolved dependency set.')
  } else {
    const grouped = byPackage(audit.advisories)
    const total = audit.advisories.length

    logWarn(
      `${total} ${total === 1 ? 'advisory' : 'advisories'} across ${plural(grouped.size, 'package')}: ${severityLine(counts)}`,
    )

    // Piped rather than logged line by line, since every one of these is a
    // finding and the timeline's own tick would mark each as something that
    // passed. The frame stays, and the list inside it stays unmarked.
    pipeOutput(
      [...grouped]
        .map(([name, held]) =>
          [
            `${name}: ${severityLine(countBySeverity(held))}`,
            ...held.flatMap((advisory) => [
              `  ${advisory.severity.padEnd(8)} ${advisory.title}`,
              `  ${' '.repeat(8)} ${advisory.url}`,
            ]),
          ].join('\n'),
        )
        .join('\n'),
    )
  }

  // Stated whichever way the count went. An advisory arrives when someone
  // publishes one, so this number moves with no edit here, and a report that
  // does not date itself reads as a fact about the tree rather than about a day.
  logStep('Reading')
  logInfo(
    'Measured against the advisory index at run time, not at commit time.',
  )

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        severities: counts,
        advisories: audit.advisories,
      })}\n`,
    )
  }

  return audit.advisories.length === 0 ? 0 : 2
}
