import { linesOutsideFences, maskCodeSpans } from '@/markdown/scan'

/**
 * The keywords GitHub reads as closing an issue on merge, each with its
 * tenses. The keyword must start a word, so `disclosed #12` closes nothing,
 * and GitHub reads only the one number that follows it, so `Closes #12, #13`
 * closes #12 alone.
 */
const CLOSING =
  /(?<!\w)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?[ \t]+#(\d+)/gi

export interface ClosingCheck {
  /** Expected issues the body carries no closing reference for. */
  readonly missing: readonly number[]
  /** Issues the body closes that the expectation did not name. */
  readonly stray: readonly number[]
}

/**
 * Reads the issue numbers a body closes, in order and deduped. A code span and
 * a fence quote a keyword rather than use it, and GitHub ignores both.
 */
export function readClosingReferences(body: string): readonly number[] {
  const numbers = new Set<number>()

  for (const line of linesOutsideFences(body)) {
    for (const match of maskCodeSpans(line).matchAll(CLOSING)) {
      numbers.add(Number(match[1]))
    }
  }

  return [...numbers]
}

/** Compares the issues a body closes to the issues it should. */
export function checkClosing(
  body: string,
  expected: readonly number[],
): ClosingCheck {
  const found = readClosingReferences(body)

  return {
    missing: expected.filter((number) => !found.includes(number)),
    stray: found.filter((number) => !expected.includes(number)),
  }
}
