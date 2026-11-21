/**
 * How many elements a row names before it stops naming them. A row exists to
 * say how many answers a site gives, and the elements under it are there to
 * make one findable rather than to enumerate the set.
 */
export const SAMPLE_LIMIT = 3

/**
 * Names a bounded head of a list and says how many it left out. `total` arrives
 * separately, since a row's samples are capped on collection and their length
 * cannot say how many elements the row covers.
 */
export function abbreviate(entries: readonly string[], total: number): string {
  const head = entries.slice(0, SAMPLE_LIMIT)
  const elided = total - head.length
  return elided > 0 ? `${head.join(', ')} and ${elided} more` : head.join(', ')
}

/**
 * One element as the walk read it, at the location it was read from. A
 * location is a route on a served project and a frame's label on board files,
 * so the grouping names whichever the walk took without calling a frame a route.
 */
export interface Reading {
  readonly location: string
  readonly selector: string
  readonly treatment: string
}

/** One answer the site gives, and what carries it. */
export interface TreatmentGroup {
  readonly treatment: string
  readonly count: number
  readonly locations: readonly string[]
  readonly samples: readonly string[]
}

/**
 * Turns a per-element walk into a per-answer listing, grouped by the computed
 * answer rather than the component, since that reports what nobody sees while
 * building. Order is heaviest first, then by treatment, so two runs report one order.
 */
export function groupByTreatment(
  readings: readonly Reading[],
): readonly TreatmentGroup[] {
  const byTreatment = new Map<
    string,
    { count: number; locations: string[]; samples: string[] }
  >()

  for (const { location, selector, treatment } of readings) {
    const row = byTreatment.get(treatment) ?? {
      count: 0,
      locations: [],
      samples: [],
    }
    row.count += 1
    if (!row.locations.includes(location)) row.locations.push(location)
    if (row.samples.length < SAMPLE_LIMIT) row.samples.push(selector)
    byTreatment.set(treatment, row)
  }

  return [...byTreatment.entries()]
    .map(([treatment, row]) => ({ treatment, ...row }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.treatment.localeCompare(right.treatment),
    )
}
