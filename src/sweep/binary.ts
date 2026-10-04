/**
 * Whether the bytes are something a line scanner should not read.
 *
 * A NUL byte rather than an extension list, since a shipped tree carries fonts
 * and images under names no scanner has reason to enumerate, and a list would
 * go stale the first time a format was added. Decoded text holds no NUL, so the
 * test costs one scan and never rejects source.
 *
 * Neutral rather than owned by either sweep that calls it. The secret scan
 * shaped it and the superseded-value sweep reads the same corpus, so leaving it
 * in `src/secrets/` would put a `src/gov/` dependency on the secret scanner for
 * a predicate about bytes.
 */
export function isBinary(text: string): boolean {
  return text.includes('\0')
}
