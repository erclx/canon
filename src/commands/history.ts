import { resolve } from 'node:path'
import type { Command } from 'commander'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  isLockOrRelease,
  readGenerated,
  readLog,
  readRepository,
} from '@/history/log'
import {
  addDays,
  COVERAGE_FLOOR,
  DEFAULT_WEEKS,
  HOTSPOT_LIMIT,
  rankHotspots,
  ROLLING_WEEKS,
  summarize,
  windowWeeks,
  type WeekFigures,
} from '@/history/report'
import {
  linesAt,
  SIZE_POINTS,
  type SizePoint,
  sizeSeries,
} from '@/history/size'

interface HistoryCommandOptions {
  readonly json?: boolean
  readonly weeks?: string
}

type HistoryRefusal = 'no-git' | 'invalid-weeks'

/** Ten years of weeks, past which the window walks dates nobody asked about. */
const MAX_WEEKS = 520

const REFUSALS: Record<HistoryRefusal, string> = {
  'no-git': 'git could not read a commit history here, so there is no trend.',
  'invalid-weeks': `--weeks takes a whole number of weeks, from 1 to ${MAX_WEEKS}.`,
}

/** Hotspots the person-facing report prints. The record carries every one. */
const PRINTED_HOTSPOTS = 10

export function register(program: Command): void {
  program
    .command('history')
    .description('Report a weekly delivery trend from the first-parent git log')
    .argument(
      '[path]',
      'Repository to read, defaulting to the current directory',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--weeks <n>',
      `Weeks the window spans, ${DEFAULT_WEEKS} by default and ${MAX_WEEKS} at most`,
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        '  Every first-parent commit since the window opened, each read as one',
        '  squash merge. Weeks are ISO weeks of the committer date, ending with',
        "  HEAD's week. Local git only, with no network and no score.",
        '',
        'Figures:',
        '  Per week: merges by conventional type, untyped merges, fix share',
        `  (fix over typed merges) and its ${ROLLING_WEEKS}-week rolling share, the median`,
        '  files a feat touched, and the census at the last commit of each week.',
        "  Files per feat is canon's own measure, not a DORA metric.",
        `  Hotspots: the ${HOTSPOT_LIMIT} paths heaviest by changes times current lines.`,
        '',
        'Exclusions:',
        '  A bot author or a release-please subject leaves every figure. A',
        '  lockfile, CHANGELOG.md, the release manifest, or a path marked',
        '  linguist-generated leaves the file counts and the hotspots. Under',
        `  ${COVERAGE_FLOOR * 100}% typed merges, the type figures read null.`,
        `  Size reads at most ${SIZE_POINTS} weeks, spread evenly with the newest kept.`,
        '',
        'Exit codes:',
        '  0  the report completed',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon history',
        '  canon history ../my-app --weeks 26 --json',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: HistoryCommandOptions) => {
      process.exitCode = await runHistory(path, opts)
    })
}

function parseWeeks(raw: string | undefined): number | undefined {
  if (raw === undefined) return DEFAULT_WEEKS
  if (!/^\d+$/.test(raw)) return undefined
  const weeks = Number(raw)
  return weeks >= 1 && weeks <= MAX_WEEKS ? weeks : undefined
}

function refuse(
  root: string,
  reason: HistoryRefusal,
  emitJson: boolean,
): number {
  logStep('Refused')
  logWarn(REFUSALS[reason])
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, reason, message: REFUSALS[reason] })}\n`,
    )
  }
  return 1
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${Math.round(value * 100)}%`
}

function describeWeek(week: WeekFigures, size: SizePoint | undefined): string {
  const types =
    week.types === null
      ? 'types unread'
      : Object.entries(week.types)
          .map(([type, count]) => `${type} ${count}`)
          .join(', ') || 'no typed merges'
  const parts = [
    `${plural(week.merges, 'merge')} (${types}${week.untyped > 0 ? `, untyped ${week.untyped}` : ''})`,
    `fix share ${percent(week.fixShare)}, rolling ${percent(week.fixShareRolling)} over ${plural(week.rollingWeeks, 'week')}`,
    `feat files median ${week.featFilesMedian ?? 'n/a'}`,
  ]
  if (size) parts.push(`${plural(size.files, 'file')}, ${size.lines} lines`)
  return `${week.week} from ${week.from}: ${parts.join('; ')}`
}

async function runHistory(
  path: string | undefined,
  opts: HistoryCommandOptions,
): Promise<number> {
  const requested = resolve(path ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon history')

  const weeks = parseWeeks(opts.weeks)
  if (weeks === undefined) return refuse(requested, 'invalid-weeks', emitJson)

  const repository = await readRepository(requested)
  if (repository === undefined) return refuse(requested, 'no-git', emitJson)

  const { root, head } = repository
  const slots = windowWeeks(repository.headDate, weeks)
  // Read the rolling weeks ahead of the window, plus a day either side of a
  // committer's zone, since git filters on the timestamp and the report
  // buckets on the committer's own calendar date.
  const since = addDays(slots[0].from, -(ROLLING_WEEKS - 1) * 7 - 1)
  const merges = await readLog(root, since)
  if (merges === undefined) return refuse(requested, 'no-git', emitJson)

  const touched = [...new Set(merges.flatMap((merge) => merge.files))]
  const generated = await readGenerated(root, touched)
  const summary = summarize({
    merges,
    slots,
    firstDate: repository.firstDate,
    excluded: (file) => isLockOrRelease(file) || generated.has(file),
  })

  // In turn rather than together, since each read buffers a tree's blobs.
  const lines = await linesAt(root, head, new Set(summary.changes.keys()))
  const sizes = await sizeSeries(root, merges, slots)
  const hotspots = rankHotspots(summary.changes, lines)
  const weekRecords = summary.weeks.map((week) => ({
    ...week,
    size: sizes.get(week.from) ?? null,
  }))

  logStep('Window')
  logInfo(
    `${plural(weeks, 'week')}, ${slots[0].from} to ${repository.headDate}, HEAD ${head.slice(0, 9)}`,
  )

  logStep('Coverage')
  logInfo(
    `${summary.coverage.typed} of ${plural(summary.coverage.merges, 'merge')} typed (${percent(summary.coverage.share)}), ${plural(summary.excluded.bots, 'bot commit')} and ${plural(summary.excluded.releases, 'release')} left out`,
  )
  if (summary.coverage.share === null) {
    logWarn('No delivery merge landed in the window, so no type figure reads.')
  } else if (summary.coverage.share < COVERAGE_FLOOR) {
    logWarn(
      `Under ${percent(COVERAGE_FLOOR)} typed, so type counts, fix share, and feat files read as unread.`,
    )
  }

  logStep('Weeks')
  for (const week of weekRecords) {
    logInfo(describeWeek(week, week.size ?? undefined))
  }

  logStep('Hotspots')
  if (hotspots.length === 0) logInfo('no text file changed in the window')
  for (const hot of hotspots.slice(0, PRINTED_HOTSPOTS)) {
    logInfo(
      `${hot.path}: ${plural(hot.changes, 'change')} x ${hot.lines} lines, touched by ${plural(hot.fixTouches, 'fix commit')}`,
    )
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        head,
        window: { weeks, from: slots[0].from, to: repository.headDate },
        coverage: summary.coverage,
        excluded: summary.excluded,
        weeks: weekRecords,
        hotspots,
      })}\n`,
    )
  }

  return 0
}
