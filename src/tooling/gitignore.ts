import type { GitignoreSection } from '@/tooling/manifest'

export interface MergeResult {
  readonly content: string
  readonly added: readonly string[]
}

export interface PruneResult {
  readonly content: string
  readonly removed: readonly string[]
}

/**
 * Splits a gitignore body the way `while IFS= read -r line` did, so a file
 * with or without a trailing newline yields the same logical lines.
 */
function toLines(content: string): string[] {
  if (content === '') return []
  const lines = content.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

function fromLines(lines: readonly string[]): string {
  if (lines.length === 0) return ''
  return `${lines.join('\n')}\n`
}

function withoutTrailingSlash(entry: string): string {
  return entry.endsWith('/') ? entry.slice(0, -1) : entry
}

function hasEntry(lines: readonly string[], entry: string): boolean {
  return lines.includes(entry) || lines.includes(withoutTrailingSlash(entry))
}

/**
 * Appends every manifest entry the file does not already carry. The section header is written only when the
 * whole section is missing, and presence is re-checked against the growing file, so an entry is not added twice.
 */
export function mergeSections(
  content: string,
  sections: readonly GitignoreSection[],
): MergeResult {
  let next = content
  const added: string[] = []

  for (const section of sections) {
    const lines = toLines(next)
    const missing = section.entries.filter((entry) => !hasEntry(lines, entry))
    if (missing.length === 0) continue

    if (missing.length === section.entries.length) {
      next += `\n${section.header}\n`
    }

    for (const entry of missing) {
      next += `${entry}\n`
      added.push(entry)
    }
  }

  return { content: next, added }
}

/**
 * Drops entries that sit under a managed header but are no longer in the
 * manifest. A section runs from its header line until the first blank line or
 * the next comment, matching `prune_gitignore_section`.
 */
export function pruneSections(
  content: string,
  sections: readonly GitignoreSection[],
): PruneResult {
  let lines = toLines(content)
  const removed: string[] = []

  for (const section of sections) {
    const kept: string[] = []
    let inSection = false

    for (const line of lines) {
      if (line === section.header) {
        inSection = true
        kept.push(line)
        continue
      }

      if (!inSection) {
        kept.push(line)
        continue
      }

      if (line === '' || line.startsWith('#')) {
        inSection = false
        kept.push(line)
        continue
      }

      const isAllowed = section.entries.some(
        (entry) =>
          line === entry ||
          withoutTrailingSlash(line) === withoutTrailingSlash(entry),
      )

      if (isAllowed) {
        kept.push(line)
      } else {
        removed.push(line)
      }
    }

    lines = kept
  }

  return { content: removed.length > 0 ? fromLines(lines) : content, removed }
}
