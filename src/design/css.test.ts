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
  motion: [],
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

    expect(css).toContain('--color-background: #0f0e0c;')
    expect(css).toContain('--color-light-muted: #6e6d6c;')
  })

  it('leaves an ANSI role out, since no browser renders one', () => {
    const css = buildDesignCss()

    expect(css).not.toContain('--color-warning')
    expect(css).not.toContain('--color-error')
  })

  it('emits success, which holds a hex a browser does render', () => {
    expect(buildDesignCss()).toContain('--color-success: #61c454;')
  })

  it('carries the spacing, type, and radius layers beside the colors', () => {
    const css = buildDesignCss()

    expect(css).toContain('--space-md: 0.875rem;')
    expect(css).toContain('--type-body-lh: 1.65;')
    expect(css).toContain(
      '--type-body-family: Geist Variable, DejaVu Sans, sans-serif;',
    )
    expect(css).toContain(
      '--type-code-family: Noto Sans Mono, DejaVu Sans Mono, monospace;',
    )
    expect(css).toContain('--t0: 3.175rem;')
    expect(css).toContain('--t6: 0.6875rem;')
    expect(css).toContain('--radius-marker: 999px;')
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

    // The four that closed the gap. Each one carries text on a light ground,
    // or is the surface step behind it, so a page reading any of them used to
    // resolve a dark value against a light canvas.
    expect(css).toContain('--color-chrome: var(--color-light-chrome);')
    expect(css).toContain('--color-text-body: var(--color-light-text-body);')
    expect(css).toContain(
      '--color-text-secondary: var(--color-light-text-secondary);',
    )
    expect(css).toContain('--color-success: var(--color-light-success);')
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

  it('prepends a banner only when the caller supplies one', () => {
    expect(
      buildDesignCss(undefined, { banner: 'Written by a test' }),
    ).toContain('/* Written by a test */')
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

    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain("font-family: 'Noto Sans Mono';")
    expect(css).toContain('url(data:font/woff2;base64,')
  })

  it('emits the Geist variable face with its weight range intact', () => {
    const css = buildDesignCss(undefined, { embedFonts: true })

    expect(css).toContain(
      "font-family: 'Geist Variable';\n  font-weight: 100 900;",
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
