/**
 * The outline rail's focus-line ramp. It runs from near the top at scroll 0 to
 * the viewport's bottom edge at max scroll, so the last heading is reachable
 * however little content trails it. A ramp ending 120px short of the edge left
 * a heading with under 120px after it permanently unmarked, since its top never
 * fell below the line even at max scroll.
 *
 * The sidebar script embeds this function's own source, so a test exercises
 * what the browser runs.
 */
export function focusLine(
  scrollY: number,
  max: number,
  innerHeight: number,
): number {
  if (max <= 0) return innerHeight
  var progress = Math.min(1, Math.max(0, scrollY / max))
  return 120 + progress * Math.max(0, innerHeight - 120)
}
