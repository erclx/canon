import { isMarked } from '@/sweep/exempt-marker'

/**
 * The inline token exempting one line from the secret scan.
 *
 * Shaped on the `stub: true` precedent in `src/tooling/seed-marker.ts`. The
 * exemption travels with the line it exempts, so a reader meeting a muted
 * match finds the reason on the spot. No file carries one today, since
 * `patterns.ts` matches issued values rather than words. A path allow-list
 * was declined, since it would hide part of the noise and none of the risk.
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
