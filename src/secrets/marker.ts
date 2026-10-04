import { isMarked } from '@/sweep/exempt-marker'

/**
 * The inline token exempting one line from the secret scan.
 *
 * Shaped on the `stub: true` precedent in `src/tooling/seed-marker.ts`, which answers
 * a check whose own comment records a false-positive class. The exemption
 * travels with the line it exempts rather than sitting in a path list away
 * from it, so a reader meeting a muted match finds the reason on the spot.
 *
 * The set of files carrying one is empty today. What empties it is the keying
 * rather than this mechanism: `patterns.ts` matches issued values and never
 * the words around them, so nothing in the shipped tree matches on purpose.
 * A path allow-list was declined for the same reason, since the noise it would
 * target is word-keyed and spread past the fixture trees, so it would hide
 * part of the noise and none of the risk.
 */
export const SECRET_MARKER = 'canon-allow-secret'

/**
 * Whether the line at `index` is exempt, reading itself and the line above it.
 *
 * Where a marker may sit and what makes one count are `isMarked`, which the
 * superseded-value sweep reads through the same call. Only the token differs
 * between the two, so the placement rule has one answer rather than two that
 * can drift.
 */
export function isExempt(lines: readonly string[], index: number): boolean {
  return isMarked(lines, index, SECRET_MARKER)
}
