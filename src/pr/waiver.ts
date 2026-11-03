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

const FENCE = /^\s*(```|~~~)/

/**
 * Every waiver in the review bodies, in order. A line inside a fenced block is
 * a quoted sample rather than a waiver, so it never counts.
 *
 * Review bodies alone are read, never the pull request body or an issue
 * comment, since every session posts as one account and a review is the one
 * surface a worker never writes.
 */
export function readWaivers(reviews: readonly ReviewRow[]): Waiver[] {
  const waivers: Waiver[] = []
  for (const review of reviews) {
    let fence: string | undefined
    for (const line of (review.body ?? '').split('\n')) {
      const opener = FENCE.exec(line)?.[1]
      if (opener !== undefined) {
        if (fence === undefined) fence = opener
        else if (opener === fence) fence = undefined
        continue
      }
      if (fence !== undefined) continue
      const match = WAIVER_LINE.exec(line.trimEnd())
      if (match?.[1] !== undefined && match[2] !== undefined) {
        waivers.push({ path: match[1], reason: match[2] })
      }
    }
  }
  return waivers
}
