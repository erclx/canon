import { describe, expect, it } from 'vitest'

import { filmFrom, readFilm } from './film'

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
