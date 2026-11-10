/**
 * How many elements a row names before it stops naming them. A row exists to
 * say how many answers a site gives, and the elements under it are there to
 * make one findable rather than to enumerate the set.
 */
export const SAMPLE_LIMIT = 3

/**
 * Names a bounded head of a list and says how many it left out, so a treatment
 * carried by fifty locations reads as fifty rather than as the three named.
 *
 * `total` arrives separately because the two lists reach here differently. A
 * row's samples are already capped when they are collected, so their own length
 * cannot say how many elements the row covers, while its locations arrive whole.
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
 * Turns a per-element walk into a per-answer listing, which is the whole point
 * of the command.
 *
 * Grouping by the component instead was the obvious shape and it reports what a
 * reader already knows, that a site has buttons and links. Grouping by the
 * computed answer reports the thing nobody can see while building, which is
 * that five components resolved to five different rings.
 *
 * Order is heaviest first, then by treatment, so the dominant answer leads and
 * two runs over one site report one order rather than whatever the walk hit.
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
