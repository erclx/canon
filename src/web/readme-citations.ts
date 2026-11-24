import { isMarked } from '@/sweep/exempt-marker'

export const README_PARAPHRASE_MARKER = 'canon-allow-readme-paraphrase'

export type ReadmeCitationKind = 'quoted' | 'paraphrase' | 'bare'

export interface ReadmeCitation {
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  readonly kind: ReadmeCitationKind
  /** The citation comment as written, so a report names the line to fix. */
  readonly text: string
  /** Verbatim phrases to check against `README.md`, set only for `kind: 'quoted'`. */
  readonly phrases: readonly string[]
}

const ANCHOR = /README\.md:\s*(.*)$/
const QUOTED_PHRASE = /"([^"]+)"/g

/**
 * Every `README.md:` anchor comment in one file, classified by shape: `quoted`
 * carries verbatim phrases checked even on a marked line, `paraphrase` is a marked
 * line with no quote, and `bare` is the retired `README.md:<n>` form, reported so it cannot return.
 */
export function readmeCitationsIn(
  file: string,
  text: string,
): ReadmeCitation[] {
  const lines = text.split('\n')
  const citations: ReadmeCitation[] = []

  for (const [index, line] of lines.entries()) {
    const match = ANCHOR.exec(line)
    if (match === null) continue

    const rest = (match[1] ?? '').trim()

    const phrases = [...rest.matchAll(QUOTED_PHRASE)].map(
      (found) => found[1] ?? '',
    )
    if (phrases.length > 0) {
      citations.push({
        file,
        line: index + 1,
        kind: 'quoted',
        text: line.trim(),
        phrases,
      })
      continue
    }

    if (isMarked(lines, index, README_PARAPHRASE_MARKER)) {
      citations.push({
        file,
        line: index + 1,
        kind: 'paraphrase',
        text: line.trim(),
        phrases: [],
      })
      continue
    }

    if (/^\d/.test(rest)) {
      citations.push({
        file,
        line: index + 1,
        kind: 'bare',
        text: line.trim(),
        phrases: [],
      })
    }
  }

  return citations
}

export const README_ONLY_MARKER = 'canon-readme-only'

export interface UncitedReadmeSection {
  readonly heading: string
  /** One-based line of the `## ` heading in `README.md`. */
  readonly line: number
}

/** The comment's own close is stripped first, or `isMarked` reads `-->` as the reason. */
function isReadmeOnly(line: string): boolean {
  return isMarked([line.replace(/-->\s*$/, '')], 0, README_ONLY_MARKER)
}

const SECTION_HEADING = /^## (.+)$/
const FENCE = /^\s*(```|~~~)/

/**
 * Every `## ` section of `README.md` that no quoted phrase falls inside and no
 * `canon-readme-only: <reason>` marker covers. The marker sits on the first
 * non-blank line under the heading, since a formatter puts a blank line between
 * the two. A phrase counts anywhere in the section, heading included, so a
 * section cited only through its body passes.
 */
export function uncitedReadmeSections(
  readme: string,
  phrases: readonly string[],
): UncitedReadmeSection[] {
  const lines = readme.split('\n')
  const starts: number[] = []
  let fenced = false

  for (const [index, line] of lines.entries()) {
    if (FENCE.test(line)) fenced = !fenced
    else if (!fenced && SECTION_HEADING.test(line)) starts.push(index)
  }

  const uncited: UncitedReadmeSection[] = []

  for (const [position, start] of starts.entries()) {
    const end = starts[position + 1] ?? lines.length
    const body = lines.slice(start, end).join('\n')
    if (phrases.some((phrase) => body.includes(phrase))) continue

    let first = start + 1
    while (first < end && (lines[first] ?? '').trim() === '') first += 1
    if (first < end && isReadmeOnly(lines[first] ?? '')) continue

    uncited.push({
      heading: SECTION_HEADING.exec(lines[start] ?? '')?.[1] ?? '',
      line: start + 1,
    })
  }

  return uncited
}
