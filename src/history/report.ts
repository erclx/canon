import type { Merge } from '@/history/log'

export const DEFAULT_WEEKS = 12

/** Weeks the rolling fix share spans, three periods across the default window. */
export const ROLLING_WEEKS = 4

/**
 * Under this share of typed merges the type figures read `null`. A literal
 * zero floor would let a few typed commits stand for a mostly untyped log.
 */
export const COVERAGE_FLOOR = 0.5

/** Hotspots the report lists, highest weight first. */
export const HOTSPOT_LIMIT = 20

/** An ISO week: its `YYYY-Www` label and the Monday it opens on. */
export interface WeekSlot {
  readonly week: string
  readonly from: string
}

const DAY_MS = 86_400_000

function parseDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return formatDay(parseDay(date) + days * DAY_MS)
}

/**
 * The ISO week a calendar date falls in. The week belongs to the year holding
 * its Thursday, which is what puts 2026-12-31 in 2026-W53 and 2027-01-01 there
 * too.
 */
export function isoWeek(date: string): WeekSlot {
  const ms = parseDay(date)
  const weekday = (new Date(ms).getUTCDay() + 6) % 7
  const monday = ms - weekday * DAY_MS
  const thursday = new Date(monday + 3 * DAY_MS)
  const year = thursday.getUTCFullYear()
  const firstThursday = Date.UTC(year, 0, 4)
  const firstMonday =
    firstThursday - ((new Date(firstThursday).getUTCDay() + 6) % 7) * DAY_MS
  const number = Math.round((monday - firstMonday) / (7 * DAY_MS)) + 1

  return {
    week: `${year}-W${String(number).padStart(2, '0')}`,
    from: formatDay(monday),
  }
}

/** The `weeks` ISO weeks ending with the one `endDate` falls in, oldest first. */
export function windowWeeks(endDate: string, weeks: number): WeekSlot[] {
  const last = isoWeek(endDate).from
  return Array.from({ length: weeks }, (_, index) =>
    isoWeek(addDays(last, (index - weeks + 1) * 7)),
  )
}

export interface WeekFigures extends WeekSlot {
  /** Delivery merges: every merge but a bot's or a release. */
  readonly merges: number
  /** Typed merges by type, most first. `null` under the coverage floor. */
  readonly types: Readonly<Record<string, number>> | null
  readonly untyped: number
  /** Fix merges over typed merges, `null` with no typed merge or under the floor. */
  readonly fixShare: number | null
  readonly fixShareRolling: number | null
  /** Weeks the rolling share covers, fewer than `ROLLING_WEEKS` near the first commit. */
  readonly rollingWeeks: number
  /** Median files a feat touched, lock and generated files left out. */
  readonly featFilesMedian: number | null
}

export interface Coverage {
  readonly merges: number
  readonly typed: number
  /** `null` when the window holds no delivery merge. */
  readonly share: number | null
}

export interface PathChanges {
  readonly changes: number
  readonly fixTouches: number
}

export interface Summary {
  readonly coverage: Coverage
  readonly excluded: { readonly bots: number; readonly releases: number }
  readonly weeks: readonly WeekFigures[]
  /** Every non-excluded path a delivery merge in the window touched. */
  readonly changes: ReadonlyMap<string, PathChanges>
}

export interface SummaryInput {
  readonly merges: readonly Merge[]
  /** The window's weeks, oldest first. */
  readonly slots: readonly WeekSlot[]
  /** The repository's first commit date, which bounds the rolling share. */
  readonly firstDate: string
  /** A lock, release, or generated file, which leaves every file count. */
  readonly excluded: (path: string) => boolean
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function share(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole
}

function typeCounts(merges: readonly Merge[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const merge of merges) {
    if (merge.type === undefined) continue
    counts.set(merge.type, (counts.get(merge.type) ?? 0) + 1)
  }
  return Object.fromEntries(
    [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    ),
  )
}

function fixRatio(merges: readonly Merge[]): number | null {
  const typed = merges.filter((merge) => merge.class === 'typed')
  const fixes = typed.filter((merge) => merge.type === 'fix')
  return share(fixes.length, typed.length)
}

/**
 * Buckets delivery merges by the ISO week of their committer date and computes
 * each week's figures, the window's coverage, and the per-path change counts
 * the hotspots rank.
 *
 * Merges dated before the window feed only the rolling share of its first
 * weeks, so a caller reads `ROLLING_WEEKS - 1` weeks ahead of the window.
 */
export function summarize(input: SummaryInput): Summary {
  const { slots, excluded } = input
  const windowFrom = slots[0]?.from ?? ''
  const firstWeek = isoWeek(input.firstDate).from

  const byWeek = new Map<string, Merge[]>()
  let bots = 0
  let releases = 0

  for (const merge of input.merges) {
    const inWindow = merge.date >= windowFrom
    if (merge.class === 'bot') {
      if (inWindow) bots += 1
      continue
    }
    if (merge.class === 'release') {
      if (inWindow) releases += 1
      continue
    }
    const { from } = isoWeek(merge.date)
    byWeek.set(from, [...(byWeek.get(from) ?? []), merge])
  }

  const windowMerges = slots.flatMap((slot) => byWeek.get(slot.from) ?? [])
  const typedInWindow = windowMerges.filter((merge) => merge.class === 'typed')
  const coverage: Coverage = {
    merges: windowMerges.length,
    typed: typedInWindow.length,
    share: share(typedInWindow.length, windowMerges.length),
  }
  const readable = coverage.share !== null && coverage.share >= COVERAGE_FLOOR

  const weeks = slots.map((slot): WeekFigures => {
    const merges = byWeek.get(slot.from) ?? []
    const rolling = Array.from({ length: ROLLING_WEEKS }, (_, index) =>
      addDays(slot.from, (index - ROLLING_WEEKS + 1) * 7),
    ).filter((from) => from >= firstWeek)
    const rollingMerges = rolling.flatMap((from) => byWeek.get(from) ?? [])
    const featFiles = merges
      .filter((merge) => merge.type === 'feat')
      .map((merge) => merge.files.filter((path) => !excluded(path)).length)

    return {
      ...slot,
      merges: merges.length,
      types: readable ? typeCounts(merges) : null,
      untyped: merges.filter((merge) => merge.class === 'untyped').length,
      fixShare: readable ? fixRatio(merges) : null,
      fixShareRolling: readable ? fixRatio(rollingMerges) : null,
      rollingWeeks: rolling.length,
      featFilesMedian: readable ? median(featFiles) : null,
    }
  })

  const changes = new Map<string, PathChanges>()
  for (const merge of windowMerges) {
    for (const path of new Set(merge.files)) {
      if (excluded(path)) continue
      const entry = changes.get(path) ?? { changes: 0, fixTouches: 0 }
      changes.set(path, {
        changes: entry.changes + 1,
        fixTouches: entry.fixTouches + (merge.type === 'fix' ? 1 : 0),
      })
    }
  }

  return { coverage, excluded: { bots, releases }, weeks, changes }
}

export interface Hotspot {
  readonly path: string
  readonly changes: number
  /** Text lines at HEAD. */
  readonly lines: number
  /** `changes` times `lines`, since absolute churn alone predicts defects poorly. */
  readonly weight: number
  readonly fixTouches: number
}

/**
 * Ranks changed paths by change count times current size, heaviest first then
 * by path. A path missing from `lines`, being binary or deleted since, or one
 * holding no lines, leaves the ranking.
 */
export function rankHotspots(
  changes: ReadonlyMap<string, PathChanges>,
  lines: ReadonlyMap<string, number>,
  limit: number = HOTSPOT_LIMIT,
): Hotspot[] {
  const ranked: Hotspot[] = []
  for (const [path, entry] of changes) {
    const size = lines.get(path)
    if (size === undefined || size === 0) continue
    ranked.push({
      path,
      changes: entry.changes,
      lines: size,
      weight: entry.changes * size,
      fixTouches: entry.fixTouches,
    })
  }

  return ranked
    .sort((a, b) => b.weight - a.weight || (a.path < b.path ? -1 : 1))
    .slice(0, limit)
}
