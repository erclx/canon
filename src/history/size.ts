import { censusAt, textLines, type ExtensionCount } from '@/census/count'
import { readBlobsAt, spaceEvenly, SYMLINK_MODE } from '@/git/revision'
import type { Merge } from '@/history/log'
import { isoWeek, type WeekSlot } from '@/history/report'

/** Size points one run reads at most, matching the default window. */
export const SIZE_POINTS = 12

/** Census's own figures at one revision, minus its folder list. */
export interface SizePoint {
  readonly rev: string
  readonly files: number
  readonly skipped: number
  readonly lines: number
  readonly byExtension: readonly ExtensionCount[]
}

/**
 * Each window week's last first-parent commit, keyed by the week's Monday.
 * Every class counts here, a release included, since size reads the tree
 * rather than the delivery figures. A week with no commit has no key.
 */
export function weekEnds(
  merges: readonly Merge[],
  slots: readonly WeekSlot[],
): Map<string, string> {
  const wanted = new Set(slots.map((slot) => slot.from))
  const ends = new Map<string, string>()

  // Newest first, so the first commit met in a week is its last.
  for (const merge of merges) {
    const { from } = isoWeek(merge.date)
    if (wanted.has(from) && !ends.has(from)) ends.set(from, merge.sha)
  }

  return ends
}

/**
 * Picks the weeks that get a size point: every week holding a commit, spread
 * evenly past `points` with the newest kept.
 */
export function sampleWeeks(
  ends: ReadonlyMap<string, string>,
  slots: readonly WeekSlot[],
  points: number = SIZE_POINTS,
): Map<string, string> {
  const held = slots
    .filter((slot) => ends.has(slot.from))
    .map((slot) => slot.from)
  const picked = spaceEvenly(held, points)
  return new Map(picked.map((from) => [from, ends.get(from) ?? '']))
}

/**
 * The size at each sampled week's last commit, keyed by the week's Monday. A
 * week with no commit, one the sample skipped, or one git could not read has
 * no key, so it reads `null` rather than repeating the prior week.
 */
export async function sizeSeries(
  root: string,
  merges: readonly Merge[],
  slots: readonly WeekSlot[],
  points: number = SIZE_POINTS,
): Promise<Map<string, SizePoint>> {
  const sampled = sampleWeeks(weekEnds(merges, slots), slots, points)

  const series = new Map<string, SizePoint>()

  // One point at a time, since each read buffers a whole tree's blobs and a
  // concurrent sample would hold every one of those trees together.
  for (const [from, rev] of sampled) {
    const result = await censusAt(root, rev)
    if (result.kind !== 'measured') continue
    series.set(from, {
      rev,
      files: result.files,
      skipped: result.skipped,
      lines: result.lines,
      byExtension: result.byExtension,
    })
  }

  return series
}

/**
 * Text lines at `rev` for each of `paths` that it holds as a regular file.
 * A binary, a symlink, a submodule, or a path gone by `rev` has no key.
 */
export async function linesAt(
  root: string,
  rev: string,
  paths: ReadonlySet<string>,
): Promise<Map<string, number>> {
  const entries = await readBlobsAt(root, rev, (path) => paths.has(path))
  const lines = new Map<string, number>()

  for (const { path, mode, text } of entries) {
    if (mode === SYMLINK_MODE || text === undefined) continue
    const counted = textLines(text)
    if (counted !== undefined) lines.set(path, counted)
  }

  return lines
}
