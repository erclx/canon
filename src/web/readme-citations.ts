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
 * `quoted` carries one or more verbatim phrases a caller checks against the
 * current `README.md` text, which is what replaces a line number that drifts
 * silently the moment the cited line moves. A quote is checked whether or not
 * the line also carries `README_PARAPHRASE_MARKER`, since a marker documents
 * that part of a string is synthesized and asserts nothing about a phrase the
 * same line puts in quotes: quoting a borrow verbatim and then never checking
 * it would let the exact drift this file exists to catch survive inside its
 * own escape hatch. `paraphrase` is what a marked line falls to only once it
 * carries no quote of its own, muted by `README_PARAPHRASE_MARKER` the way
 * `isMarked` mutes every other exemption in this repository. `bare` is the
 * retired `README.md:<n>` form, reported rather than accepted so the fragile
 * convention this replaces cannot come back on a later edit.
 *
 * Modeled on `clientCommandCitationsIn` in `src/gate/client-commands.ts`, including
 * its use of `isMarked` for the exemption.
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
