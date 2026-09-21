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
  typeScale: [],
  typography: [],
  typographyNote: '',
  spacing: [],
  spacingNote: '',
  borders: [],
  bordersNote: '',
  layout: '',
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

  describe('teach footer and anchor chrome', () => {
    const teachCss = (): string =>
      buildDesignCss(undefined, { components: TEACH_STYLESHEET_COMPONENTS })

    const declarationsOf = (css: string, selector: string): string =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1].trim().split('\n').pop() === selector)
        .map((match) => match[2])
        .join('\n')

    it('caps the footer nav to the page measure and centres it', () => {
      const nav = declarationsOf(teachCss(), '.nav')

      expect(nav).toContain('max-width: calc(var(--teach-measure) + 3rem)')
      expect(nav).toMatch(/margin:\s*4rem auto 0/)
    })

    it('offsets an anchor jump past the sticky masthead on the root', () => {
      const root = declarationsOf(teachCss(), 'html')

      expect(root).toContain('scroll-padding-top: calc(var(--teach-mast-h)')
    })

    it('targets no footer wrapper the generated markup never emits', () => {
      expect(teachCss()).not.toContain('.nav-foot')
    })

    it('gives a lone footer card half the measure on the side it points', () => {
      const css = teachCss()

      expect(declarationsOf(css, '.nav > :only-child')).toContain(
        'flex: 0 1 calc(50% - 0.3rem)',
      )
      expect(declarationsOf(css, '.nav > .to-next:only-child')).toContain(
        'margin-left: auto',
      )
    })

    it('sizes every padded full-width box by its border box so none overflows a narrow viewport', () => {
      const css = teachCss()

      for (const selector of ['main', '.nav', '.opt']) {
        expect(declarationsOf(css, selector)).toContain(
          'box-sizing: border-box',
        )
      }
    })

    it('leaves smooth scrolling off, since a jump during reading competes with it', () => {
      expect(teachCss()).not.toContain('scroll-behavior')
    })
  })

  describe('teach course sidebar', () => {
    const teachCss = (): string =>
      buildDesignCss(undefined, { components: TEACH_STYLESHEET_COMPONENTS })

    const declarationsOf = (css: string, selector: string): string =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1].trim().split('\n').pop() === selector)
        .map((match) => match[2])
        .join('\n')

    it('should lay the sidebar and the content pane out as one flex row', () => {
      const css = teachCss()

      expect(declarationsOf(css, 'body')).toContain('display: flex')
      expect(declarationsOf(css, '.sb')).toContain('position: sticky')
      expect(declarationsOf(css, '.pane')).toContain('flex: 1 1 auto')
    })

    it('should keep the bottom room off the body, which a sticky sidebar can never travel into', () => {
      const body = declarationsOf(teachCss(), 'body')

      expect(body).toMatch(/padding:\s*0;/)
      expect(body).not.toContain('7rem')
    })

    it('should give the pane the bottom room and size it by its border box', () => {
      const pane = declarationsOf(teachCss(), '.pane')

      expect(pane).toContain('padding-bottom: 7rem')
      expect(pane).toContain('box-sizing: border-box')
      expect(pane).toContain('min-height: 100vh')
    })

    it('should report reading position on the masthead edge rather than as its own element', () => {
      expect(declarationsOf(teachCss(), '.bar::after')).toContain(
        'width: var(--read, 0%)',
      )
    })

    it('should retire the segmented progress track', () => {
      const css = teachCss()

      expect(css).not.toContain('.track')
    })

    it('should retire the fixed right-hand outline rail in favor of the folded list', () => {
      const css = teachCss()

      expect(css).not.toContain('.outline')
      expect(declarationsOf(css, '.sb-out a')).toContain('display: block')
    })

    it('should overlay the panel rather than squeeze the lesson below the sidebar breakpoint', () => {
      const css = teachCss()
      const narrow = /@media \(max-width: 1100px\) \{([\s\S]*?)\n\}/.exec(css)

      expect(narrow).not.toBeNull()
      expect(narrow?.[1]).toContain('position: fixed')
      expect(narrow?.[1]).toContain('.sb-scrim')
      expect(narrow?.[1]).toContain('.sb-close')
    })

    it('should hide the overlay-only controls above the breakpoint, where the script still appends them', () => {
      const css = teachCss()

      expect(declarationsOf(css, '.sb-close, .sb-scrim')).toContain(
        'display: none',
      )

      const narrow = /@media \(max-width: 1100px\) \{([\s\S]*?)\n\}/.exec(css)
      expect(narrow?.[1]).toContain('display: inline-flex')
      expect(narrow?.[1]).toContain('display: block')
    })

    it('should take a shut panel out of the tab order rather than only out of sight', () => {
      const css = teachCss()

      expect(css).toContain('html.sb-shut .sb { visibility: hidden')
    })

    it('should restate the panel width in the shut narrow state, which the wide rule collapses to zero', () => {
      const css = teachCss()
      const narrow = /@media \(max-width: 1100px\) \{([\s\S]*?)\n\}/.exec(css)

      expect(narrow?.[1]).toContain('html.sb-shut .sb { width: min(')
    })

    it('should drop every transition under a reduced-motion preference', () => {
      const css = teachCss()
      const reduced = [
        ...css.matchAll(
          /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g,
        ),
      ]
        .map((match) => match[1])
        .join('\n')

      expect(reduced).toContain('.sb')
      expect(reduced).toContain('transition: none')
    })
  })

  it('names no retired teach face in the seeded chrome', () => {
    const css = buildDesignCss(undefined, {
      components: TEACH_STYLESHEET_COMPONENTS,
    })

    expect(css).not.toContain('Nunito')
    expect(css).not.toContain('Cascadia')
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
