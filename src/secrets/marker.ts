import { isMarked } from '@/sweep/exempt-marker'

/**
 * The inline token exempting one line from the secret scan, shaped on the
 * `stub: true` precedent in `src/tooling/seed-marker.ts`. It travels with the
 * line so a reader finds the reason on the spot, and a path allow-list was declined.
 */
export const SECRET_MARKER = 'canon-allow-secret'

/**
 * Whether the line at `index` is exempt, reading itself and the line above it.
 * Placement is `isMarked`, which the superseded-value sweep reads through the
 * same call, so the rule has one answer rather than two that can drift.
 */
export function isExempt(lines: readonly string[], index: number): boolean {
  return isMarked(lines, index, SECRET_MARKER)
}
