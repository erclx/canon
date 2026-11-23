import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lengthExemption } from '@/markdown/ceiling'
import { documentHeight } from '@/markdown/structure'

/**
 * Rendered lines from which a document counts as near the ceiling, a 20-line
 * margin under the 300 the gate fails past.
 */
export const NEAR_CEILING = 280

export interface CeilingFinding {
  readonly kind: 'ceiling-unstated'
  readonly subject: string
  readonly message: string
}

/** Reads a project-relative document, or nothing where it does not exist yet. */
export type ReadDocument = (rel: string) => string | undefined

export function documentReader(root: string): ReadDocument {
  return (rel) => {
    const path = join(root, rel)
    return existsSync(path) ? readFileSync(path, 'utf8') : undefined
  }
}

function spans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) =>
    match[1].trim().replace(/^\.\//, ''),
  )
}

const isMarkdown = (path: string) => /\.md$/i.test(path)

/** Joins a wrapped line or nested bullet onto the entry above it. */
function readEntries(lines: readonly string[]): string[] {
  const entries: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    if (trimmed.startsWith('- ')) entries.push(trimmed)
    else if (entries.length > 0) entries[entries.length - 1] += ` ${trimmed}`
  }
  return entries
}

/**
 * Reports each entry whose first-span markdown target is near the ceiling and
 * names no second markdown path. Measured with the gate's own height.
 */
export function checkCeiling(
  filesToTouch: readonly string[],
  read: ReadDocument,
): CeilingFinding[] {
  const findings: CeilingFinding[] = []
  const seen = new Set<string>()

  for (const entry of readEntries(filesToTouch)) {
    const [target, ...rest] = spans(entry)
    if (target === undefined || !isMarkdown(target) || seen.has(target))
      continue

    const source = read(target)
    if (source === undefined || lengthExemption(target, source) !== null)
      continue

    const lines = documentHeight(source)
    if (lines < NEAR_CEILING) continue

    seen.add(target)
    const stated = rest.some((path) => isMarkdown(path) && path !== target)
    if (stated) continue

    findings.push({
      kind: 'ceiling-unstated',
      subject: target,
      message: `renders at ${lines} lines, ${NEAR_CEILING} or more of the 300 ceiling, and its entry names no second markdown path for the new content. Say in the entry which reference the content goes to or which split comes first.`,
    })
  }

  return findings
}
