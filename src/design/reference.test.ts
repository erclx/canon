import { describe, expect, it } from 'vitest'

import {
  boardAssets,
  classifyDrift,
  MappingError,
  missingFrames,
  parseFrameMap,
  toReference,
} from './reference'

describe('parseFrameMap', () => {
  it('should read each reference and the board frame it is captured from', () => {
    const json = JSON.stringify({
      frames: {
        'landing/page': 'landing/landing-preview/page',
        'readme/page': 'readme/final/readme',
      },
    })

    expect(parseFrameMap(json)).toEqual(
      new Map([
        ['landing/page', 'landing/landing-preview/page'],
        ['readme/page', 'readme/final/readme'],
      ]),
    )
  })

  it('should refuse a reference that is not a group and a name, naming it', () => {
    const json = JSON.stringify({
      frames: { 'Landing/page-dark.png': 'landing/landing-preview/page' },
    })

    expect(() => parseFrameMap(json)).toThrow(MappingError)
    expect(() => parseFrameMap(json)).toThrow('Landing/page-dark.png')
  })

  it('should refuse a board ref missing its project, page, or frame', () => {
    const json = JSON.stringify({ frames: { 'landing/page': 'preview/page' } })

    expect(() => parseFrameMap(json)).toThrow('landing/page')
  })

  it('should refuse a file with no frames object', () => {
    expect(() => parseFrameMap('{"surfaces": []}')).toThrow(MappingError)
  })
})

describe('missingFrames', () => {
  it('should name each mapped board frame the board does not hold', () => {
    const map = new Map([
      ['landing/page', 'landing/landing-preview/page'],
      ['landing/page-phone', 'landing/landing-preview/page-phone'],
    ])

    expect(
      missingFrames(map, new Set(['landing/landing-preview/page'])),
    ).toEqual(['landing/landing-preview/page-phone'])
  })
})

describe('toReference', () => {
  it('should point each project asset link at the project kit', () => {
    const html =
      '<link href="../assets/palette.css"><img src="../assets/mark-dark.svg">'

    const reference = toReference(html, 'landing')

    expect(reference).toBe(
      '<link href="../kit/landing/palette.css"><img src="../kit/landing/mark-dark.svg">',
    )
  })

  it('should leave a link outside the project assets untouched', () => {
    const html =
      '<img src="https://example.com/a.png"><link href="/assets/x.css"><use href="url(#c)">'

    expect(toReference(html, 'readme')).toBe(html)
  })
})

describe('boardAssets', () => {
  it('should list each project asset a frame loads once', () => {
    const html =
      '<link href="../assets/palette.css"><img src="../assets/film-dark.png"><img src="../assets/film-dark.png"><div style="background: url(\'../assets/grain.png\')">'

    expect(boardAssets(html)).toEqual([
      'palette.css',
      'film-dark.png',
      'grain.png',
    ])
  })

  it('should list nothing for a frame loading no project asset', () => {
    expect(boardAssets('<img src="https://example.com/a.png">')).toEqual([])
  })
})

describe('classifyDrift', () => {
  it('should fail the HTML and the file set and only warn on PNG bytes', () => {
    const drift = classifyDrift(
      new Map<string, string | Uint8Array>([
        ['x/a.html', '<p>a</p>'],
        ['x/b.html', '<p>b2</p>'],
        ['x/c.png', new Uint8Array([1, 2])],
        ['x/d.png', new Uint8Array([3])],
      ]),
      new Map<string, string | Uint8Array>([
        ['x/a.html', '<p>a</p>'],
        ['x/b.html', '<p>b</p>'],
        ['x/c.png', new Uint8Array([1, 9])],
        ['x/old.png', new Uint8Array([4])],
      ]),
    )

    expect(drift).toEqual({
      changed: ['x/b.html'],
      pngDiffers: ['x/c.png'],
      missing: ['x/d.png'],
      stray: ['x/old.png'],
    })
  })

  it('should report nothing when every file matches', () => {
    const files = new Map<string, string | Uint8Array>([
      ['x/a.html', '<p>a</p>'],
    ])

    expect(classifyDrift(files, files)).toEqual({
      changed: [],
      pngDiffers: [],
      missing: [],
      stray: [],
    })
  })
})
