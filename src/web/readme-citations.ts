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
 * Every `README.md:` anchor comment in one file, classified by shape.
 *
 * `quoted` carries verbatim phrases a caller checks against the current
 * `README.md`. A quote is checked even on a line carrying
 * `README_PARAPHRASE_MARKER`, since the marker says part of a string is
 * synthesized and asserts nothing about a quoted phrase. `paraphrase` is a
 * marked line with no quote, muted the way `isMarked` mutes exemptions. `bare`
 * is the retired `README.md:<n>` form, reported so it cannot come back.
 * Modeled on `clientCommandCitationsIn` in `src/gate/client-commands.ts`.
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
