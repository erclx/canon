import { describe, expect, it } from 'vitest'
import {
  entriesSince,
  oldestVersion,
  parseChangelog,
} from '@/version/changelog'

const COMPARE = 'https://github.com/erclx/canon/compare'

const CHANGELOG = [
  '# Changelog',
  '',
  `## [5.50.0](${COMPARE}/v5.49.0...v5.50.0) (2026-10-21)`,
  '',
  '### Features',
  '',
  '* **gate:** queue hand-run suites',
  '',
  `## [5.49.0](${COMPARE}/v5.48.0...v5.49.0) (2026-10-19)`,
  '',
  '### Features',
  '',
  '* **pr:** drive a throwaway copy',
  '',
  `## [5.48.0](${COMPARE}/v5.47.0...v5.48.0) (2026-10-19)`,
  '',
  '### Bug Fixes',
  '',
  '* **tasks:** close on operator checks',
  '',
].join('\n')

describe('parseChangelog', () => {
  it('should split the file on its release headings, newest first', () => {
    const entries = parseChangelog(CHANGELOG)

    expect(entries.map((entry) => entry.version)).toEqual([
      '5.50.0',
      '5.49.0',
      '5.48.0',
    ])
  })

  it('should keep an entry heading and body and nothing from its neighbor', () => {
    const [newest] = parseChangelog(CHANGELOG)

    expect(newest?.markdown).toBe(
      [
        `## [5.50.0](${COMPARE}/v5.49.0...v5.50.0) (2026-10-21)`,
        '',
        '### Features',
        '',
        '* **gate:** queue hand-run suites',
      ].join('\n'),
    )
  })

  it('should read no entry from text carrying no release heading', () => {
    expect(parseChangelog('# Changelog\n\nNothing released.\n')).toEqual([])
  })
})

describe('entriesSince', () => {
  const entries = parseChangelog(CHANGELOG)

  it('should return every release after the stamped one up to the running one, oldest first', () => {
    const range = entriesSince(entries, '5.48.0', '5.50.0')

    expect(range).toEqual({
      kind: 'range',
      entries: [entries[1], entries[0]],
    })
  })

  it('should return the running release alone when it is the next one after the stamp', () => {
    const range = entriesSince(entries, '5.49.0', '5.50.0')

    expect(range).toEqual({ kind: 'range', entries: [entries[0]] })
  })

  it('should return an empty range when the stamp already names the running version', () => {
    const range = entriesSince(entries, '5.50.0', '5.50.0')

    expect(range).toEqual({ kind: 'range', entries: [] })
  })

  it('should refuse a stamped version the file never listed', () => {
    const range = entriesSince(entries, '5.47.0', '5.50.0')

    expect(range).toEqual({ kind: 'unknown-version', version: '5.47.0' })
  })

  it('should refuse a running version the file never listed', () => {
    const range = entriesSince(entries, '5.48.0', '5.51.0')

    expect(range).toEqual({ kind: 'unknown-version', version: '5.51.0' })
  })

  it('should refuse a stamp newer than the running version rather than return nothing', () => {
    const range = entriesSince(entries, '5.50.0', '5.49.0')

    expect(range).toEqual({ kind: 'unknown-version', version: '5.50.0' })
  })

  it('should refuse a version that does not parse', () => {
    const range = entriesSince(entries, 'latest', '5.50.0')

    expect(range).toEqual({ kind: 'unknown-version', version: 'latest' })
  })
})

describe('oldestVersion', () => {
  it('should return the oldest of several recorded versions', () => {
    expect(oldestVersion(['5.49.0', '5.47.0', '5.48.1'])).toBe('5.47.0')
  })

  it('should compare numerically rather than as text', () => {
    expect(oldestVersion(['5.10.0', '5.9.0'])).toBe('5.9.0')
  })

  it('should skip a version that does not parse', () => {
    expect(oldestVersion(['not-a-version', '5.49.0'])).toBe('5.49.0')
  })

  it('should return nothing when no version was recorded', () => {
    expect(oldestVersion([])).toBeUndefined()
  })
})
