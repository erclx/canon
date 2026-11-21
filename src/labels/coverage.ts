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
   * Kept apart from `uncovered`, since a surface nobody reached wants a row and
   * one decided against wants nothing.
   */
  readonly declined: readonly DeclinedPath[]
  /** Paths no row of either table reaches, which is the finding. */
  readonly uncovered: readonly string[]
}

/**
 * Prefix-anchored, matching what the map's own comment describes and what its
 * prefix census was measured against. A glob would invalidate that measurement,
 * so the rule stays a `startsWith`.
 */
function matches(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path.startsWith(prefix))
}

/**
 * Resolves what a changed set earns from a map, and what it leaves behind. One
 * pass serves `git-pr`, which wants the labels, and the audit, which counts the
 * paths that earned none.
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

    // A label wins over a decline, since calling a path both tables claim unlabelled would contradict it.
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
    // Read back off the map rather than the set, so two runs over one branch produce one order.
    labels: map.domains
      .map((row) => row.label)
      .filter((label) => earned.has(label)),
    declined,
    uncovered,
  }
}
