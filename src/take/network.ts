import type { NetworkAction, NetworkRule } from '@/take/plan'

/**
 * The request matching both routes share. The stepper intercepts over the raw
 * protocol and the screencast through Playwright's routing, and each has its
 * own pattern syntax, so neither is used: every request is intercepted and
 * matched here, and a plan means the same on either route and on a fallback.
 */

/** A pattern that matched, with how many requests it caught. */
export interface NetworkMatch {
  readonly match: string
  readonly action: NetworkAction
  readonly requests: number
}

/**
 * Whether `url` is the whole address `pattern` names, where `*` matches any
 * run of characters and every other character matches itself.
 */
export function matchesPattern(pattern: string, url: string): boolean {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${source}$`).test(url)
}

/**
 * One load's matching of a beat's rules. A fallback opens a fresh one, since
 * it loads the page again. Only patterns and counts leave it, never an
 * address, which can carry a ticket and is posted on a pull request.
 */
export class NetworkTally {
  private readonly counts: number[]

  constructor(private readonly rules: readonly NetworkRule[]) {
    this.counts = rules.map(() => 0)
  }

  /** The action the first matching rule names, counting the request against it. */
  actionFor(url: string): NetworkAction | undefined {
    const index = this.rules.findIndex((rule) =>
      matchesPattern(rule.match, url),
    )
    if (index < 0) return undefined
    this.counts[index] = (this.counts[index] ?? 0) + 1
    return this.rules[index]?.action
  }

  matched(): NetworkMatch[] {
    return this.rules.flatMap((rule, index) => {
      const requests = this.counts[index] ?? 0
      return requests > 0 ? [{ ...rule, requests }] : []
    })
  }

  unmatched(): string[] {
    return this.rules
      .filter((_, index) => (this.counts[index] ?? 0) === 0)
      .map((rule) => rule.match)
  }

  /** The held patterns that caught a request, which a load can be waiting on. */
  holding(): string[] {
    return this.matched()
      .filter((rule) => rule.action === 'hold')
      .map((rule) => rule.match)
  }
}

/** A beat whose network list named a pattern no request matched. */
export class NetworkUnmatched extends Error {
  constructor(readonly patterns: readonly string[]) {
    super(
      `no request matched ${patterns.join(', ')}, so the beat filmed without the state it holds or fails`,
    )
  }
}

/**
 * A load failure with the held patterns named, since a held script, sheet, or
 * image keeps the load event from firing and the bare timeout hides why.
 */
export function withHeld(error: unknown, tally: NetworkTally): unknown {
  const held = tally.holding()
  if (held.length === 0 || !(error instanceof Error)) return error
  error.message = `${error.message}, while holding ${held.join(', ')}`
  return error
}
