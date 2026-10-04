/**
 * Escapes every character a regular expression would read as syntax.
 *
 * The token became a parameter when this was extracted, and the two callers
 * pass letters and hyphens alone. That is what makes escaping cheap here rather
 * than a fix for a live defect: an unescaped token holding a dot matches the
 * wrong lines and one holding a parenthesis throws, and neither failure is the
 * caller's to anticipate.
 */
export function escapeForPattern(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Whether the line at `index` carries `token` with a reason after it, reading
 * itself and the line above.
 *
 * Extracted from `src/secrets/marker.ts`, which shaped it, so the two sweeps
 * that mute a line share one answer to where a marker may sit. Two lines rather
 * than one, because a value is as often introduced by a preceding comment as
 * annotated inline, and a format taking no trailing comment has nowhere else to
 * put the marker. Nothing further up counts, so a marker cannot silence a block
 * it does not sit on.
 *
 * Only a marker naming a reason counts. A bare token is read as a line that
 * meant to say something and did not, and honoring it would let a typo mute a
 * finding, where the reason is the whole value of an exemption a later reader
 * has to weigh.
 */
export function isMarked(
  lines: readonly string[],
  index: number,
  token: string,
): boolean {
  const pattern = new RegExp(`${escapeForPattern(token)}:[ \\t]*\\S`)
  const own = lines[index]
  const above = index > 0 ? lines[index - 1] : undefined

  return (
    (own !== undefined && pattern.test(own)) ||
    (above !== undefined && pattern.test(above))
  )
}
