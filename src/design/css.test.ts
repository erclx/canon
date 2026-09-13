import { describe, expect, it } from 'vitest'
import { COMPONENTS, TEACH_STYLESHEET_COMPONENTS } from '@/design/components'
import { buildDesignCss, slug, unmappedOnLight } from '@/design/css'
import { HAND_DRAWN_FONT_FACES } from '@/design/fonts'
import type { DesignTokens } from '@/design/tokens'
import { TOKENS } from '@/design/tokens'

const minimal = (overrides: Partial<DesignTokens> = {}): DesignTokens => ({
  personality: '',
  preamble: '',
  color: [],
  colorNote: '',
  typography: [],
  typographyNote: '',
  spacing: [],
  spacingNote: '',
  borders: [],
  bordersNote: '',
  motion: '',
  iconography: '',
  ...overrides,
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

    expect(css).toContain('--color-background: #191512;')
    expect(css).toContain('--color-light-muted: #726b62;')
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

    expect(css).toContain('--space-md: 18px;')
    expect(css).toContain('--type-body-lh: 1.65;')
    expect(css).toContain(
      '--type-body-family: Noto Sans Mono, DejaVu Sans Mono, monospace;',
    )
    expect(css).toContain(
      '--type-page-display-family: Noto Sans, DejaVu Sans, sans-serif;',
    )
    expect(css).toContain('--radius-marker: 999px;')
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

  it('reads every property the teach chrome set declares it reads', () => {
    const css = buildDesignCss(undefined, {
      components: TEACH_STYLESHEET_COMPONENTS,
    })

    for (const component of TEACH_STYLESHEET_COMPONENTS) {
      for (const property of component.reads) {
        expect(css).toContain(`${property}:`)
      }
    }
  })

  it('declares every alias a hand-authored lesson diagram consumes, not only what a component reads', () => {
    // Shaped like the fill/stroke references in a real lesson diagram SVG
    // (.canon/teach/03-fde-system-design/lessons/0003-deployment-skeleton.html),
    // none of which any component's own `reads` array names.
    const diagramFixture = `
      <rect fill="var(--panel)" stroke="var(--rule)" />
      <text fill="var(--ink)">label</text>
      <text fill="var(--ink-soft)">detail</text>
      <text fill="var(--ink-faint)">footnote</text>
      <rect fill="var(--accent-bg)" stroke="var(--accent)" />
    `
    const requiredNames = [
      ...diagramFixture.matchAll(/var\((--[\w-]+)\)/g),
    ].map((match) => match[1])
    const css = buildDesignCss(undefined, {
      components: TEACH_STYLESHEET_COMPONENTS,
    })
    const undeclared = requiredNames.filter((name) => !css.includes(`${name}:`))

    expect(undeclared).toEqual([])
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

  it('emits two @font-face blocks when asked to embed fonts', () => {
    const css = buildDesignCss(undefined, { embedFonts: true })

    expect(css.match(/@font-face/g)).toHaveLength(2)
    expect(css).toContain("font-family: 'Noto Sans Mono';")
    expect(css).toContain('url(data:font/woff2;base64,')
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
