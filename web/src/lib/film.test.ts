import { describe, expect, it } from 'vitest'

import { readReel, reelFrom } from './film'

const reelStamp = [
  'source: canon/frames:pr-3289/0ce632a/20261120T191226Z/reel.webp',
  'repository: erclx/canon',
  'pull-request: 3289',
  'filmed-at: 0ce632a',
  'address: https://github.com/erclx/canon/pull/3289',
  'image-sha256: abc',
  'still-sha256: def',
  'width: 960',
  'height: 600',
  'reel-seconds: 12.4',
  '',
].join('\n')

describe('reelFrom', () => {
  it('should read the repository, pull request, its address, the length, and the size', () => {
    expect(reelFrom(reelStamp)).toEqual({
      repository: 'erclx/canon',
      pullRequest: 3289,
      address: 'https://github.com/erclx/canon/pull/3289',
      seconds: 12.4,
      width: 960,
      height: 600,
    })
  })

  it('should refuse a stamp that names no pull request', () => {
    const stamp = reelStamp.replace('pull-request: 3289\n', '')

    expect(() => reelFrom(stamp)).toThrow(/names no pull-request/)
  })

  it('should refuse a stamp that names no repository', () => {
    const stamp = reelStamp.replace('repository: erclx/canon\n', '')

    expect(() => reelFrom(stamp)).toThrow(/names no repository/)
  })

  it('should refuse a pull request it cannot read as a number', () => {
    const stamp = reelStamp.replace('pull-request: 3289', 'pull-request: #?')

    expect(() => reelFrom(stamp)).toThrow(/pull-request is not a number/)
  })
})

describe('readReel', () => {
  it('should read the committed reel stamp', () => {
    const reel = readReel()

    expect(reel.pullRequest).toBeGreaterThan(0)
    expect(reel.address).toMatch(new RegExp(`/pull/${reel.pullRequest}$`))
  })
})
