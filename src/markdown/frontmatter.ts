const FRONTMATTER = /^---\n[\s\S]*?\n---\n?/

/**
 * Drops a leading `---` block. Only a block starting on the first line counts,
 * since the earlier bash treated any `---` as an opening fence and swallowed
 * the text between two horizontal rules.
 */
export function stripFrontmatter(source: string): string {
  return source.replace(FRONTMATTER, '')
}
