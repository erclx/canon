import { describe, expect, it } from 'vitest'
import { colorFor, driftedLabels, missingLabels } from '@/labels/sync'

describe('missingLabels', () => {
  it('should list each map label the remote lacks, in map order', () => {
    expect(missingLabels(['tooling', 'claude', 'docs'], ['claude'])).toEqual([
      'tooling',
      'docs',
    ])
  })

  it('should list nothing when the remote carries every map label', () => {
    expect(missingLabels(['cli'], ['cli', 'by-hand'])).toEqual([])
  })

  it('should read a remote label differing only in case as present', () => {
    expect(missingLabels(['docs', 'cli'], ['Docs'])).toEqual(['cli'])
  })

  it('should never list a remote label the map does not name', () => {
    expect(missingLabels([], ['by-hand'])).toEqual([])
  })
})

describe('colorFor', () => {
  it('should give the label at map index 0 the first palette color', () => {
    expect(colorFor({ label: 'cli', prefixes: ['src/'] }, 0)).toBe('1f6feb')
  })

  it('should wrap the 13th label back to the first color', () => {
    expect(colorFor({ label: 'x', prefixes: ['x/'] }, 11)).toBe('ffa657')
    expect(colorFor({ label: 'x', prefixes: ['x/'] }, 12)).toBe('1f6feb')
  })

  it('should prefer the color a row declares over the palette', () => {
    expect(
      colorFor({ label: 'cli', prefixes: ['src/'], color: 'abcdef' }, 3),
    ).toBe('abcdef')
  })
})

describe('driftedLabels', () => {
  const rows = [
    { label: 'cli', prefixes: ['src/'], color: '1f6feb' },
    { label: 'docs', prefixes: ['docs/'] },
  ]

  it('should report a declared color the remote holds differently', () => {
    expect(driftedLabels(rows, [{ name: 'cli', color: 'ededed' }])).toEqual([
      { label: 'cli', declared: '1f6feb', remote: 'ededed' },
    ])
  })

  it('should read a remote color differing only in case as matching', () => {
    expect(driftedLabels(rows, [{ name: 'CLI', color: '1F6FEB' }])).toEqual([])
  })

  it('should report nothing for a recolored label that declares no color', () => {
    expect(driftedLabels(rows, [{ name: 'docs', color: 'ff0000' }])).toEqual([])
  })

  it('should report nothing for a declared label the remote lacks', () => {
    expect(driftedLabels(rows, [])).toEqual([])
  })
})
