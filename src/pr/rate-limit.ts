/**
 * What a GitHub rate limit told a refused `gh` call, read off the message gh
 * prints on stderr and the free `rate_limit` endpoint, so a verb can name the
 * spent quota rather than blaming the branch.
 */

/** The spent bucket and when it refills. Both absent when the bucket read failed. */
export interface RateLimit {
  /** A `resources` key of the `rate_limit` endpoint, or `secondary`. */
  readonly bucket?: string
  /** The bucket's reset as an ISO time, absent for a secondary limit, which reports none. */
  readonly resetAt?: string
}

const RATE_LIMITED = /rate limit/i
const SECONDARY = /secondary rate limit/i

interface Bucket {
  readonly remaining?: unknown
  readonly reset?: unknown
}

/** The first bucket at zero remaining, in the endpoint's own order, which leads with `core`. */
function exhaustedBucket(json: string): RateLimit {
  let resources: Record<string, Bucket> | undefined
  try {
    resources = (JSON.parse(json) as { resources?: Record<string, Bucket> })
      .resources
  } catch {
    return {}
  }
  for (const [bucket, row] of Object.entries(resources ?? {})) {
    if (row.remaining !== 0) continue
    return typeof row.reset === 'number'
      ? { bucket, resetAt: new Date(row.reset * 1000).toISOString() }
      : { bucket }
  }
  return {}
}

/**
 * The rate limit a failed call hit, or undefined when its stderr names none.
 * `buckets` is the `gh api rate_limit` stdout, undefined when that read failed.
 */
export function rateLimitOf(
  stderr: string,
  buckets: string | undefined,
): RateLimit | undefined {
  if (!RATE_LIMITED.test(stderr)) return undefined
  if (SECONDARY.test(stderr)) return { bucket: 'secondary' }
  return buckets === undefined ? {} : exhaustedBucket(buckets)
}
