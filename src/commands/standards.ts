import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  auditExitCode,
  auditStandards,
  type StandardsAudit,
} from '@/standards/audit'
import { listStandardEntries } from '@/standards/list'
import { listStandards, readStandard, resolveStandard } from '@/standards/read'
import {
  frameError,
  intro,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/ui'

interface StandardsListOptions {
  readonly json?: boolean
}

interface StandardsAuditOptions {
  readonly json?: boolean
  readonly arrivalsOnly?: boolean
}

export function register(program: Command): void {
  const standards = program
    .command('standards')
    .description('Standards commands (list, audit, <name>)')
    .argument('[name]', 'Standard to print, by name with or without .md')
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'A name resolves under standards/ at the working root, then the corpus',
        'inside the canon package. No standard installs into a project, so the',
        'package corpus is what answers there. The frame names the copy it read.',
        '',
        'Examples:',
        '  canon standards markdown',
        '  canon standards markdown.md',
        '',
      ].join('\n'),
    )
    .action((name: string | undefined, _options: unknown, cmd: Command) => {
      if (name === undefined) {
        // Registering an action replaces commander's own no-action fallback,
        // which writes this help to stderr. Help is UI rather than data, and
        // the default here is stdout.
        cmd.outputHelp({ error: true })
        process.exitCode = 1
        return
      }

      process.exitCode = print(name)
    })

  standards
    .command('list')
    .description('List the standards with their descriptions and jurisdiction')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit machine-readable JSON')
    .action((opts: StandardsListOptions) => {
      process.exitCode = runStandardsList(opts)
    })

  standards
    .command('audit')
    .description(
      'Report the corpus against the success-criterion gate standards/standard.md states',
    )
    .argument('[path]', 'Project root, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--arrivals-only',
      'Run the gating check for standards new on this branch alone',
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the audit completed with every arriving standard carrying the section',
        '  1  refused, with the reason on stderr',
        '  2  a standard new to this branch carries no success-criterion section',
        '',
        'A standard already in the corpus without the section is a known gap',
        'standards/standard.md names, not a violation, so only an arrival fails.',
        '',
        'Examples:',
        '  canon standards audit',
        '  canon standards audit --json',
        '  canon standards audit --arrivals-only',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: StandardsAuditOptions) => {
      process.exitCode = await runStandardsAudit(path, opts)
    })
}

/**
 * Reads the working root first, the way `canon standards <name>` does, so a
 * project's own standards list beside the package corpus. The `--json` record
 * is the one thing on stdout and the frame opens only on the text path.
 */
function runStandardsList(opts: StandardsListOptions): number {
  const standards = listStandardEntries(process.cwd())

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ standards })}\n`)
    return 0
  }

  intro('canon standards')
  logStep('Standards')
  for (const each of standards) logInfo(`${each.name} : ${each.description}`)
  outro()
  return 0
}

/**
 * Writes the standard to stdout and every frame line to stderr, so a caller
 * capturing the output with `$(...)` receives the document alone.
 *
 * The root is the caller's directory rather than the toolkit's, since a
 * repository that authors standards governs its own copy and the package copy
 * answers everywhere else.
 */
function print(name: string): number {
  intro('canon standards')

  const root = process.cwd()
  const resolved = resolveStandard(root, name)

  if (!resolved) {
    logWarn(`Unknown standard: ${name}`)
    logStep('Available standards')
    for (const each of listStandards(root)) logInfo(each)
    logError("Run 'canon standards list' for descriptions.")
    outro()
    return 1
  }

  logStep(resolved.source)
  process.stdout.write(readStandard(resolved))
  outro()
  return 0
}

/**
 * Measures the corpus at the cwd rather than the toolkit root the catalog
 * reads, so a linked worktree audits its own branch instead of `main`.
 */
async function runStandardsAudit(
  path: string | undefined,
  opts: StandardsAuditOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const gateOnly = opts.arrivalsOnly ?? false
  const audit = await auditStandards(root)

  if (audit.kind === 'refused') {
    const message =
      audit.reason === 'no-corpus'
        ? `No standards/ under ${root}.`
        : audit.reason === 'no-base'
          ? 'No merge base against main resolved.'
          : 'Could not read which standards arrived on this branch.'

    if (gateOnly) {
      frameError(message)
    } else {
      intro('canon standards audit')
      logStep('Refused')
      logWarn(message)
      outro()
    }

    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({ root, reason: audit.reason, message })}\n`,
      )
    }

    return auditExitCode(audit)
  }

  if (gateOnly) {
    reportArrivalGate(audit)
  } else {
    intro('canon standards audit')
    reportCorpus(audit)
    outro()
  }

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        base: audit.base,
        standards: audit.standards,
        withCriterion: audit.withCriterion,
        withoutCriterion: audit.withoutCriterion,
        arrivals: audit.arrivals,
        arrivalsWithoutCriterion: audit.arrivalsWithoutCriterion,
      })}\n`,
    )
  }

  return auditExitCode(audit)
}

/**
 * Prints nothing when every arriving standard carries the section.
 *
 * `--arrivals-only` is what `verify.sh` runs on every push, and that script
 * pipes a stage's whole output into its own frame. A passing gate that
 * printed its frame would nest one inside the other on every contributor's
 * push.
 */
function reportArrivalGate(
  audit: Extract<StandardsAudit, { kind: 'measured' }>,
): void {
  const missing = audit.arrivalsWithoutCriterion
  if (missing.length === 0) return

  intro('canon standards audit')
  logError(
    missing.length === 1
      ? '1 standard new to this branch carries no success-criterion section'
      : `${missing.length} standards new to this branch carry no success-criterion section`,
  )
  pipeOutput(missing.join('\n'))
  outro()
}

function reportCorpus(
  audit: Extract<StandardsAudit, { kind: 'measured' }>,
): void {
  logStep('Corpus')
  logInfo(`${plural(audit.standards.length, 'standard')} at standards/`)
  logInfo(
    `${plural(audit.withCriterion.length, 'standard')} carrying a success criterion`,
  )

  logStep('Known gaps')
  if (audit.withoutCriterion.length === 0) {
    logInfo('None. Every standard carries the section.')
  } else {
    pipeOutput(audit.withoutCriterion.join('\n'))
  }

  logStep('Arrivals since main')
  if (audit.arrivals.length === 0) {
    logInfo('No standard new to this branch.')
    return
  }

  if (audit.arrivalsWithoutCriterion.length === 0) {
    logInfo(
      `${plural(audit.arrivals.length, 'standard')} arrived, every one carrying the section.`,
    )
    return
  }

  logError(
    `${plural(audit.arrivalsWithoutCriterion.length, 'standard')} arrived carrying no success-criterion section`,
  )
  pipeOutput(audit.arrivalsWithoutCriterion.join('\n'))
}
