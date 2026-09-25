import { execa } from 'execa'
import type { Command } from 'commander'
import {
  BASELINE_REL,
  type Baseline,
  baselineFrom,
  compareBaseline,
  type Delta,
  readBaseline,
  writeBaseline,
} from '@/audits/baseline'
import { AUDITS, type AuditResult, type Corpus } from '@/audits/catalog'
import {
  auditsFor,
  CORPORA,
  exitCodeFor,
  runAudits,
  spawnAudit,
  type Summary,
  summarize,
} from '@/audits/run'
import { gitEnv } from '@/git-env'
import { intro, logError, logInfo, logStep, logWarn, outro, plural } from '@/ui'
import { currentWorktreeRoot } from '@/worktree'

interface RunCommandOptions {
  readonly json?: boolean
  readonly record?: boolean
  readonly root?: string
  readonly corpus?: readonly string[]
}

function collectCorpus(value: string, previous: string[]): string[] {
  return [...previous, value]
}

interface ListCommandOptions {
  readonly json?: boolean
}

export function register(program: Command): void {
  const audits = program
    .command('audits')
    .description('Run every health check this repository owns as one set')
    .helpOption('-h, --help', 'Show this help message')

  audits
    .command('run')
    .description(
      'Run every audit, report per check under one verdict, and compare each count to the recorded baseline',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--root <path>',
      'Tree to measure, defaulting to the current worktree',
    )
    .option(
      '--record',
      `Write this run's tracked counts to ${BASELINE_REL} as the new baseline`,
    )
    .option(
      '--corpus <corpus>',
      `Limit the run to one corpus (${CORPORA.join(', ')}), repeatable. Defaults to every corpus`,
      collectCorpus,
      [] as string[],
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every audit reported and none carried a finding that is a fact',
        '  1  refused, with the reason on stderr',
        '  2  an audit carries a finding that is a fact',
        '  3  an audit did not report, so the run measured less than the set',
        '',
        'It gates on exactly what already gates a push and on nothing new:',
        'an unresolved context citation, a banned character, and a skill folder',
        'carrying no REQUIREMENT.md. Every other measure is a',
        'judgment a reader settles, and failing a push on one teaches',
        'contributors to route around the stage.',
        '',
        'Exit 3 is a defect in the run rather than in the tree. An aggregate that',
        'reports a pass over a set it did not finish measuring is the failure this',
        'command exists against, so a verb that did not report takes its own code.',
        '',
        `The baseline at ${BASELINE_REL} holds the counts from the last recorded`,
        'run, so a measure that reports rather than gates still costs something',
        'when it grows. Only a tracked corpus is retained: a gitignored record',
        "folder holds one machine's scratch, and its counts answer nobody else.",
        '',
        'Examples:',
        '  canon audits run',
        '  canon audits run --json',
        '  canon audits run --record',
        '  canon audits run --corpus tracked --corpus per-machine',
        '',
      ].join('\n'),
    )
    .action(async (opts: RunCommandOptions) => {
      process.exitCode = await runAll(opts)
    })

  audits
    .command('list')
    .description(
      'List every audit this command runs and what each one gates on',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit JSON with the id, invocation, corpus, and gate')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the catalog was listed',
        '',
        'Examples:',
        '  canon audits list',
        '  canon audits list --json',
        '',
      ].join('\n'),
    )
    .action((opts: ListCommandOptions) => {
      process.exitCode = runList(opts)
    })
}

function runList(opts: ListCommandOptions): number {
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        audits: AUDITS.map((audit) => ({
          id: audit.id,
          label: audit.label,
          command: `canon ${audit.argv.join(' ')}`,
          corpus: audit.corpus,
          gates: audit.gatingExits.length > 0,
        })),
      })}\n`,
    )
    return 0
  }

  intro('canon audits list')
  for (const audit of AUDITS) {
    logStep(audit.label)
    logInfo(`canon ${audit.argv.join(' ')}`)
    logInfo(
      `${audit.corpus} corpus, ${audit.gatingExits.length > 0 ? 'gates on a fact' : 'reports only'}`,
    )
  }
  outro()
  return 0
}

/**
 * The day a record is stamped with, as `YYYY-MM-DD`.
 *
 * Local rather than UTC, because the stamp is read beside a commit date in a
 * context entry and a run taken in the evening should not record tomorrow.
 */
function today(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * The commit the counts were read at, or `unknown` outside a repository.
 *
 * A target project can install this CLI without a git history behind it, and
 * refusing there would withhold the whole report over a field that only makes
 * the record reproducible.
 */
async function headCommit(root: string): Promise<string> {
  const result = await execa('git', ['-C', root, 'rev-parse', 'HEAD'], {
    reject: false,
    env: gitEnv(),
    extendEnv: false,
  })
  return result.exitCode === 0 ? result.stdout.trim() : 'unknown'
}

async function runAll(opts: RunCommandOptions): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ?? (await currentWorktreeRoot())
  const requested = opts.corpus ?? []

  const invalid = requested.filter(
    (corpus) => !CORPORA.includes(corpus as Corpus),
  )
  if (invalid.length > 0) {
    const message = `Unknown corpus ${invalid.join(', ')}. Valid corpora: ${CORPORA.join(', ')}.`
    if (emitJson) {
      process.stderr.write(`${message}\n`)
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: 'bad-corpus', message })}\n`,
      )
      return 1
    }
    intro('canon audits run')
    logStep('Refused')
    logError(message)
    outro()
    return 1
  }

  const audits = auditsFor(AUDITS, requested)

  let baseline: Baseline | undefined
  try {
    baseline = await readBaseline(root)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (emitJson) {
      process.stderr.write(`${message}\n`)
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: 'bad-baseline', message })}\n`,
      )
      return 1
    }
    intro('canon audits run')
    logStep('Refused')
    logError(message)
    outro()
    return 1
  }

  const results = await runAudits(audits, spawnAudit(root))
  const deltas = compareBaseline(baseline, results)
  const summary = summarize(results, deltas)

  let recorded: string | undefined
  if (opts.record) {
    const next = baselineFrom(results, {
      recordedAt: today(),
      commit: await headCommit(root),
    })
    recorded = await writeBaseline(root, next)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        // Flat scalars, so a shell stage greps one out without a JSON parser.
        // The nested arrays below carry the detail behind each number.
        summary,
        baseline: baseline
          ? { recordedAt: baseline.recordedAt, commit: baseline.commit }
          : undefined,
        recorded,
        audits: results,
        deltas,
      })}\n`,
    )
  } else {
    report(results, deltas, baseline, recorded, summary)
  }

  return exitCodeFor(results)
}

/** The counts of one result, rendered as `key n` pairs a reader can scan. */
function countLine(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ')
}

/**
 * The delta line for one audit, or nothing when there is no comparison to
 * report. A first run says so rather than showing a delta of zero, since zero
 * against an absent baseline says the same as a corpus that did not move.
 */
function deltaLine(delta: Delta): string | undefined {
  if (
    delta.kind === 'per-machine' ||
    delta.kind === 'upstream' ||
    delta.kind === 'unmeasured'
  ) {
    return undefined
  }
  if (delta.kind === 'unrecorded') return 'No recorded baseline to compare'

  const parts = [
    ...delta.moved.map(
      ({ key, from, to, delta: moved }) =>
        `${key} ${from} to ${to} (${moved > 0 ? '+' : ''}${moved})`,
    ),
    ...delta.added.map(({ key, to }) => `${key} ${to}, newly measured`),
    ...delta.dropped.map(({ key, from }) => `${key} was ${from}, not measured`),
  ]

  return parts.length === 0 ? undefined : parts.join(', ')
}

function report(
  results: readonly AuditResult[],
  deltas: readonly Delta[],
  baseline: Baseline | undefined,
  recorded: string | undefined,
  summary: Summary,
): void {
  const byId = new Map(deltas.map((delta) => [delta.id, delta]))

  intro('canon audits run')

  logStep('Baseline')
  if (baseline === undefined) {
    logWarn(`None recorded. Take one with canon audits run --record.`)
  } else {
    logInfo(`${baseline.recordedAt} at ${baseline.commit.slice(0, 8)}`)
  }

  for (const result of results) {
    logStep(result.label)

    if (result.status === 'absent') {
      logInfo(`No corpus on this machine: ${result.reason ?? 'not found'}`)
      continue
    }

    if (result.status === 'unmeasured') {
      logWarn(`Did not report: ${result.reason ?? 'no reason given'}`)
      continue
    }

    const counts = result.counts ?? {}
    const line = countLine(counts)
    if (result.status === 'finding') {
      logError(line === '' ? 'A finding that is a fact' : line)
    } else {
      logInfo(line === '' ? 'Reported' : line)
    }

    if (!result.tracked) {
      logInfo(
        result.corpus === 'upstream'
          ? 'Upstream index, so no baseline is kept and growth is not this tree'
          : 'Per-machine corpus, so no baseline is kept',
      )
      continue
    }

    const moved = deltaLine(
      byId.get(result.id) ?? { id: result.id, kind: 'unrecorded' },
    )
    if (moved !== undefined) logInfo(moved)
  }

  if (recorded !== undefined) {
    logStep('Recorded')
    logInfo(recorded)
  }

  logStep('Verdict')

  if (summary.verdict === 'findings') {
    logError(
      `${plural(summary.facts, 'audit')} carrying a finding that is a fact. Fix what each names.`,
    )
  } else if (summary.verdict === 'incomplete') {
    logError(
      `${plural(summary.unmeasured, 'audit')} did not report, so this run measured less than the set.`,
    )
  } else if (summary.verdict === 'reported') {
    logInfo('No fact. Every other finding is a judgment a reader settles.')
  } else {
    logInfo('Every audit reported and every count is zero.')
  }

  // Stated on every run, including a clean one. A count of what passed reads as
  // a verdict on the whole set unless the run also says what it never reached.
  logInfo(
    `${summary.audited} of ${results.length} corpora measured, ${summary.absent} absent or unreachable from this machine`,
  )

  outro()
}
