import { describe, expect, it } from 'vitest'
import {
  buildFrameValues,
  clip,
  FEATURED_SKILLS,
  type FrameCatalogs,
  FrameError,
  featured,
  fillTemplate,
  sample,
} from '@/capture/frame-values'
import { FAVICON_COLORS } from '@/design/favicon'

const TOKEN_CSS = [
  ':root {',
  '  --color-accent: #abcdef;',
  '  --color-bg: #000000;',
  '  --color-light-bg: #ffffff;',
  '}',
].join('\n')

const MARK =
  '<svg viewBox="0 0 110 110"><!-- note --><path fill="currentColor"/><rect class="pip" fill="#c2380e"/></svg>'

const names = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `name-${String(i).padStart(2, '0')}`)

const makeCatalogs = (
  overrides: Partial<FrameCatalogs> = {},
): FrameCatalogs => ({
  skills: [...FEATURED_SKILLS, 'extra'],
  gov: {
    stacks: [{ name: 'base', extends: null, rules: ['100-code'] }],
    rules: [
      {
        name: '100-code',
        domain: 'lang',
        description: '',
        paths: ['**/*.ts'],
        detect: null,
      },
    ],
    unreferenced: [],
    staleDetect: [],
  },
  toolingStacks: [
    { name: 'ts', extends: null, devDeps: 1, scripts: 2, gitignoreGroups: 0 },
  ],
  commandCount: 12,
  tokenCss: TOKEN_CSS,
  markSvg: MARK,
  ...overrides,
})

describe('sample', () => {
  it('should return a short catalog whole', () => {
    expect(sample(names(4), 10)).toEqual(names(4))
  })

  it('should step evenly across a long catalog', () => {
    const picked = sample(names(20), 10)

    expect(picked).toHaveLength(10)
    expect(picked[1]).toBe('name-02')
    expect(picked[9]).toBe('name-18')
  })
})

describe('featured', () => {
  it('should refuse a list of the wrong length', () => {
    expect(() => featured(names(10), names(9))).toThrow(
      'featured skills, expected 10',
    )
  })

  it('should name every featured skill missing from the catalog', () => {
    expect(() => featured(['a'], ['a', 'b'], 2)).toThrow(
      'featured skills missing from the catalog: b',
    )
  })
})

describe('clip', () => {
  it('should leave a value at the width edge alone', () => {
    expect(clip('abcd', 4)).toBe('abcd')
  })

  it('should end a longer value in an ellipsis within the width', () => {
    expect(clip('abcde', 4)).toBe('abc…')
  })
})

describe('buildFrameValues', () => {
  it('should refuse an empty catalog', () => {
    expect(() => buildFrameValues(makeCatalogs({ skills: [] }))).toThrow(
      'the skills catalog is empty',
    )
  })

  it('should refuse a zero command count', () => {
    expect(() => buildFrameValues(makeCatalogs({ commandCount: 0 }))).toThrow(
      FrameError,
    )
  })

  it('should point the light frame at the light roles', () => {
    const { frames } = buildFrameValues(makeCatalogs())

    const light = frames(['install.html.tmpl']).find(
      (frame) => frame.out === 'install-light.html',
    )

    expect(light?.tokens).toContain('--color-bg: var(--color-light-bg);')
  })

  it('should leave a template outside the light set dark only', () => {
    const { frames } = buildFrameValues(makeCatalogs())

    expect(frames(['hero.html.tmpl']).map((frame) => frame.out)).toEqual([
      'hero.html',
    ])
  })

  it('should paint the favicon in the mark pairs rather than the accent', () => {
    const { values } = buildFrameValues(makeCatalogs())

    const svg = decodeURIComponent(values.FAVICON)
    expect(svg).toContain(`.pip { fill: ${FAVICON_COLORS.pip.dark}; }`)
    expect(svg).not.toContain('#abcdef')
  })

  it('should hand the hero the dark pip, since the hero stays dark', () => {
    const { values } = buildFrameValues(makeCatalogs())

    expect(values.MARK_PIP).toBe(FAVICON_COLORS.pip.dark)
  })

  it('should refuse a mark the favicon cannot be drawn from', () => {
    expect(() =>
      buildFrameValues(makeCatalogs({ markSvg: '<svg><path/></svg>' })),
    ).toThrow(FrameError)
  })
})

describe('fillTemplate', () => {
  it('should fill a placeholder', () => {
    expect(fillTemplate('a.html.tmpl', '{{N}}', { N: '3' }, '')).toBe('3')
  })

  it('should name the template carrying an unresolved placeholder', () => {
    expect(() => fillTemplate('a.html.tmpl', '{{NOPE}}', {}, '')).toThrow(
      'a.html.tmpl carries unresolved placeholders {{NOPE}}',
    )
  })
})
