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

/** Counts the boxes `review-ui` left undriven rather than naming any, since numbers shift. */
const UNDRIVEN_WAIVER_LINE = /^- \*\*Waived undriven:\*\* (\d+):\s*\S/

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/

/**
 * Every line of the review bodies outside a fenced block, in order, trailing
 * whitespace dropped, since a fenced line is a quoted sample, not a waiver. Only
 * review bodies are read, since a review is the one surface a worker never writes.
 */
function unfencedLines(reviews: readonly ReviewRow[]): string[] {
  const lines: string[] = []
  for (const review of reviews) {
    let fence: string | undefined
    for (const raw of (review.body ?? '').split('\n')) {
      const line = raw.trimEnd()
      const [, run, info = ''] = FENCE.exec(line) ?? []
      if (run !== undefined) {
        if (fence === undefined) fence = run
        // A shorter run, or one with an info string, is text inside the block.
        else if (run.startsWith(fence) && info.trim() === '') fence = undefined
        continue
      }
      if (fence === undefined) lines.push(line)
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

/** The box count on every undriven waiver in the review bodies, in order. */
export function readUndrivenWaivers(reviews: readonly ReviewRow[]): number[] {
  return unfencedLines(reviews).flatMap((line) => {
    const count = UNDRIVEN_WAIVER_LINE.exec(line)?.[1]
    return count === undefined ? [] : [Number(count)]
  })
}
