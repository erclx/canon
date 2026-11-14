import type { LabelMap } from '@/labels/map'

/** A path a row leaves unlabelled on purpose, carrying the reason it gives. */
export interface DeclinedPath {
  readonly path: string
  readonly reason: string
}

export interface Coverage {
  /** Distinct labels the whole set earns, ordered as the map declares them. */
  readonly labels: readonly string[]
  /**
   * Paths a `[declined]` row covers, which are a decision rather than a gap.
   *
   * Kept apart from `uncovered` because the response to the two differs. A
   * surface nobody has gotten to wants a row, and one somebody decided against
   * wants nothing, so a report folding them together is useful about neither.
   */
  readonly declined: readonly DeclinedPath[]
  /** Paths no row of either table reaches, which is the finding. */
  readonly uncovered: readonly string[]
}

/**
 * Prefix-anchored, matching what the map's own comment describes and what the
 * census behind its 41 prefixes was measured against.
 *
 * A glob would reach every existing prefix and invalidate that measurement, so
 * the rule stays a `startsWith` even where a glob would read more naturally.
 */
function matches(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path.startsWith(prefix))
}

/**
 * Resolves what a changed set earns from a map, and what it leaves behind.
 *
 * One pass answers both readers. `git-pr` wants the labels to apply, and the
 * audit wants the paths that earned none, and a function shaped for the first
 * alone returns nothing the second can count.
 */
export function resolveCoverage(
  map: Extract<LabelMap, { kind: 'map' }>,
  paths: readonly string[],
): Coverage {
  const earned = new Set<string>()
  const declined: DeclinedPath[] = []
  const uncovered: string[] = []

  for (const path of paths) {
    const labels = map.domains.filter((row) => matches(path, row.prefixes))

    // A label wins over a decline, since a path both tables claim already carries
    // a subject, and calling it unlabelled would contradict the label applied.
    if (labels.length > 0) {
      for (const row of labels) earned.add(row.label)
      continue
    }

    const row = map.declined.find((entry) => matches(path, entry.prefixes))
    if (row !== undefined) {
      declined.push({ path, reason: row.reason })
      continue
    }

    uncovered.push(path)
  }

  return {
    // Read back off the map rather than out of the set, so two runs over one
    // branch produce one order and one string.
    labels: map.domains
      .map((row) => row.label)
      .filter((label) => earned.has(label)),
    declined,
    uncovered,
  }
}
