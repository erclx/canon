import { describe, expect, it } from 'vitest'

import { filmFrom, readFilm, readReel, reelFrom } from './film'

const stamp = [
  'source: http://127.0.0.1:4537/#records',
  'plan-sha256: abc',
  'image-sha256: def',
  'still-sha256: ghi',
  'beat-stills-sha256: a b c',
  'reel-seconds: 7.9',
  'beats: 1.5 2.25 4.15',
  '',
].join('\n')

describe('filmFrom', () => {
  it('should time each beat still at the second its beat ends', () => {
    const film = filmFrom(stamp)

    expect(film.seconds).toBe(8)
    expect(film.beats.map((beat) => beat.at)).toEqual(['0:02', '0:04', '0:08'])
  })

  it('should refuse a stamp that names no beat', () => {
    expect(() => filmFrom('reel-seconds: 3\n')).toThrow(/no beat/)
  })
})

const reelStamp = [
  'source: canon/frames:pr-3289/0ce632a/20261120T191226Z/reel.webp',
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
  it('should read the pull request, its address, the length, and the size', () => {
    expect(reelFrom(reelStamp)).toEqual({
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

describe('readFilm', () => {
  it('should read one still per beat from each theme committed reel', () => {
    const dark = readFilm('dark')
    const light = readFilm('light')

    expect(dark.beats.length).toBeGreaterThan(0)
    expect(light.beats).toHaveLength(dark.beats.length)
    expect(dark.beats[0]?.still).toBe('/film-beat-1.webp')
    expect(light.beats[0]?.still).toBe('/film-beat-1-light.webp')
  })
})
