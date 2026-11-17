import { describe, expect, it } from 'vitest'
import { NetworkTally, matchesPattern, withHeld } from '@/take/network'

/**
 * Covers the one pattern syntax both routes match a request with, and the
 * tally a beat's record and its refusal read, without a browser.
 */

describe('matchesPattern', () => {
  it.each([
    ['*/data', 'http://127.0.0.1:4173/data'],
    ['http://127.0.0.1:*/data', 'http://127.0.0.1:4173/data'],
    ['*/api/*', 'https://app.test/api/live?ticket=abc'],
    ['https://app.test/a.b', 'https://app.test/a.b'],
  ])('should match %s against %s', (pattern, url) => {
    expect(matchesPattern(pattern, url)).toBe(true)
  })

  it.each([
    ['*/data', 'http://127.0.0.1:4173/data/more'],
    ['http://app.test/data', 'http://app.test/data?x=1'],
    ['https://app.test/a.b', 'https://app.test/aXb'],
    ['*/data(1)', 'http://app.test/data1'],
  ])('should not match %s against %s', (pattern, url) => {
    expect(matchesPattern(pattern, url)).toBe(false)
  })
})

describe('NetworkTally', () => {
  it('should give a request the action of the first pattern it matches', () => {
    const tally = new NetworkTally([
      { match: '*/api/live', action: 'hold' },
      { match: '*/api/*', action: 'abort' },
    ])

    expect(tally.actionFor('http://app.test/api/live')).toBe('hold')
    expect(tally.actionFor('http://app.test/api/other')).toBe('abort')
  })

  it('should give a request no pattern matches no action', () => {
    const tally = new NetworkTally([{ match: '*/data', action: 'hold' }])

    expect(tally.actionFor('http://app.test/style.css')).toBeUndefined()
  })

  it('should count every request a pattern matched, retries included', () => {
    const tally = new NetworkTally([{ match: '*/data', action: 'hold' }])
    tally.actionFor('http://app.test/data')
    tally.actionFor('http://app.test/data')

    expect(tally.matched()).toEqual([
      { match: '*/data', action: 'hold', requests: 2 },
    ])
  })

  it('should name each pattern that matched nothing and leave it out of the matched', () => {
    const tally = new NetworkTally([
      { match: '*/data', action: 'hold' },
      { match: '*/missing', action: 'abort' },
    ])
    tally.actionFor('http://app.test/data')

    expect(tally.unmatched()).toEqual(['*/missing'])
    expect(tally.matched()).toEqual([
      { match: '*/data', action: 'hold', requests: 1 },
    ])
  })

  it('should name only the held patterns that matched as holding', () => {
    const tally = new NetworkTally([
      { match: '*/data', action: 'hold' },
      { match: '*/font.woff2', action: 'hold' },
      { match: '*/fail', action: 'abort' },
    ])
    tally.actionFor('http://app.test/data')
    tally.actionFor('http://app.test/fail')

    expect(tally.holding()).toEqual(['*/data'])
  })

  it('should name the held patterns on a load failure', () => {
    const tally = new NetworkTally([{ match: '*/app.js', action: 'hold' }])
    tally.actionFor('http://app.test/app.js')

    const error = withHeld(new Error('fired no load event'), tally)

    expect(error).toMatchObject({
      message: 'fired no load event, while holding */app.js',
    })
  })

  it('should leave a load failure alone when nothing is held', () => {
    const tally = new NetworkTally([{ match: '*/app.js', action: 'hold' }])

    const error = withHeld(new Error('fired no load event'), tally)

    expect(error).toMatchObject({ message: 'fired no load event' })
  })

  it('should never carry a matched address in what it reports', () => {
    const tally = new NetworkTally([{ match: '*/api/*', action: 'hold' }])
    tally.actionFor('https://app.test/api/live?ticket=secret')

    expect(JSON.stringify(tally.matched())).not.toContain('secret')
  })
})
