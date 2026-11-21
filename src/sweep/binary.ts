/**
 * Whether the bytes are something a line scanner should not read. A NUL byte
 * stands in for an extension list that would go stale, and decoded text holds
 * none. It is neutral, so `src/gov/` takes no dependency on the secret scanner.
 */
export function isBinary(text: string): boolean {
  return text.includes('\0')
}
