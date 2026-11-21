/**
 * Escapes every character a regular expression would read as syntax. Callers pass
 * letters and hyphens alone, so this is cheap protection rather than a fix, since
 * a token holding a dot matches the wrong lines and a parenthesis throws.
 */
export function escapeForPattern(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Whether the line at `index` carries `token` with a reason after it, reading
 * itself and the line above. Shared by the two sweeps that mute a line, nothing
 * further up counts, and a marker naming no reason does not, so a typo mutes nothing.
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
