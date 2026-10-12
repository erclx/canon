import { bodyLines, maskDisplayed } from '@/markdown/scan'

export interface HeadingCaseFinding {
  readonly line: number
  /** The heading or title as written, markers removed. */
  readonly text: string
  /** Every word after the first that opens on a capital. */
  readonly words: readonly string[]
}

const HEADING = /^#{1,6}\s+(.*?)(?:\s+#+)?\s*$/
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const TITLE = /^title:\s*(["']?)(.*?)\1\s*$/
const CODE_SPAN = /(`+)(?:(?!\1).)*\1/g
const CAPITALIZED =/^[A-Z][a-z]/

/**
 * The words of `text` that break sentence case.
 *
 * A code span stands for one lowercase word, so a heading opening on one
 * counts that span as its first word. The first word with a letter in it is
 * exempt, which keeps a leading numeral from promoting the next word.
 */
function capitalizedAfterFirst(text: string): string[] {
  const masked = maskDisplayed(text.replace(CODE_SPAN, 'code'))
    .replace(/\s+/g, ' ')
    .trim()
  const words = masked === '' ? [] : masked.split(' ')
  const flagged: string[] = []
  let seenFirst = false

  for (const raw of words) {
    const word = raw.replace(/^[^\p{L}]+/u, '')
    if (!/\p{L}/u.test(raw)) continue
    if (!seenFirst) {
      seenFirst = true
      continue
    }
    if (CAPITALIZED.test(word)) flagged.push(word)
  }

  return flagged
}

/**
 * Finds a heading or a frontmatter `title` carrying a capitalized word after
 * its first, outside code spans and all-caps tokens.
 *
 * A proper noun is the one case it cannot tell from title case, so the finding
 * is a warning and no names list backs it.
 */
export function findHeadingCase(source: string): HeadingCaseFinding[] {
  const found: HeadingCaseFinding[] = []
  const check = (line: number, text: string): void => {
    const words = capitalizedAfterFirst(text)
    if (words.length > 0) found.push({ line, text, words })
  }

  const frontmatter = FRONTMATTER.exec(source)
  if (frontmatter) {
    for (const [index, text] of frontmatter[1].split('\n').entries()) {
      const title = TITLE.exec(text)
      if (title) check(index + 2, title[2])
    }
  }

  for (const line of bodyLines(source)) {
    if (line.fenced) continue
    const heading = HEADING.exec(line.text)
    if (heading) check(line.number, heading[1])
  }

  return found
}
