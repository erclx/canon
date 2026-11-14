/**
 * Whether the bytes are something a line scanner should not read.
 *
 * A NUL byte rather than an extension list, which would go stale the first
 * time a format was added. Decoded text holds no NUL, so the test costs one
 * scan and never rejects source. Neutral rather than owned by either sweep
 * that calls it, so `src/gov/` takes no dependency on the secret scanner.
 */
export function isBinary(text: string): boolean {
  return text.includes('\0')
}
