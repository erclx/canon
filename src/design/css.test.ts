import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPONENTS } from '@/design/components'
import { buildDesignCss, slug, unmappedOnLight } from '@/design/css'
import { HAND_DRAWN_FONT_FACES } from '@/design/fonts'
import type { DesignTokens } from '@/design/tokens'
import { TOKENS } from '@/design/tokens'

const minimal = (overrides: Partial<DesignTokens> = {}): DesignTokens => ({
  personality: '',
  color: [],
  colorRules: [],
  typeScale: [],
  typography: [],
  typographyRules: [],
  spacing: [],
  spacingRules: [],
  borders: [],
  bordersRules: [],
  layout: [],
  shadows: [],
  motion: [],
  durations: [],
  easings: [],
  iconography: [],
  ...overrides,
})

const declarationsOf = (css: string, selector: string): string => {
  const bodies = [
    ...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g),
  ]
    .filter((match) => match[1].trim().split('\n').pop()?.trim() === selector)
    .map((match) => match[2])

  if (bodies.length === 0) throw new Error(`no rule matches "${selector}"`)

  return bodies.join('\n')
}

describe('declarationsOf', () => {
  it('should read a rule indented inside a media query', () => {
    const css = '@media (max-width: 1px) {\n  .a {\n    color: red;\n  }\n}'

    expect(declarationsOf(css, '.a')).toContain('color: red')
  })

  it('should read a rule with a comment line above its selector', () => {
    const css =
      // canon-allow-embedded: the parser's input under test
      '/* why */\n.a {\n  color: red;\n}\n@media (x) {\n  /* in */\n  .b {\n    top: 0;\n  }\n}'

    expect(declarationsOf(css, '.a')).toContain('color: red')
    expect(declarationsOf(css, '.b')).toContain('top: 0')
  })

  it('should read a grouped selector as one string', () => {
    const css = '.a, .b {\n  color: red;\n}'

    expect(declarationsOf(css, '.a, .b')).toContain('color: red')
  })

  it('should throw naming the selector when no rule matches', () => {
    expect(() => declarationsOf('.a { color: red; }', '.missing')).toThrow(
      '.missing',
    )
  })
})

describe('slug', () => {
  it('reduces a role to the name a custom property carries', () => {
    expect(slug('Line height')).toBe('line-height')
    expect(slug('light-background')).toBe('light-background')
  })
})

describe('buildDesignCss', () => {
  it('emits one custom property per color role a browser can render', () => {
    const css = buildDesignCss()

    expect(css).toContain('--color-background: #121211;')
    expect(css).toContain('--color-light-muted: #6b6a66;')
  })

  it('leaves an ANSI role out, since no browser renders one', () => {
    const css = buildDesignCss()

    expect(css).not.toContain('--color-warning')
    expect(css).not.toContain('--color-error')
  })

  it('emits success, which holds a hex a browser does render', () => {
    expect(buildDesignCss()).toContain('--color-success: #6fae6a;')
  })

  it('carries the spacing, type, and radius layers beside the colors', () => {
    const css = buildDesignCss()

    expect(css).toContain('--space-md: 0.875rem;')
    expect(css).toContain('--type-body-lh: 1.55;')
    expect(css).toContain(
      '--type-body-family: Geist Variable, DejaVu Sans, sans-serif;',
    )
    expect(css).toContain(
      '--type-code-family: Geist Mono Variable, DejaVu Sans Mono, monospace;',
    )
    expect(css).toContain('--size-hero: 5.625rem;')
    expect(css).toContain('--size-view-small: 0.75rem;')
    expect(css).toContain('--radius-marker: 2px;')
  })

  it('gives every role a size the type scale offers', () => {
    const sizes = new Set(TOKENS.typeScale.map((step) => step.size))

    expect(TOKENS.typography.filter((role) => !sizes.has(role.size))).toEqual(
      [],
    )
  })

  it('drops a radius the record declares as none rather than emitting it', () => {
    expect(buildDesignCss()).not.toContain('--radius-rule')
  })

  it('remaps a role onto its light counterpart under the light theme', () => {
    expect(buildDesignCss()).toContain(
      '--color-background: var(--color-light-background);',
    )
  })

  it('emits no gap notice once every role carries a light counterpart', () => {
    const css = buildDesignCss()

    expect(unmappedOnLight()).toEqual([])
    expect(css).not.toContain('no light counterpart')
  })

  it('maps every role the light theme block stands in for', () => {
    const css = buildDesignCss()

    // Each carries text on a light ground or is the surface step behind it, so
    // a page reading one unmapped resolves a dark value against a light canvas.
    expect(css).toContain('--color-chrome: var(--color-light-chrome);')
    expect(css).toContain('--color-text-body: var(--color-light-text-body);')
    expect(css).toContain('--color-window: var(--color-light-window);')
    expect(css).toContain('--color-success: var(--color-light-success);')
  })

  it('emits a shadow, a duration, and an easing as properties', () => {
    const css = buildDesignCss(
      minimal({
        shadows: [{ role: 'ring', value: '0 0 0 1px #000000', when: 'edges' }],
        durations: [{ role: 'fade', value: '240ms', when: 'fades' }],
        easings: [
          {
            role: 'standard',
            value: 'cubic-bezier(0.3, 0.7, 0.3, 1)',
            when: 'moves',
          },
        ],
      }),
    )

    expect(css).toContain('--shadow-ring: 0 0 0 1px #000000;')
    expect(css).toContain('--duration-fade: 240ms;')
    expect(css).toContain('--ease-standard: cubic-bezier(0.3, 0.7, 0.3, 1);')
  })

  it('remaps a shadow onto its light counterpart under the light theme', () => {
    const css = buildDesignCss(
      minimal({
        shadows: [
          { role: 'ring', value: '0 0 0 1px #ffffff', when: 'edges' },
          { role: 'light-ring', value: '0 0 0 1px #000000', when: 'edges' },
        ],
      }),
    )

    expect(declarationsOf(css, "[data-theme='light']")).toContain(
      '--shadow-ring: var(--shadow-light-ring);',
    )
  })

  it('breaks a declaration past 80 columns after its colon, as oxfmt prints it', () => {
    const value =
      '0 0 0 1px rgba(0, 0, 0, 0.07), 0 24px 60px -28px rgba(0, 0, 0, 0.3)'

    const css = buildDesignCss(
      minimal({ shadows: [{ role: 'light-window', value, when: 'windows' }] }),
    )

    expect(css).toContain(`  --shadow-light-window:\n    ${value};`)
  })

  it('emits a step and a radius at their tablet and phone sizes under the two queries', () => {
    const css = buildDesignCss(
      minimal({
        typeScale: [
          { step: 'hero', size: '5.625rem', tablet: '4rem', phone: '2.5rem' },
        ],
        borders: [
          {
            role: 'tray',
            radius: '36px',
            width: 'none',
            when: 'trays',
            tablet: '28px',
            phone: '22px',
          },
        ],
      }),
    )

    expect(css).toContain(
      // canon-allow-embedded: the emitted query under test
      '@media (max-width: 900px) {\n  :root {\n    --size-hero: 4rem;\n    --radius-tray: 28px;\n  }\n}',
    )
    expect(css).toContain(
      // canon-allow-embedded: the emitted query under test
      '@media (max-width: 640px) {\n  :root {\n    --size-hero: 2.5rem;\n    --radius-tray: 22px;\n  }\n}',
    )
  })

  it('emits no width query when no step shrinks', () => {
    const css = buildDesignCss(
      minimal({ typeScale: [{ step: 'body', size: '1rem' }] }),
      { components: false },
    )

    expect(css).not.toContain('@media')
  })

  it('carries every component rule by default', () => {
    const css = buildDesignCss()

    for (const component of COMPONENTS) {
      expect(css).toContain(component.rules)
    }
  })

  it('emits only the properties a component reads when asked for tokens alone', () => {
    const css = buildDesignCss(undefined, { components: false })

    expect(css).not.toContain('.status::before')
    expect(css).toContain('--color-accent:')
  })

  it('emits only an explicit component list, leaving the generic default out', () => {
    const custom = {
      name: 'custom',
      note: 'A component built for this test alone.',
      reads: [] as const,
      rules: '.custom { color: red; }',
    }

    const css = buildDesignCss(undefined, { components: [custom] })

    expect(css).toContain('.custom { color: red; }')
    expect(css).not.toContain('.status::before')
  })

  it('embeds only an explicit font list, leaving the mono default out', () => {
    const custom = { family: 'Custom Face', weight: '400', base64: 'AAAA' }

    const css = buildDesignCss(undefined, { embedFonts: [custom] })

    expect(css).toContain("font-family: 'Custom Face';")
    expect(css).toContain('base64,AAAA')
    expect(css.match(/@font-face/g)).toHaveLength(1)
  })

  it('opens the default output on the root block', () => {
    expect(buildDesignCss().startsWith(':root {')).toBe(true)
  })

  it('names no light counterpart when every role has one', () => {
    const tokens = minimal({
      color: [
        { role: 'text', intent: 'copy', value: '#111111' },
        { role: 'light-text', intent: 'copy on light', value: '#eeeeee' },
      ],
    })

    expect(unmappedOnLight(tokens)).toEqual([])
    expect(buildDesignCss(tokens)).not.toContain('no light counterpart')
  })

  it('reads every property a component declares it reads', () => {
    const css = buildDesignCss()

    for (const component of COMPONENTS) {
      for (const property of component.reads) {
        expect(css).toContain(`${property}:`)
      }
    }
  })

  it('emits the same color set the record carries', () => {
    const withHex = TOKENS.color.filter(
      (token) => !token.value.startsWith('ANSI'),
    )
    const css = buildDesignCss()

    for (const token of withHex) {
      expect(css).toContain(`--color-${slug(token.role)}: ${token.value};`)
    }
  })

  it('emits a @font-face block per default face when asked to embed fonts', () => {
    const css = buildDesignCss(undefined, { embedFonts: true })

    expect(css.match(/@font-face/g)).toHaveLength(2)
    expect(css).toContain("font-family: 'Geist Mono Variable';")
    expect(css).toContain('url(data:font/woff2;base64,')
  })

  it('emits the Geist variable face with its weight range intact', () => {
    const css = buildDesignCss(undefined, { embedFonts: true })

    expect(css).toContain(
      "font-family: 'Geist Variable';\n  font-weight: 100 900;",
    )
  })

  it('emits the Geist Mono variable face with its weight range intact', () => {
    const css = buildDesignCss(undefined, { embedFonts: true })

    expect(css).toContain(
      "font-family: 'Geist Mono Variable';\n  font-weight: 100 900;",
    )
  })

  it('emits no @font-face block by default', () => {
    expect(buildDesignCss()).not.toContain('@font-face')
  })

  it('emits two @font-face blocks when asked to embed the hand-drawn faces', () => {
    const css = buildDesignCss(undefined, { embedFonts: HAND_DRAWN_FONT_FACES })

    expect(css.match(/@font-face/g)).toHaveLength(2)
    expect(css).toContain("font-family: 'Virgil';")
    expect(css).toContain("font-family: 'Excalifont';")
  })
})

const SCREENSHOT_CONFIG = join(
  import.meta.dirname,
  '../../tooling/web/configs/e2e/screenshot.ts',
)

const readCaptureWidths = (): number[] => {
  const source = readFileSync(SCREENSHOT_CONFIG, 'utf8')
  const viewports = source.match(/const VIEWPORTS[^=]*=\s*\[([\s\S]*?)\n\]/)
  const widths = [...(viewports?.[1] ?? '').matchAll(/\bwidth:\s*(\d+)/g)]

  return widths.map((match) => Number(match[1]))
}

const readWidthCuts = (css: string): number[] => {
  const widthQueries = [...css.matchAll(/@media\s*([^{]*)\{/g)]
    .map((match) => match[1].trim())
    .filter((query) => query.includes('width'))

  return widthQueries.map((query) => {
    const match = query.match(/^\((max|min)-width:\s*(\d+)px\)$/)
    if (match === null) {
      throw new Error(`Unparsed width query: ${query}`)
    }
    const value = Number(match[2])

    return match[1] === 'max' ? value : value - 1
  })
}

const uncoveredRanges = (cuts: number[], widths: number[]): string[] => {
  const sortedCuts = [...new Set(cuts)].sort((a, b) => a - b)
  const bounds = [0, ...sortedCuts, Number.POSITIVE_INFINITY]
  const ranges = bounds
    .slice(1)
    .map((upper, index) => ({ lower: bounds[index] + 1, upper }))

  return ranges
    .filter(
      ({ lower, upper }) =>
        !widths.some((width) => width >= lower && width <= upper),
    )
    .map(({ lower, upper }) => `${lower} to ${upper}`)
}

describe('capture widths', () => {
  it('reads a width from every viewport the capture config declares', () => {
    expect(readCaptureWidths()).toEqual([320, 768, 1280, 1536])
  })

  it('reach every range the base width queries lay out', () => {
    const cuts = readWidthCuts(buildDesignCss())

    expect(uncoveredRanges(cuts, readCaptureWidths())).toEqual([])
  })

  it('reports the range a moved query opens with no width inside it', () => {
    expect(uncoveredRanges([640, 1300, 1420], [320, 768, 1280, 1536])).toEqual([
      '1301 to 1420',
    ])
  })

  it('refuses a width query it cannot parse rather than skipping it', () => {
    expect(() =>
      readWidthCuts('@media (min-width: 40em) { a { color: red } }'),
    ).toThrow('Unparsed width query: (min-width: 40em)')
  })

  it('names the declared widths and the range check in the layout record', () => {
    const widths = readCaptureWidths()
    const layout = TOKENS.layout.join('\n')
    const named = [...layout.matchAll(/\b(\d{3,4})\b/g)]
      .map((match) => Number(match[1]))
      .filter((width) => widths.includes(width))

    expect([...new Set(named)]).toEqual(widths)
    expect(layout).toContain('opens a range one of these widths reaches')
  })
})
