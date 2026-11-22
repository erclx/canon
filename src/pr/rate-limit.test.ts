import { describe, expect, it } from 'vitest'
import { rateLimitOf } from '@/pr/rate-limit'

const PRIMARY =
  'gh: API rate limit exceeded for user ID 1234. If you reach out to GitHub Support for help, please include the request ID ABCD. (HTTP 403)'
const SECONDARY =
  'gh: You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)'

function buckets(core: number, graphql: number): string {
  return JSON.stringify({
    resources: {
      core: { limit: 5000, remaining: core, reset: 1795321310, used: 0 },
      graphql: { limit: 5000, remaining: graphql, reset: 1795321445, used: 0 },
    },
  })
}

describe('rateLimitOf', () => {
  it('should name the spent bucket and its reset on a primary limit', () => {
    expect(rateLimitOf(PRIMARY, buckets(0, 4978))).toEqual({
      bucket: 'core',
      resetAt: '2026-11-22T04:21:50.000Z',
    })
  })

  it('should name the graphql bucket when that one is spent', () => {
    expect(rateLimitOf(PRIMARY, buckets(4479, 0))).toEqual({
      bucket: 'graphql',
      resetAt: '2026-11-22T04:24:05.000Z',
    })
  })

  it('should report a secondary limit with no reset, whatever the buckets read', () => {
    expect(rateLimitOf(SECONDARY, buckets(4479, 4978))).toEqual({
      bucket: 'secondary',
    })
  })

  it('should still report a primary limit when the bucket read failed', () => {
    expect(rateLimitOf(PRIMARY, undefined)).toEqual({})
  })

  it('should still report a primary limit when the bucket read does not parse', () => {
    expect(rateLimitOf(PRIMARY, 'not json')).toEqual({})
  })

  it('should not read an auth failure as a rate limit', () => {
    expect(
      rateLimitOf('gh: Bad credentials (HTTP 401)', buckets(0, 0)),
    ).toBeUndefined()
  })

  it('should not read a missing pull request as a rate limit', () => {
    expect(rateLimitOf('gh: Not Found (HTTP 404)', undefined)).toBeUndefined()
  })

  it('should not read an empty stderr as a rate limit', () => {
    expect(rateLimitOf('', undefined)).toBeUndefined()
  })
})
