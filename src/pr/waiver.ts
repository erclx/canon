import type { ReviewRow } from '@/pr/review-scope'

/** A painted path a review accepted as owing no capture, and why. */
export interface Waiver {
  readonly path: string
  readonly reason: string
}

/**
 * The line `review-pr` writes in a pass body to waive one path. The path is
 * kept exactly as spelled, so a waiver matches an uncaptured path only when
 * both spell it alike.
 */
const WAIVER_LINE = /^- \*\*Waived capture:\*\* `([^`]+)`:\s*(\S.*)$/

/**
 * The line `review-pr` writes in a pass body to accept a drivable checklist
 * with no reel at the head. It names no path, since one reel covers the whole
 * checklist and box numbers shift when the checklist is edited.
 */
const REEL_WAIVER_LINE = /^- \*\*Waived reel:\*\*\s*(\S.*)$/

const FENCE = /^\s*(```|~~~)/

/**
 * Every line of the review bodies outside a fenced block, in order, with
 * trailing whitespace dropped. A line inside a fence is a quoted sample rather
 * than a waiver, so it never reaches a reader.
 *
 * Review bodies alone are read, never the pull request body or an issue
 * comment, since every session posts as one account and a review is the one
 * surface a worker never writes.
 */
function unfencedLines(reviews: readonly ReviewRow[]): string[] {
  const lines: string[] = []
  for (const review of reviews) {
    let fence: string | undefined
    for (const line of (review.body ?? '').split('\n')) {
      const opener = FENCE.exec(line)?.[1]
      if (opener !== undefined) {
        if (fence === undefined) fence = opener
        else if (opener === fence) fence = undefined
        continue
      }
      if (fence === undefined) lines.push(line.trimEnd())
    }
  }
  return lines
}

/** Every capture waiver in the review bodies, in order. */
export function readWaivers(reviews: readonly ReviewRow[]): Waiver[] {
  const waivers: Waiver[] = []
  for (const line of unfencedLines(reviews)) {
    const match = WAIVER_LINE.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) {
      waivers.push({ path: match[1], reason: match[2] })
    }
  }
  return waivers
}

/** The reason on every reel waiver in the review bodies, in order. */
export function readReelWaivers(reviews: readonly ReviewRow[]): string[] {
  return unfencedLines(reviews).flatMap((line) => {
    const reason = REEL_WAIVER_LINE.exec(line)?.[1]
    return reason === undefined ? [] : [reason]
  })
}
