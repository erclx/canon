const FRONTMATTER = /^---\n[\s\S]*?\n---\n?/

/**
 * Drops a leading `---` block. Only a block starting on the first line counts,
 * so a horizontal rule further down the document is left in place.
 *
 * The bash this replaced treated the first `---` on any line as an opening
 * fence, which silently swallowed everything between two horizontal rules in a
 * body. Anchoring to the first line is the correct reading.
 */
export function stripFrontmatter(source: string): string {
  return source.replace(FRONTMATTER, '')
}
